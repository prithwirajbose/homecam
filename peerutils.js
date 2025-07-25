const dgram = require('dgram'),
    os = require('os'),
    _ = require('lodash'),
    commonutils = require('./commonutils'),
    SERVER_PORT = 41234,
    CLIENT_PORT = 41235,
    BROADCAST_ADDRESS = '255.255.255.255';
const server = dgram.createSocket('udp4');
const client = dgram.createSocket('udp4');
var intvl = null;

function initServer(camData) {
    server.on('error', (err) => {
        server.close();
    });

    server.on('message', (msg, rinfo) => {

    });

    server.on('listening', () => {
        const address = server.address();
        console.log(`Peer discovery server listening on ${address.port}`);
        server.setBroadcast(true); // Enable broadcast mode
    });

    server.bind(SERVER_PORT, () => {
        intvl = setInterval(() => {
            if (camData.isRestarting) {
                clearInterval(intvl);
                intvl = null;
                server.close();
                return false;
            }
            const message = Buffer.from(JSON.stringify(camData.getMyCamDetails()));
            server.send(message, 0, message.length, CLIENT_PORT, BROADCAST_ADDRESS, (err) => {
                if (err) {
                    console.error('Error sending broadcast:', err);
                }
            });
        }, 5000);
    });
}

function initClient(camData) {

    client.on('error', (err) => {
        console.error(`Client error:\n${err.stack}`);
        client.close();
    });


    client.on('message', (msg, rinfo) => {
        if (camData.isRestarting) {
            client.close();
            return false;
        } else {
            var peerCamDetails = commonutils.getPeerDetailsFromPing(msg.toString(), rinfo.address);
            if (commonutils.getLocalIpAddress() != rinfo.address && !_.isNil(peerCamDetails)) {
                var myCamDetails = camData.getMyCamDetails();
                if (myCamDetails.camport == peerCamDetails.camport || myCamDetails.port == peerCamDetails.port) {
                    var deterministicWinner = commonutils.deterministicStringWinner(myCamDetails.id, peerCamDetails.id);
                    if (deterministicWinner === myCamDetails.id) {
                        console.log("Cam port conflict detected with peer: " + peerCamDetails.id + ", I am restarting...");
                        if (myCamDetails.camport == peerCamDetails.camport) {
                            var usedPorts = camData.getCamDetailsFieldAsArray('camport');
                            var freePort = commonutils.getNextFreePort(usedPorts);
                            process.env.CAMPORT = freePort;
                            commonutils.updateKeyValuePairInEnvFile('CAMPORT', freePort);
                        }
                        if (myCamDetails.port == peerCamDetails.port) {
                            var usedPorts = camData.getCamDetailsFieldAsArray('port');
                            var freePort = commonutils.getNextFreePort(usedPorts);
                            process.env.PORT = freePort;
                            commonutils.updateKeyValuePairInEnvFile('PORT', freePort);
                        }
                        camData.isRestarting = true;
                        commonutils.restartThisNodeApp();
                    } else {
                        console.log("Cam port conflict detected with peer: " + peerCamDetails.id + ", peer is restarting...");
                    }
                } else {
                    if (_.isNil(camData.getCamDetails(peerCamDetails.id))) {
                        console.log('New Peer Found: ', peerCamDetails.id);
                    }
                    camData.addCamDetails(peerCamDetails);
                }
            }
        }
    });

    client.on('listening', () => {
        const address = client.address();
        client.setBroadcast(true); // Enable broadcast mode to receive broadcasts
    });

    client.bind(CLIENT_PORT);
}

function findPeers(camData) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            initServer(camData);
            initClient(camData);
        }, 15000);
        return resolve(true);
    });
}

module.exports.findPeers = findPeers;