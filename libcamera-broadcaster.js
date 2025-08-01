/*
    This is based on @pimterry 's raspivid-stream (https://github.com/pimterry/raspivid-stream)

    MIT License

    Copyright (c) 2017 Tim Perry

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

const WebSocketServer = require('ws').Server;

const child = require('child_process');
const stream = require('stream');
const Splitter = require('stream-split');
const NALSeparator = new Buffer([0, 0, 0, 1]);

var wsServer = null;

var headerFrames = [];
var latestIdrFrame = null;
var videoStream = null;
var videoProcess = null;
var coreProcess = null;
var activeFlag = false;
var intvl = null;

function createBroadcaster(options) {
    // console.log("Creating WebSocketServer");
    options = options || {};

    wsServer = new WebSocketServer({ port: options.port });
    wsServer.on('connection', (socket) => {
        socket.send(JSON.stringify({
            action: "init",
            width: options.width,
            height: options.height
        }));
        // console.log("Sending set-up info");
        try {
            socket.send(Buffer.concat([...headerFrames, latestIdrFrame]), { binary: true });
        } catch (e) {
            //silently ignore
        }
    });
    var args = [
        '--bitrate', '1000000', '--denoise', 'cdn_off', '--nopreview', '--output', '-', '--timeout', '0', '--profile', 'baseline'
    ]

    const { port, ...libcameraargs } = { ...options };
    Object.keys(libcameraargs || {}).forEach(function (key) {
        args.push('--' + key);
        var val = options[key];
        if (val || val === 0) {
            args.push(val);
        }
    })

    // console.log(args)
    coreProcess = child.spawn(process.env.CAMAPP_COMMAND, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    videoProcess = coreProcess.stdout;
    videoStream = videoProcess
        .pipe(new Splitter(NALSeparator))
        .pipe(new stream.Transform({
            transform: function (chunk, _encoding, callback) {
                const chunkType = chunk[0] & 0b11111;
                const chunkWithSeparator = Buffer.concat([NALSeparator, chunk]);

                if (chunkType === 7 || chunkType === 8) {
                    // console.log("New header frame");
                    headerFrames.push(chunkWithSeparator);
                } else {
                    if (chunkType === 5) {
                        latestIdrFrame = chunkWithSeparator;
                        // console.log("New IDR");
                    }
                    this.push(chunkWithSeparator);
                }

                callback();
            }
        }));

    videoStream.on('data', (data) => {
        wsServer.clients.forEach((socket) => {
            socket.send(data, { binary: true });
        });
    });

    intvl = setInterval(stopBroadcaster, 10000);
    activeFlag = true;
    console.log("Cam started...");
}

function stopBroadcaster() {
    if (wsServer.clients.size <= 0) {
        if (videoStream && videoStream != null) {
            videoStream.unpipe();
            videoStream = null;
        }
        if (coreProcess && coreProcess != null && typeof (coreProcess.kill) == 'function') {
            coreProcess.kill();
            coreProcess = null;
        }
        if (wsServer && wsServer != null) {
            wsServer.close();
            wsServer = null;
        }
        headerFrames = [];
        latestIdrFrame = null;
        clearInterval(intvl);
        intvl = null;
        console.log("Cam closed due to inactivity...");
        activeFlag = false;
        return true;
    } else {
        return false;
    }
}

class Broadcaster {
    constructor(options) {
        if (process.env.CAMAPP_COMMAND && process.env.CAMAPP_COMMAND !== '') {
            createBroadcaster(options);
            this.wsServer = wsServer;
            this.headerFrames = headerFrames;
            this.latestIdrFrame = latestIdrFrame;
            this.videoStream = videoStream;
        }
    }

    stopBroadcaster() {
        return stopBroadcaster();
    }

    isActive() {
        return activeFlag;
    }

}

module.exports = Broadcaster;