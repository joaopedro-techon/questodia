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

  // --- Reveal / Placar ---------------------------------------------------
  // Guarda a posição de cada jogador no reveal anterior para mostrar subida/queda.
  let previousRanks = {};

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

    renderLeaderSpotlight($('leaderSpotlight'), payload.ranking);
    renderRankingList($('playRanking'), payload.ranking);
    renderMyStanding($('myStanding'), payload.ranking);

    // Atualiza o histórico de posições para o próximo reveal.
    previousRanks = {};
    payload.ranking.forEach((entry) => {
      previousRanks[entry.nickname] = entry.rank;
    });
  }

  // Destaque do líder (ou parabéns se for você).
  function renderLeaderSpotlight(el, ranking) {
    const leader = ranking[0];
    if (!leader) {
      el.innerHTML = '';
      return;
    }
    const iAmLeader = leader.nickname === myNickname;
    el.innerHTML = iAmLeader
      ? `<span class="crown">👑</span><div><div class="leader-name">Você está na frente! 🎉</div><div class="leader-score">${leader.score} pts</div></div>`
      : `<span class="crown">👑</span><div><div class="leader-name">${escapeHtml(leader.nickname)}</div><div class="leader-score">${leader.score} pts na liderança</div></div>`;
  }

  // Indicador de movimento de posição desde o reveal anterior.
  function moveIndicator(nickname, rank) {
    const before = previousRanks[nickname];
    if (before === undefined) {
      return '<span class="rank-move new">novo</span>';
    }
    if (rank < before) {
      return `<span class="rank-move up">▲${before - rank}</span>`;
    }
    if (rank > before) {
      return `<span class="rank-move down">▼${rank - before}</span>`;
    }
    return '<span class="rank-move same">–</span>';
  }

  function renderRankingList(listEl, ranking) {
    listEl.innerHTML = '';
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    ranking.forEach((entry) => {
      const li = document.createElement('li');
      const isMe = entry.nickname === myNickname;
      if (isMe) {
        li.className = 'me';
      }
      const badge = medals[entry.rank] || entry.rank;
      li.innerHTML = `<span class="pos">${badge}</span>${moveIndicator(entry.nickname, entry.rank)}<span class="rank-name">${escapeHtml(entry.nickname)}${isMe ? ' (você)' : ''}</span><div class="spacer"></div><strong>${entry.score}</strong>`;
      listEl.appendChild(li);
    });
  }

  function renderMyStanding(el, ranking) {
    const mine = ranking.find((r) => r.nickname === myNickname);
    if (!mine) {
      el.textContent = '';
      return;
    }
    const total = ranking.length;
    let movement = '';
    const before = previousRanks[mine.nickname];
    if (before !== undefined && mine.rank < before) {
      movement = ` — você subiu ${before - mine.rank} posição(ões)! 🔥`;
    } else if (before !== undefined && mine.rank > before) {
      movement = ` — você caiu ${mine.rank - before} posição(ões).`;
    }
    el.textContent = `Você está em ${mine.rank}º de ${total} · ${mine.score} pts${movement}`;
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
