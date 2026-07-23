'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

let db = null;

// Abre a conexão SQLite (uma única para o processo), garante a pasta do arquivo,
// habilita as foreign keys e aplica o schema. Idempotente.
function getDb() {
  if (db) {
    return db;
  }

  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(config.schemaPath, 'utf8');
  db.exec(schema);

  return db;
}

module.exports = { getDb };
