require('dotenv').config();
const utils = require('./commonutils');

const myCamDetails = utils.getMyCamDetails();
var USERHASH = {};
var CAM_DETAILS = {};
CAM_DETAILS[myCamDetails.id] = myCamDetails;

module.exports.getMyCamDetails = function () {
    return myCamDetails;
};

module.exports.getCamDetails = function (camId) {
    if (camId && CAM_DETAILS[camId]) {
        return CAM_DETAILS[camId];
    } else {
        return null;
    }
};

module.exports.getCameras = function (camId) {
    var cameras = [];
    for (const key in CAM_DETAILS) {
        if (CAM_DETAILS.hasOwnProperty(key)) {
            cameras.push(CAM_DETAILS[key]);
        }
    }
    return cameras;
};

module.exports.addCamDetails = function (camDetails) {
    camDetails.self = false; // Ensure the camDetails is marked as not self
    CAM_DETAILS[camDetails.id] = camDetails;
};

module.exports.getCamDetailsFieldAsArray = function (field) {
    var arr = [];
    for (const key in CAM_DETAILS) {
        if (CAM_DETAILS.hasOwnProperty(key) && CAM_DETAILS[key][field]) {
            arr.push(CAM_DETAILS[key][field]);
        }
    }
    return arr;
};

module.exports.getUserHash = function (userId) {
    if (userId && USERHASH[userId]) {
        return USERHASH[userId];
    } else {
        return null;
    }
};

module.exports.getUserByHash = function (hash) {
    for (const userId in USERHASH) {
        if (USERHASH.hasOwnProperty(userId) && USERHASH[userId] === hash) {
            return userId;
        }
    }
    return null;
};

module.exports.setUserHash = function (userId, hash) {
    if (userId && hash) {
        USERHASH[userId] = hash;
    }
};