const dgram = require('dgram'),
    os = require('os'),
    _ = require('lodash'),
    commonutils = require('./commonutils'),
    SERVER_PORT = 41234,
    CLIENT_PORT = 41235,
    BROADCAST_ADDRESS = '255.255.255.255';

function initServer(camData) {
    const server = dgram.createSocket('udp4');
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
        setInterval(() => {
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
    const client = dgram.createSocket('udp4');

    client.on('error', (err) => {
        console.error(`Client error:\n${err.stack}`);
        client.close();
    });


    client.on('message', (msg, rinfo) => {
        var peerCamDetails = commonutils.getPeerDetailsFromPing(msg.toString(), rinfo.address);
        if (commonutils.getLocalIpAddress() != rinfo.address && !_.isNil(peerCamDetails)) {
            var myCamDetails = camData.getMyCamDetails();
            if (myCamDetails.camport == peerCamDetails.camport || myCamDetails.port == peerCamDetails.port) {
                var deterministicWinner = commonutils.deterministicStringWinner(myCamDetails.id, peerCamDetails.id);
                if (deterministicWinner === myCamDetails.id) {
                    if (myCamDetails.camport == peerCamDetails.camport) {
                        var usedPorts = camData.getCamDetailsFieldAsArray('camport');
                        commonutils.updateKeyValuePairInEnvFile('CAMPORT', commonutils.getNextFreePort(usedPorts));
                    } else {
                        var usedPorts = camData.getCamDetailsFieldAsArray('port');
                        commonutils.updateKeyValuePairInEnvFile('PORT', commonutils.getNextFreePort(usedPorts));
                    }
                    commonutils.restartThisNodeApp();
                }
            } else {
                if (_.isNil(camData.getCamDetails(peerCamDetails.id))) {
                    console.log('New Peer Found: ', peerCamDetails.id);
                }
                camData.addCamDetails(peerCamDetails);
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
        initServer(camData);
        initClient(camData);
        return resolve(true);
    });
}

module.exports.findPeers = findPeers;