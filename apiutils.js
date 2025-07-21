require('dotenv').config();
const { is } = require('express/lib/request');
const _ = require('lodash');


function apilogin(req, res) {
    if (!_.isNil(req.body) && isValidCredentials(req.body.username, req.body.password)) {
        setSession(req, res, 'admin');
        res.status(200).json(constructResponse(true, { message: 'Login successful', userId: req.session.userId }, null));
    } else {
        res.status(200).json(constructResponse(false, null, 'Invalid username or password'));
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
module.exports.isValidCredentials = isValidCredentials;
module.exports.setSession = setSession;