const dgram = require('dgram'),
    os = require('os'),
    SERVER_PORT = 41234,
    CLIENT_PORT = 41235,
    BROADCAST_ADDRESS = '255.255.255.255';

let friendList = [];

function initServer(camData) {
    const server = dgram.createSocket('udp4');
    server.on('error', (err) => {
        server.close();
    });

    server.on('message', (msg, rinfo) => {
        console.log(`Server received: ${msg} from ${rinfo.address}:${rinfo.port}`);
    });

    server.on('listening', () => {
        const address = server.address();
        console.log(`Server listening ${address.address}:${address.port}`);
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
        if (getLocalIpAddress() != rinfo.address && isValidAppSignature(msg.toString(), rinfo.address)) {
            // If the message is valid and not from itself, add to friend list
            console.log(`Client received: ${msg} from ${rinfo.address}:${rinfo.port}`);
            if (!friendList.includes(rinfo.address)) {
                friendList.push(rinfo.address);
            }
        }
    });

    client.on('listening', () => {
        const address = client.address();
        console.log(`Client listening ${address.address}:${address.port}`);
        client.setBroadcast(true); // Enable broadcast mode to receive broadcasts
    });

    client.bind(CLIENT_PORT);
}

function findPeers(camData) {
    return new Promise((resolve, reject) => {
        initServer(camData);
        initClient(camData);
    });
}