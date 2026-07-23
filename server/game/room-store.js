'use strict';

const crypto = require('crypto');
const config = require('../config');
const { Room } = require('./room');

// Repositório em memória das partidas ao vivo (code -> Room).
const rooms = new Map();

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateCode() {
  let code = '';
  const bytes = crypto.randomBytes(config.roomCodeLength);
  for (let i = 0; i < config.roomCodeLength; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

function uniqueCode() {
  let code = generateCode();
  while (rooms.has(code)) {
    code = generateCode();
  }
  return code;
}

// Cria uma partida a partir de um quiz carregado do banco.
function createRoom(quiz) {
  const code = uniqueCode();
  const room = new Room(code, quiz);
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get(String(code || '').toUpperCase()) || null;
}

function removeRoom(code) {
  rooms.delete(code);
}

// Localiza a partida que contém um determinado socket (para desconexões).
function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.hostId === socketId) {
      return { room, role: 'host' };
    }
    for (const player of room.players.values()) {
      if (player.socketId === socketId) {
        return { room, role: 'player' };
      }
    }
  }
  return null;
}

module.exports = { createRoom, getRoom, removeRoom, findRoomBySocket };
