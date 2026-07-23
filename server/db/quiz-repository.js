'use strict';

const crypto = require('crypto');
const config = require('../config');
const { getDb } = require('./connection');

function nowIso() {
  return new Date().toISOString();
}

function generateManagementCode() {
  return (
    config.managementCodePrefix + crypto.randomBytes(config.managementCodeBytes).toString('hex')
  );
}

// Insere as perguntas e opções de um quiz já existente (dentro de uma transação).
function insertQuestions(db, quizId, questions) {
  const insertQuestion = db.prepare(
    'INSERT INTO questions (quiz_id, text, time_limit_sec, position) VALUES (?, ?, ?, ?)'
  );
  const insertOption = db.prepare(
    'INSERT INTO answer_options (question_id, text, is_correct, position) VALUES (?, ?, ?, ?)'
  );
  questions.forEach((question, qIndex) => {
    const result = insertQuestion.run(quizId, question.text, question.timeLimitSec, qIndex);
    const questionId = result.lastInsertRowid;
    question.options.forEach((option, oIndex) => {
      insertOption.run(questionId, option.text, option.isCorrect ? 1 : 0, oIndex);
    });
  });
}

// Cria e persiste um novo quiz. Retorna dados essenciais + código de gestão.
function createQuiz({ title, questions }) {
  const db = getDb();
  const managementCode = generateManagementCode();
  const timestamp = nowIso();

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        'INSERT INTO quizzes (title, management_code, created_at, updated_at) VALUES (?, ?, ?, ?)'
      )
      .run(title, managementCode, timestamp, timestamp);
    const quizId = result.lastInsertRowid;
    insertQuestions(db, quizId, questions);
    return quizId;
  });

  const id = tx();
  return { id, managementCode, title, questionCount: questions.length };
}

// Lê um quiz completo (com perguntas e opções) pelo código de gestão.
function getByManagementCode(managementCode) {
  const db = getDb();
  const quiz = db.prepare('SELECT * FROM quizzes WHERE management_code = ?').get(managementCode);
  if (!quiz) {
    return null;
  }

  const questions = db
    .prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY position')
    .all(quiz.id);
  const optionStmt = db.prepare(
    'SELECT * FROM answer_options WHERE question_id = ? ORDER BY position'
  );

  return {
    id: quiz.id,
    title: quiz.title,
    managementCode: quiz.management_code,
    createdAt: quiz.created_at,
    updatedAt: quiz.updated_at,
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      timeLimitSec: q.time_limit_sec,
      position: q.position,
      options: optionStmt.all(q.id).map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.is_correct === 1,
        position: o.position,
      })),
    })),
  };
}

// Substitui integralmente o conteúdo do quiz (título + perguntas/opções).
function updateByManagementCode(managementCode, { title, questions }) {
  const db = getDb();
  const quiz = db.prepare('SELECT id FROM quizzes WHERE management_code = ?').get(managementCode);
  if (!quiz) {
    return null;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(quiz.id);
    db.prepare('UPDATE quizzes SET title = ?, updated_at = ? WHERE id = ?').run(
      title,
      nowIso(),
      quiz.id
    );
    insertQuestions(db, quiz.id, questions);
  });
  tx();

  return getByManagementCode(managementCode);
}

function deleteByManagementCode(managementCode) {
  const db = getDb();
  const result = db.prepare('DELETE FROM quizzes WHERE management_code = ?').run(managementCode);
  return result.changes > 0;
}

// Lista resumida de todos os quizzes (para o painel do master recuperar códigos perdidos).
function listQuizzes() {
  const db = getDb();
  return db
    .prepare(
      `SELECT q.id, q.title, q.management_code, q.created_at, q.updated_at,
              (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count
       FROM quizzes q
       ORDER BY q.updated_at DESC`
    )
    .all()
    .map((row) => ({
      id: row.id,
      title: row.title,
      managementCode: row.management_code,
      questionCount: row.question_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
}

module.exports = {
  createQuiz,
  getByManagementCode,
  updateByManagementCode,
  deleteByManagementCode,
  listQuizzes,
};
