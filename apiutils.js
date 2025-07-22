require('dotenv').config();
const { is } = require('express/lib/request');
const _ = require('lodash'),
    camData = require('./camdata'),
    Broadcaster = require('./libcamera-broadcaster');
var broadcaster = null;


function apilogin(req, res) {
    if (!_.isNil(req.body) && isValidCredentials(req.body.username, req.body.password)) {
        setSession(req, res, 'admin');
        res.status(200).json(constructResponse(true, { message: 'Login successful', userId: req.session.userId }, null));
    } else {
        res.status(200).json(constructResponse(false, null, 'Invalid username or password'));
    }
}

function apistartcam(req, res) {
    const camId = req.query.camId || process.env.CAMNAME || 'cam1';
    const camDetails = camData.getcamdetails(camId);
    if (camDetails) {
        startCamera(camDetails);
        res.status(200).json(constructResponse(true, { port: camDetails.port, camport: camDetails.camport, id: camId }, null));
    } else {
        res.status(404).json(constructResponse(false, null, 'Camera details not found'));
    }
}

function apistopcam(req, res) {
    const camId = req.query.camId || process.env.CAMNAME || 'cam1';
    const camDetails = camData.getcamdetails(camId);
    if (camDetails) {
        stopCamera(camDetails);
        res.status(200).json(constructResponse(true, { port: camDetails.port, camport: camDetails.camport, id: camId }, null));
    } else {
        res.status(404).json(constructResponse(false, null, 'Camera details not found'));
    }
}

function startCamera(camDetails) {
    if (broadcaster==null || !broadcaster.isActive()) {
        broadcaster = new Broadcaster({ width: 320, height: 240, framerate: 15, port: camDetails.camport });
    }
}

function stopCamera(camDetails) {
    if (broadcaster && broadcaster!=null && broadcaster.isActive() && broadcaster.stopBroadcaster()) {
        broadcaster = null;
    }
}

function setSession(req, res, userId) {
    req.session.userId = userId;
    res.cookie('userId', userId, { signed: true, httpOnly: true });
}

function isValidCredentials(username, password) {
    return !_.isNil(username) && !_.isNil(password) && username === process.env.APPUSER && password === process.env.APPPASS;
}

function constructResponse(success, data, error) {
    return {
        success: success,
        data: data,
        error: error
    };
}
module.exports.apilogin = apilogin;
module.exports.apistartcam = apistartcam;
module.exports.apistopcam = apistopcam;
module.exports.isValidCredentials = isValidCredentials;
module.exports.setSession = setSession;