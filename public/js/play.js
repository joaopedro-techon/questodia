'use strict';

(function () {
  const { socket, emitAsync } = window.QuestodiaClient.createClient();

  const $ = (id) => document.getElementById(id);

  // --- Estado ------------------------------------------------------------
  let roomCode = (new URLSearchParams(window.location.search).get('code') || '').toUpperCase();
  let playerToken = null;
  let myNickname = null;
  let currentOptions = [];
  let timerInterval = null;

  function tokenKey(code) {
    return `questodia_token_${code}`;
  }

  function showSection(id) {
    ['join', 'wait', 'play', 'reveal', 'podium'].forEach((s) => $(s).classList.add('hidden'));
    $(id).classList.remove('hidden');
  }

  function showAlert(message, type) {
    $('alert').innerHTML = `<div class="notice ${type}">${message}</div>`;
    if (type === 'ok') {
      setTimeout(() => ($('alert').innerHTML = ''), 3500);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Entrar ------------------------------------------------------------
  async function join(reconnectToken) {
    const code = $('code').value.trim().toUpperCase() || roomCode;
    const nickname = $('nickname').value.trim();
    if (!code || (!nickname && !reconnectToken)) {
      showAlert('Informe o código e um apelido.', 'error');
      return;
    }
    roomCode = code;
    const response = await emitAsync('player:join', {
      code,
      nickname,
      playerToken: reconnectToken || null,
    });
    if (!response.ok) {
      const messages = {
        room_not_found: 'Sala não encontrada.',
        nickname_taken: 'Este apelido já está em uso. Escolha outro.',
        room_full: 'A sala está cheia (200 jogadores).',
        invalid_nickname: 'Apelido inválido.',
      };
      showAlert(messages[response.error] || `Erro: ${response.error}`, 'error');
      return;
    }
    playerToken = response.playerToken;
    myNickname = nickname || myNickname;
    localStorage.setItem(tokenKey(code), playerToken);
    applyState(response.state);
  }

  // Aplica o snapshot inicial (útil na reconexão no meio da partida).
  function applyState(state) {
    $('waitNick').textContent = myNickname || '(você)';
    if (state && state.phase === 'question' && state.currentQuestion) {
      renderQuestion(state.currentQuestion, state.alreadyAnswered);
    } else if (state && state.phase === 'finished') {
      showAlert('A partida já foi encerrada.', 'ok');
      showSection('wait');
    } else {
      showSection('wait');
    }
  }

  // --- Pergunta ----------------------------------------------------------
  function renderQuestion(payload, alreadyAnswered) {
    currentOptions = payload.options;
    showSection('play');
    $('playCounter').textContent = `Pergunta ${payload.index + 1} de ${payload.total}`;
    $('playQuestionText').textContent = payload.text;
    $('answeredNote').textContent = alreadyAnswered ? 'Resposta registrada! Aguardando…' : '';

    const optsBox = $('playOptions');
    optsBox.innerHTML = '';
    payload.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.textContent = opt.text;
      btn.disabled = alreadyAnswered;
      btn.addEventListener('click', () => sendAnswer(opt.id, optsBox));
      optsBox.appendChild(btn);
    });

    startCountdown(payload.timeLimitSec);
  }

  async function sendAnswer(optionId, optsBox) {
    [...optsBox.children].forEach((btn) => {
      btn.disabled = true;
      if (btn.textContent !== findOptionText(optionId)) {
        btn.classList.add('dim');
      }
    });
    $('answeredNote').textContent = 'Resposta registrada! Aguardando…';
    const response = await emitAsync('player:answer', {
      code: roomCode,
      playerToken,
      optionId,
    });
    if (!response.ok && response.error !== 'already_answered') {
      showAlert(`Não foi possível responder: ${response.error}`, 'error');
    }
  }

  function findOptionText(optionId) {
    const opt = currentOptions.find((o) => o.id === optionId);
    return opt ? opt.text : '';
  }

  function startCountdown(seconds) {
    stopCountdown();
    let remaining = seconds;
    $('playTimer').textContent = `⏱ ${remaining}s`;
    timerInterval = setInterval(() => {
      remaining -= 1;
      $('playTimer').textContent = remaining > 0 ? `⏱ ${remaining}s` : 'Tempo esgotado';
      if (remaining <= 0) {
        stopCountdown();
      }
    }, 1000);
  }

  function stopCountdown() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // --- Reveal ------------------------------------------------------------
  function onReveal(payload) {
    stopCountdown();
    showSection('reveal');

    const box = $('feedbackBox');
    if (payload.you && payload.you.correct) {
      box.className = 'feedback correct';
      box.textContent = `✅ Acertou! +${payload.you.pointsAwarded} pontos`;
    } else {
      box.className = 'feedback wrong';
      box.textContent = '❌ Não foi dessa vez';
    }

    const mine = payload.ranking.find((r) => r.nickname === myNickname);
    $('myRank').textContent = mine ? `${mine.rank}º` : '—';
    $('myScore').textContent = mine ? mine.score : 0;
    renderRankingList($('playRanking'), payload.ranking);
  }

  function renderRankingList(listEl, ranking) {
    listEl.innerHTML = '';
    ranking.forEach((entry) => {
      const li = document.createElement('li');
      const isMe = entry.nickname === myNickname;
      li.innerHTML = `<span class="pos">${entry.rank}</span><span>${escapeHtml(entry.nickname)}${isMe ? ' (você)' : ''}</span><div class="spacer"></div><strong>${entry.score}</strong>`;
      listEl.appendChild(li);
    });
  }

  // --- Pódio -------------------------------------------------------------
  function onPodium(payload) {
    stopCountdown();
    showSection('podium');
    renderPodium(payload.podium);
    renderRankingList($('fullRanking'), payload.fullRanking);
  }

  function renderPodium(podium) {
    const box = $('podiumBox');
    box.innerHTML = '';
    const order = [1, 0, 2];
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    order.forEach((idx) => {
      const entry = podium[idx];
      if (!entry) {
        return;
      }
      const place = document.createElement('div');
      place.className = `place p${entry.rank}`;
      place.innerHTML = `<div class="medal">${medals[entry.rank] || ''}</div><div class="name">${escapeHtml(entry.nickname)}</div><div class="score">${entry.score} pts</div>`;
      box.appendChild(place);
    });
  }

  // --- Eventos de socket -------------------------------------------------
  socket.on('game:question', (payload) => renderQuestion(payload, false));
  socket.on('game:reveal', onReveal);
  socket.on('game:podium', onPodium);
  socket.on('room:closed', () => {
    showAlert('A sala foi encerrada pelo master.', 'error');
    showSection('join');
  });

  // --- Início ------------------------------------------------------------
  $('joinBtn').addEventListener('click', () => join(null));
  if (roomCode) {
    $('code').value = roomCode;
    const savedToken = localStorage.getItem(tokenKey(roomCode));
    if (savedToken) {
      join(savedToken);
    }
  }
})();
