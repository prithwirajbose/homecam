const http    = require('http');
const express = require('express');

const Broadcaster = require('./libcamera-broadcaster');

const app = express();
app.use(express.static(__dirname + '/site'));
const httpServer = http.createServer(app);
httpServer.listen(3000);

console.log("Creating new broadcaster");
new Broadcaster({width: 320, height: 240, framerate: 15, port:8080});
