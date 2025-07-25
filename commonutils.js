const os = require('os'),
    _ = require('lodash'),
    exec = require('child_process').exec,
    crypto = require('crypto'),
    path = require('path'),
    fs = require('fs');
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

function getPeerDetailsFromPing(msg, address) {
    try {
        if (!_.isNil(msg) && !_.isNil(address)) {
            const peerCamDetails = JSON.parse(msg);
            if (peerCamDetails && peerCamDetails.groupSignature === process.env.GROUP_SIGNATURE && peerCamDetails.ipAddress === address &&
                peerCamDetails.id && peerCamDetails.port && peerCamDetails.camport && peerCamDetails.host) {
                peerCamDetails.self = false; // Mark as not self
                return peerCamDetails;
            } else if (peerCamDetails && peerCamDetails.groupSignature === process.env.GROUP_SIGNATURE && peerCamDetails.ipAddress === address) {
                return peerCamDetails;
            }
        }
    } catch (e) { }

    return null;
}

function deterministicStringWinner(str1, str2) {
    // Sort the strings to ensure order doesn't matter
    const [a, b] = [str1, str2].sort();
    // Create a simple deterministic hash
    let hash = 0;
    const combined = a + ':' + b;
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    // Use the hash to pick one of the two
    return (hash % 2 === 0) ? a : b;
}

function updateKeyValuePairInEnvFile(key, value) {
    const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    const lines = envContent.split('\n');
    const updatedLines = lines.map(line => {
        if (line.startsWith(key + '=')) {
            return `${key}=${value}`;
        }
        return line;
    });
    fs.writeFileSync(path.join(__dirname, '.env'), updatedLines.join('\n'), 'utf8');
}

function restartThisNodeApp() {
    const command = `node ${process.argv[1]} ${process.argv.slice(2).join(' ')}`;
    console.log(`Restarting app with command: ${command}`);
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error restarting app: ${error.message}`);
            return;
        }
        console.log(`App restarted successfully: ${stdout}`);
        process.exit(0);
    });
}

function getNextFreePort(usedPorts) {
    if (!Array.isArray(usedPorts) || usedPorts.length === 0) {
        return '8080';
    }
    const sorted = usedPorts.map(Number).sort((a, b) => a - b);
    return '' + (sorted[sorted.length - 1] + 1);
}

function getCookieSignSecret() {
    return crypto.createHash('md5').update(process.env.GROUP_SIGNATURE || '').digest('hex');
}

function encryptString(str) {
    const secret = getCookieSignSecret();
    // Derive a 32-byte key from the secret (md5 is 16 bytes, so pad or hash again)
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = Buffer.alloc(16, 0); // Use a zero IV for simplicity (not recommended for production)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(str, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptString(encryptedStr) {
    const secret = getCookieSignSecret();
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = Buffer.alloc(16, 0); // Use the same zero IV as in encryptString
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedStr, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports.getMyCamDetails = getMyCamDetails;
module.exports.getLocalIpAddress = getLocalIpAddress;
module.exports.getHostName = getHostName;
module.exports.getPeerDetailsFromPing = getPeerDetailsFromPing;
module.exports.deterministicStringWinner = deterministicStringWinner;
module.exports.updateKeyValuePairInEnvFile = updateKeyValuePairInEnvFile;
module.exports.restartThisNodeApp = restartThisNodeApp;
module.exports.getNextFreePort = getNextFreePort;
module.exports.getCookieSignSecret = getCookieSignSecret;
module.exports.encryptString = encryptString;
module.exports.decryptString = decryptString;