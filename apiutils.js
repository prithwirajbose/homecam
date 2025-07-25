require('dotenv').config();
const { is } = require('express/lib/request');
const _ = require('lodash'),
    camData = require('./camdata'),
    peerUtils = require('./peerutils'),
    commonutils = require('./commonutils'),
    request = require('request'),
    { v4: uuidv4 } = require('uuid');
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
    const camDetails = camData.getCamDetails(camId);
    if (camDetails) {
        startCamera(camDetails);
        res.status(200).json(constructResponse(true, { port: camDetails.port, camport: camDetails.camport, id: camId }, null));
    } else {
        res.status(404).json(constructResponse(false, null, 'Camera details not found'));
    }
}

function apigetcams(req, res) {
    res.status(200).json(constructResponse(true, { remoteAccessHash: commonutils.encryptString(req.session.userId + ":::" + camData.getMyCamDetails().id), cams: camData.getCameras() }, null));
}

function apistopcam(req, res) {
    const camId = req.query.camId || process.env.CAMNAME || 'cam1';
    const camDetails = camData.getCamDetails(camId);
    if (camDetails) {
        stopCamera(camDetails);
        res.status(200).json(constructResponse(true, { port: camDetails.port, camport: camDetails.camport, id: camId }, null));
    } else {
        res.status(404).json(constructResponse(false, null, 'Camera details not found'));
    }
}

function apivalidatelogin(req, res) {
    if (!_.isNil(req.query) && !_.isNil(req.query.remoteHash)) {
        const hashInfo = commonutils.decryptString(req.query.remoteHash).split(':::');
        const remoteCamDetails = camData.getCamDetails(hashInfo[1]);
        if (remoteCamDetails && remoteCamDetails.id === camData.getMyCamDetails().id) {
            var userId = camData.getUserByHash(hashInfo[0]);
            if (!_.isNil(userId) && userId !== '') {
                res.status(200).json(constructResponse(true, { userId: userId }, null));
            } else {
                res.status(403).json(constructResponse(false, null, 'This user has not logged in earlier'));
            }
        } else {
            res.status(403).json(constructResponse(false, null, 'This user has not logged in on this camera'));
        }
    } else {
        res.status(400).json(constructResponse(false, null, 'Invalid request'));
    }
}

function startCamera(camDetails) {
    if (broadcaster == null || !broadcaster.isActive()) {
        broadcaster = new Broadcaster({ width: 480, height: 360, framerate: 15, port: camDetails.camport });
    }
}

function stopCamera(camDetails) {
    if (broadcaster && broadcaster != null && broadcaster.isActive() && broadcaster.stopBroadcaster()) {
        broadcaster = null;
    }
}

function setSession(req, res, userId) {
    if (process.env.APPUSER && process.env.APPUSER !== userId) {
        userId = camData.getUserByHash(userId);
    }
    if (!_.isNil(userId)) {
        req.session.userId = userId;
        res.cookie('userId', userId, { signed: true, httpOnly: true });
        const userHash = commonutils.encryptString(uuidv4() + ":::" + camData.getMyCamDetails().id);
        camData.setUserHash(userId, userHash);
    } else {
        throw new Error('Invalid User Session');
    }
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

function findPeers() {
    peerUtils.findPeers(camData);
}

function isRemoteLoginSuccess(req) {
    return new Promise((resolve, reject) => {
        const hashInfo = commonutils.decryptString(req.query.remoteHash).split(':::');
        var remoteCamDetails = camData.getCamDetails(hashInfo[1]);
        var url = req.protocol + '://' + remoteCamDetails.ipAddress + ':' + remoteCamDetails.port + '/api/validatelogin?remoteHash=' + req.query.remoteHash;
        request.post({ url: url, json: true }, (err, response, body) => {
            if (err) return resolve(null);
            if (body && body.success === true && body.data && !_.isNil(body.data.userId) && body.data.userId !== '') {
                return resolve(body.data);
            } else {
                return resolve(null);
            }
        });
    });
}

module.exports.apilogin = apilogin;
module.exports.apistartcam = apistartcam;
module.exports.apistopcam = apistopcam;
module.exports.isValidCredentials = isValidCredentials;
module.exports.setSession = setSession;
module.exports.apigetcams = apigetcams;
module.exports.findPeers = findPeers;
module.exports.isRemoteLoginSuccess = isRemoteLoginSuccess;
module.exports.apivalidatelogin = apivalidatelogin;