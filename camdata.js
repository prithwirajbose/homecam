require('dotenv').config();
const utils = require('./commonutils');

function generateCamId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let camId = '';
    for (let i = 0; i < 16; i++) {
        camId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return camId;
}

const camId = process.env.CAMNAME || generateCamId();
var CAM_DETAILS = {};
CAM_DETAILS[camId] = {
    id: camId,
    port: process.env.PORT || 8080,
    camport: process.env.CAMPORT || 3000,
    host: utils.getHostName(),
    ipAddress: utils.getLocalIpAddress(),
    groupSignature: process.env.GROUP_SIGNATURE || 'Z2h5w3J2TnB3V282h1d6Jq6yQk5zV0p4G2xvYk1wS2p3d1Jw',
    self: true
};
module.exports.getcamdetails = function (camId) {
    if (camId && CAM_DETAILS[camId]) {
        return CAM_DETAILS[camId];
    } else {
        return null;
    }
};