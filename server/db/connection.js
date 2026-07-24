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
  applyMigrations(db);

  return db;
}

// Migrações leves e idempotentes para bancos criados antes de uma coluna existir.
function applyMigrations(db) {
  const columns = db
    .prepare('PRAGMA table_info(quizzes)')
    .all()
    .map((c) => c.name);
  if (!columns.includes('password_hash')) {
    db.exec('ALTER TABLE quizzes ADD COLUMN password_hash TEXT');
  }
  if (!columns.includes('password_salt')) {
    db.exec('ALTER TABLE quizzes ADD COLUMN password_salt TEXT');
  }
}

module.exports = { getDb };
