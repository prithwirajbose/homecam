require('dotenv').config();
const utils = require('./commonutils');

const myCamDetails = utils.getMyCamDetails();
var CAM_DETAILS = {};
CAM_DETAILS[myCamDetails.id] = myCamDetails;

module.exports.getMyCamDetails = function () {
    return myCamDetails;
};

module.exports.getcamdetails = function (camId) {
    if (camId && CAM_DETAILS[camId]) {
        return CAM_DETAILS[camId];
    } else {
        return null;
    }
};