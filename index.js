require('dotenv').config();
const http = require('http'),
    express = require('express'),
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    path = require('path'),
    _ = require('lodash'),
    Broadcaster = require('./libcamera-broadcaster'),
    apiutils = require('./apiutils');
var broadcaster = null;

const app = express();
app.use(cookieParser(process.env.COOKIE_SIGN_SECRET));
app.use(session({
    secret: process.env.COOKIE_SIGN_SECRET, // A secret string used to sign the session ID cookie
    resave: false, // Don't save session if unmodified
    saveUninitialized: true, // Save new sessions that have not been modified
    cookie: { secure: false } // Set to true in production with HTTPS
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(isAuthenticated);

app.use(express.static(__dirname + '/site'));

app.post('/api/:apiname', (req, res) => {
    if (!_.isNil(req.params.apiname) && typeof (apiutils['api' + req.params.apiname]) === 'function') {
        apiutils['api' + req.params.apiname](req, res);
    } else {
        res.status(404).json({ success: false, error: 'API not found' });
    }
});

app.get('/logout', (req, res) => {
    req.session.userId = null;
    res.cookie('userId', null, { signed: true, httpOnly: true });
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            res.status(500).json({ success: false, error: 'Failed to log out' });
        } else {
            res.clearCookie('userId');
            res.redirect('/login');
        }
    });
});


app.get('/:pagename', (req, res) => {
    if (!_.isNil(req.params.pagename) && req.params.pagename != '') {
        var exactPath = path.join(__dirname, 'site', req.params.pagename);
        if (fs.existsSync(exactPath)) {
            res.sendFile(exactPath);
        } else if (fs.existsSync(exactPath + '.html')) {
            res.sendFile(exactPath + '.html');
        } else {
            res.status(404).send('Page not found');
        }
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

function isAuthenticated(req, res, next) {
    if (req.originalUrl === '/login' || req.originalUrl === '/api/login' || (!_.isNil(req.signedCookies) && req.signedCookies !== false && !_.isNil(req.signedCookies.userId) && !_.isNil(req.session) && !_.isNil(req.session.userId) && req.signedCookies.userId == req.session.userId)) {
        return next();
    } else if (!_.isNil(req.signedCookies) && req.signedCookies !== false && !_.isNil(req.signedCookies.userId) && req.signedCookies.userId == process.env.USERNAME) {
        apiutils.setSession(req, res, req.signedCookies.userId);
        return next();
    } else {
        res.redirect('/login');
    }
}

const server = http.createServer(app);
server.listen(8080, () => {
    console.log('Server is listening on port 8080');
    broadcaster = new Broadcaster({ width: 320, height: 240, framerate: 15, port: 3000 });
});