'use strict';

const crypto = require('crypto');
const config = require('../config');
const scoring = require('./scoring');

// Erro de domínio com um código legível para o cliente (ver contratos).
class GameError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// Converte um quiz persistido (do repositório) em perguntas carregadas em memória.
// Mantém o correctOptionId apenas no servidor; não é enviado ao jogador antes do reveal.
function loadQuestions(quiz) {
  return quiz.questions.map((q) => {
    const options = q.options.map((o) => ({ id: String(o.id), text: o.text }));
    const correct = q.options.find((o) => o.isCorrect);
    return {
      id: String(q.id),
      text: q.text,
      timeLimitSec: q.timeLimitSec,
      options,
      correctOptionId: correct ? String(correct.id) : null,
    };
  });
}

class Room {
  constructor(code, quiz) {
    this.code = code;
    this.quizId = quiz.id;
    this.quizTitle = quiz.title;
    this.hostId = null;
    this.players = new Map(); // token -> player
    this.questions = loadQuestions(quiz);
    this.phase = 'lobby';
    this.currentQuestionIndex = -1;
    this.questionStartedAt = null;
    this.answersThisQuestion = new Map(); // token -> answer
  }

  // --- Jogadores ---------------------------------------------------------

  addPlayer(nickname, socketId) {
    const clean = String(nickname || '').trim();
    if (clean.length === 0 || clean.length > config.maxNicknameLength) {
      throw new GameError('invalid_nickname');
    }
    if (this.players.size >= config.maxPlayersPerRoom) {
      throw new GameError('room_full');
    }
    const taken = [...this.players.values()].some(
      (p) => p.nickname.toLowerCase() === clean.toLowerCase()
    );
    if (taken) {
      throw new GameError('nickname_taken');
    }
    const player = {
      token: crypto.randomUUID(),
      nickname: clean,
      socketId,
      score: 0,
      totalResponseTimeMs: 0,
      connected: true,
    };
    this.players.set(player.token, player);
    return player;
  }

  reconnect(token, socketId) {
    const player = this.players.get(token);
    if (!player) {
      throw new GameError('player_not_found');
    }
    player.socketId = socketId;
    player.connected = true;
    return player;
  }

  markDisconnected(socketId) {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        player.connected = false;
        player.socketId = null;
        return player;
      }
    }
    return null;
  }

  lobbyPlayers() {
    return [...this.players.values()].map((p) => ({
      nickname: p.nickname,
      connected: p.connected,
    }));
  }

  connectedCount() {
    return [...this.players.values()].filter((p) => p.connected).length;
  }

  // --- Fluxo das perguntas ----------------------------------------------

  currentQuestion() {
    if (this.currentQuestionIndex < 0) {
      return null;
    }
    return this.questions[this.currentQuestionIndex] || null;
  }

  startQuestion(index) {
    this.currentQuestionIndex = index;
    this.phase = 'question';
    this.questionStartedAt = Date.now();
    this.answersThisQuestion = new Map();
  }

  // Payload público da pergunta (sem revelar a correta).
  questionPayload() {
    const q = this.currentQuestion();
    return {
      index: this.currentQuestionIndex,
      total: this.questions.length,
      text: q.text,
      options: q.options,
      timeLimitSec: q.timeLimitSec,
      serverStartMs: this.questionStartedAt,
    };
  }

  recordAnswer(token, optionId, nowMs) {
    if (this.phase !== 'question') {
      throw new GameError('not_active');
    }
    const player = this.players.get(token);
    if (!player) {
      throw new GameError('player_not_found');
    }
    const q = this.currentQuestion();
    const elapsed = nowMs - this.questionStartedAt;
    if (elapsed > q.timeLimitSec * 1000) {
      throw new GameError('too_late');
    }
    if (this.answersThisQuestion.has(token)) {
      throw new GameError('already_answered');
    }
    this.answersThisQuestion.set(token, {
      playerToken: token,
      optionId: String(optionId),
      answeredAtMs: nowMs,
      responseTimeMs: elapsed,
      correct: false,
      pointsAwarded: 0,
    });
  }

  allConnectedAnswered() {
    const connected = this.connectedCount();
    return connected > 0 && this.answersThisQuestion.size >= connected;
  }

  // Encerra a pergunta, calcula pontos e distribui a atualização de estado.
  closeQuestion() {
    if (this.phase !== 'question') {
      return;
    }
    const q = this.currentQuestion();
    for (const answer of this.answersThisQuestion.values()) {
      answer.correct = answer.optionId === q.correctOptionId;
      answer.pointsAwarded = scoring.computePoints(
        answer.correct,
        answer.responseTimeMs,
        q.timeLimitSec
      );
      const player = this.players.get(answer.playerToken);
      if (player) {
        player.score += answer.pointsAwarded;
        player.totalResponseTimeMs += answer.responseTimeMs;
      }
    }
    this.phase = 'reveal';
  }

  // Contagem de respostas por opção da pergunta atual.
  distribution() {
    const dist = {};
    const q = this.currentQuestion();
    for (const option of q.options) {
      dist[option.id] = 0;
    }
    for (const answer of this.answersThisQuestion.values()) {
      if (dist[answer.optionId] !== undefined) {
        dist[answer.optionId] += 1;
      }
    }
    return dist;
  }

  hasMoreQuestions() {
    return this.currentQuestionIndex < this.questions.length - 1;
  }

  finish() {
    this.phase = 'finished';
  }

  // --- Ranking / pódio ---------------------------------------------------

  ranking() {
    return scoring.buildRanking([...this.players.values()]);
  }

  podium() {
    return scoring.buildPodium(this.ranking());
  }

  // Estado atual para um jogador (reconexão).
  snapshotFor(token) {
    const player = this.players.get(token);
    const snapshot = {
      phase: this.phase,
      score: player ? player.score : 0,
      currentQuestion: null,
      alreadyAnswered: false,
    };
    if (this.phase === 'question') {
      snapshot.currentQuestion = this.questionPayload();
      snapshot.alreadyAnswered = this.answersThisQuestion.has(token);
    }
    return snapshot;
  }
}

module.exports = { Room, GameError };
