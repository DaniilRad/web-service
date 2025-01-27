const express = require('express');
const uploadRouter = require('./api/upload');

const app = express();

app.use(express.json());
app.use('/api/upload', uploadRouter);

module.exports = app;
