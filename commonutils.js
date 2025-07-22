const os = require('os');

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

module.exports.getLocalIpAddress = getLocalIpAddress;
module.exports.getHostName = getHostName;