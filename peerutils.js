const dgram = require('dgram'),
    os = require('os'),
    camData = require('./camdata'),
    SERVER_PORT = 41234,
    CLIENT_PORT = 41235,
    BROADCAST_ADDRESS = '255.255.255.255';

let friendList = [];

function initServer() {
    const server = dgram.createSocket('udp4');
    server.on('error', (err) => {
        console.error(`Server error:\n${err.stack}`);
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
        // Send a broadcast message every 3 seconds
        setInterval(() => {
            const message = Buffer.from(getAppSignature());
            server.send(message, 0, message.length, CLIENT_PORT, BROADCAST_ADDRESS, (err) => {
                if (err) {
                    console.error('Error sending broadcast:', err);
                } else {
                    console.log('Broadcast message sent.');
                }
            });
        }, 3000);
    });
}

function initClient() {
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

function findPeers() {
    return new Promise((resolve, reject) => {
        initServer();
        initClient();
    });
}