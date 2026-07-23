'use strict';

const roomStore = require('./room-store');
const quizRepository = require('../db/quiz-repository');
const { GameError } = require('./room');

// Cronômetros de encerramento por pergunta (code -> timeout).
const questionTimers = new Map();

function clearQuestionTimer(code) {
  const timer = questionTimers.get(code);
  if (timer) {
    clearTimeout(timer);
    questionTimers.delete(code);
  }
}

// Traduz erros de domínio em ack padronizado; relança erros inesperados.
function ackError(error, ack) {
  if (error instanceof GameError) {
    if (typeof ack === 'function') {
      ack({ ok: false, error: error.code });
    }
    return;
  }
  throw error;
}

function registerHandlers(io, socket) {
  // --- Master: lançar e conduzir -----------------------------------------

  socket.on('host:launchRoom', (payload = {}, ack) => {
    const quiz = quizRepository.getByManagementCode(payload.managementCode);
    if (!quiz) {
      return ack && ack({ ok: false, error: 'quiz_not_found' });
    }
    if (quiz.questions.length === 0) {
      return ack && ack({ ok: false, error: 'empty_quiz' });
    }
    const room = roomStore.createRoom(quiz);
    room.hostId = socket.id;
    socket.join(room.code);
    return (
      ack &&
      ack({
        ok: true,
        code: room.code,
        quizTitle: room.quizTitle,
        questionCount: quiz.questions.length,
      })
    );
  });

  // Reatar o master a uma partida preservada (após recarregar/reconectar).
  socket.on('host:reattach', (payload = {}, ack) => {
    const room = roomStore.getRoom(payload.code);
    if (!room) {
      return ack && ack({ ok: false, error: 'room_not_found' });
    }
    room.hostId = socket.id;
    socket.join(room.code);
    return ack && ack({ ok: true, phase: room.phase, code: room.code, quizTitle: room.quizTitle });
  });

  socket.on('host:startGame', (payload = {}, ack) => {
    const room = roomStore.getRoom(payload.code);
    if (!room || room.hostId !== socket.id) {
      return ack && ack({ ok: false, error: 'not_host' });
    }
    if (room.phase !== 'lobby') {
      return ack && ack({ ok: false, error: 'not_lobby' });
    }
    if (room.questions.length === 0) {
      return ack && ack({ ok: false, error: 'no_questions' });
    }
    presentQuestion(io, room, 0);
    return ack && ack({ ok: true });
  });

  socket.on('host:nextQuestion', (payload = {}, ack) => {
    const room = roomStore.getRoom(payload.code);
    if (!room || room.hostId !== socket.id) {
      return ack && ack({ ok: false, error: 'not_host' });
    }
    if (room.hasMoreQuestions()) {
      presentQuestion(io, room, room.currentQuestionIndex + 1);
      return ack && ack({ ok: true, finished: false });
    }
    broadcastPodium(io, room);
    return ack && ack({ ok: true, finished: true });
  });

  socket.on('host:endGame', (payload = {}, ack) => {
    const room = roomStore.getRoom(payload.code);
    if (!room || room.hostId !== socket.id) {
      return ack && ack({ ok: false, error: 'not_host' });
    }
    broadcastPodium(io, room);
    return ack && ack({ ok: true });
  });

  // --- Jogador: entrar e responder ---------------------------------------

  socket.on('player:join', (payload = {}, ack) => {
    const room = roomStore.getRoom(payload.code);
    if (!room) {
      return ack && ack({ ok: false, error: 'room_not_found' });
    }
    try {
      let player;
      if (payload.playerToken && room.players.has(payload.playerToken)) {
        player = room.reconnect(payload.playerToken, socket.id);
      } else {
        player = room.addPlayer(payload.nickname, socket.id);
      }
      socket.join(room.code);
      io.to(room.code).emit('lobby:update', {
        players: room.lobbyPlayers(),
        count: room.players.size,
      });
      return (
        ack && ack({ ok: true, playerToken: player.token, state: room.snapshotFor(player.token) })
      );
    } catch (error) {
      return ackError(error, ack);
    }
  });

  socket.on('player:answer', (payload = {}, ack) => {
    const room = roomStore.getRoom(payload.code);
    if (!room) {
      return ack && ack({ ok: false, error: 'room_not_found' });
    }
    try {
      room.recordAnswer(payload.playerToken, payload.optionId, Date.now());
      if (typeof ack === 'function') {
        ack({ ok: true, received: true });
      }
      if (room.allConnectedAnswered()) {
        revealQuestion(io, room);
      }
    } catch (error) {
      return ackError(error, ack);
    }
  });

  // --- Desconexão --------------------------------------------------------

  socket.on('disconnect', () => {
    const found = roomStore.findRoomBySocket(socket.id);
    if (!found) {
      return;
    }
    const { room, role } = found;
    if (role === 'host') {
      // Preserva a partida em memória (pontuações intactas) até o master reatar.
      room.hostId = null;
      return;
    }
    room.markDisconnected(socket.id);
    io.to(room.code).emit('lobby:update', {
      players: room.lobbyPlayers(),
      count: room.players.size,
    });
  });
}

// Apresenta uma pergunta e agenda o encerramento automático por tempo.
function presentQuestion(io, room, index) {
  clearQuestionTimer(room.code);
  room.startQuestion(index);
  const question = room.currentQuestion();
  io.to(room.code).emit('game:question', room.questionPayload());
  const timer = setTimeout(() => revealQuestion(io, room), question.timeLimitSec * 1000);
  questionTimers.set(room.code, timer);
}

// Encerra a pergunta atual, calcula pontos e envia o reveal (feedback + ranking).
function revealQuestion(io, room) {
  if (room.phase !== 'question') {
    return;
  }
  clearQuestionTimer(room.code);
  const question = room.currentQuestion();
  room.closeQuestion();

  const base = {
    correctOptionId: question.correctOptionId,
    distribution: room.distribution(),
    ranking: room.ranking(),
  };

  // Master vê o resultado agregado; cada jogador recebe seu feedback individual.
  if (room.hostId) {
    io.to(room.hostId).emit('game:reveal', base);
  }
  for (const player of room.players.values()) {
    if (!player.connected || !player.socketId) {
      continue;
    }
    const answer = room.answersThisQuestion.get(player.token);
    const you = answer
      ? { correct: answer.correct, pointsAwarded: answer.pointsAwarded }
      : { correct: false, pointsAwarded: 0 };
    io.to(player.socketId).emit('game:reveal', { ...base, you });
  }
}

// Finaliza a partida e transmite o pódio (1º/2º/3º) e o ranking completo.
// Se houver uma pergunta em andamento (encerramento antecipado pelo master),
// pontua-a antes de fechar para não perder as respostas já enviadas.
function broadcastPodium(io, room) {
  clearQuestionTimer(room.code);
  if (room.phase === 'question') {
    room.closeQuestion();
  }
  room.finish();
  io.to(room.code).emit('game:podium', {
    podium: room.podium(),
    fullRanking: room.ranking(),
  });
}

module.exports = { registerHandlers };
