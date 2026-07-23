'use strict';

const express = require('express');
const config = require('../config');
const quizRepository = require('../db/quiz-repository');

const router = express.Router();

// Valida o payload de um quiz. Retorna uma lista de mensagens (vazia = válido).
function validateQuizPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return ['corpo ausente ou inválido'];
  }
  if (typeof body.title !== 'string' || body.title.trim().length === 0) {
    errors.push('título é obrigatório');
  }
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    errors.push('o quiz precisa de ao menos uma pergunta');
    return errors;
  }

  body.questions.forEach((question, index) => {
    const label = `pergunta ${index + 1}`;
    if (typeof question.text !== 'string' || question.text.trim().length === 0) {
      errors.push(`${label}: enunciado é obrigatório`);
    }
    const time = Number(question.timeLimitSec);
    if (!Number.isInteger(time) || time < config.minTimeLimitSec || time > config.maxTimeLimitSec) {
      errors.push(
        `${label}: tempo deve ser inteiro entre ${config.minTimeLimitSec} e ${config.maxTimeLimitSec}s`
      );
    }
    if (!Array.isArray(question.options)) {
      errors.push(`${label}: opções ausentes`);
      return;
    }
    if (
      question.options.length < config.minOptionsPerQuestion ||
      question.options.length > config.maxOptionsPerQuestion
    ) {
      errors.push(
        `${label}: deve ter entre ${config.minOptionsPerQuestion} e ${config.maxOptionsPerQuestion} opções`
      );
    }
    const emptyOption = question.options.some(
      (o) => typeof o.text !== 'string' || o.text.trim().length === 0
    );
    if (emptyOption) {
      errors.push(`${label}: todas as opções precisam de texto`);
    }
    const correctCount = question.options.filter((o) => o.isCorrect === true).length;
    if (correctCount !== 1) {
      errors.push(`${label}: marque exatamente uma opção correta`);
    }
  });

  return errors;
}

// Normaliza o payload para o formato esperado pelo repositório.
function normalize(body) {
  return {
    title: body.title.trim(),
    questions: body.questions.map((q) => ({
      text: q.text.trim(),
      timeLimitSec: Number(q.timeLimitSec),
      options: q.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect === true })),
    })),
  };
}

// GET /api/quizzes — lista resumida de todos os quizzes (painel do master).
router.get('/', (req, res) => {
  return res.json(quizRepository.listQuizzes());
});

// POST /api/quizzes — cria e persiste um quiz.
router.post('/', (req, res) => {
  const errors = validateQuizPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'validation', details: errors });
  }
  const created = quizRepository.createQuiz(normalize(req.body));
  return res.status(201).json({
    id: created.id,
    managementCode: created.managementCode,
    manageUrl: `/host.html?code=${created.managementCode}`,
    title: created.title,
    questionCount: created.questionCount,
  });
});

// GET /api/quizzes/:managementCode — lê um quiz para edição/lançamento.
router.get('/:managementCode', (req, res) => {
  const quiz = quizRepository.getByManagementCode(req.params.managementCode);
  if (!quiz) {
    return res.status(404).json({ error: 'quiz_not_found' });
  }
  return res.json(quiz);
});

// PUT /api/quizzes/:managementCode — substitui o conteúdo do quiz.
router.put('/:managementCode', (req, res) => {
  const errors = validateQuizPayload(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'validation', details: errors });
  }
  const updated = quizRepository.updateByManagementCode(
    req.params.managementCode,
    normalize(req.body)
  );
  if (!updated) {
    return res.status(404).json({ error: 'quiz_not_found' });
  }
  return res.json(updated);
});

// DELETE /api/quizzes/:managementCode — remove o quiz (opcional).
router.delete('/:managementCode', (req, res) => {
  const removed = quizRepository.deleteByManagementCode(req.params.managementCode);
  if (!removed) {
    return res.status(404).json({ error: 'quiz_not_found' });
  }
  return res.status(204).send();
});

module.exports = router;
