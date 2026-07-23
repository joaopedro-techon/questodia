'use strict';

const path = require('path');

// Constantes centrais do Questódia. Manter valores mágicos aqui (Princípio II).
const config = {
  // Rede
  port: Number(process.env.PORT) || 3000,

  // Capacidade
  maxPlayersPerRoom: 200,

  // Códigos
  roomCodeLength: 6, // código de sala público (join)
  managementCodePrefix: 'qz_', // código de gestão secreto do quiz
  managementCodeBytes: 8, // bytes aleatórios -> 16 chars hex

  // Pontuação
  basePoints: 1000, // pontos máximos por acerto instantâneo
  minCorrectFraction: 0.5, // piso garantido ao acertar (metade da base)

  // Perguntas
  defaultTimeLimitSec: 20,
  minTimeLimitSec: 5,
  maxTimeLimitSec: 120,
  minOptionsPerQuestion: 2,
  maxOptionsPerQuestion: 4,

  // Jogador
  maxNicknameLength: 20,

  // Banco de dados
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'questodia.db'),
  schemaPath: path.join(__dirname, 'db', 'schema.sql'),
};

module.exports = config;
