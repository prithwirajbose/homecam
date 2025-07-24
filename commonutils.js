const os = require('os'),
    _ = require('lodash');
require('dotenv').config();

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const iface of Object.values(interfaces)) {
        for (const details of iface) {
            if (details.family === 'IPv4' && !details.internal) {
                return details.address;
            }
        }
    }
    return '127.0.0.1';
}

function getHostName() {
    return os.hostname();
}

function getMyCamId() {
    if (!_.isNil(process.env.CAMNAME)) {
        return process.env.CAMNAME;
    } else {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let camId = '';
        for (let i = 0; i < 16; i++) {
            camId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        process.env.CAMNAME = camId;
        return camId;
    }
}

function getMyCamDetails() {
    return {
        id: getMyCamId(),
        port: process.env.PORT || 8080,
        camport: process.env.CAMPORT || 3000,
        host: getHostName(),
        ipAddress: getLocalIpAddress(),
        groupSignature: process.env.GROUP_SIGNATURE || 'Z2h5w3J2TnB3V282h1d6Jq6yQk5zV0p4G2xvYk1wS2p3d1Jw',
        self: true
    };
}

module.exports.getMyCamDetails = getMyCamDetails;
module.exports.getLocalIpAddress = getLocalIpAddress;
module.exports.getHostName = getHostName;