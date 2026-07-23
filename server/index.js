'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const config = require('./config');
const { getDb } = require('./db/connection');
const quizzesRouter = require('./routes/quizzes');
const qrcodeRouter = require('./routes/qrcode');
const { registerHandlers } = require('./game/events');

// Inicializa o banco (cria arquivo + aplica schema) já no start.
getDb();

const app = express();
app.use(express.json());

// Frontend estático.
app.use(express.static(path.join(__dirname, '..', 'public')));

// API REST de quizzes (preparação com antecedência).
app.use('/api/quizzes', quizzesRouter);

// Geração de QR code (entrada dos jogadores por leitura no celular).
app.use('/api/qrcode', qrcodeRouter);

// Verificação de disponibilidade.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const server = http.createServer(app);
const io = new Server(server);

io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

server.listen(config.port, () => {
  console.log(`Questódia rodando em http://localhost:${config.port}`);
});

module.exports = { app, server };
