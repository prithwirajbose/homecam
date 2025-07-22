require('dotenv').config();
var CAM_DETAILS = {};
CAM_DETAILS[process.env.CAMNAME || 'cam1'] = {
    "port": process.env.PORT || 8080,
    "camport": process.env.CAMPORT || 3000
};
module.exports.getcamdetails = function (camId) {
    if (camId && CAM_DETAILS[camId]) {
        return CAM_DETAILS[camId];
    } else {
        return null;
    }
};