'use strict';

(function () {
  const { socket, emitAsync } = window.QuestodiaClient.createClient();

  // --- Estado ------------------------------------------------------------
  let managementCode = new URLSearchParams(window.location.search).get('code') || null;
  let quizPassword = null; // senha de gestão verificada (para editar/salvar)
  let roomCode = null;
  let currentOptions = []; // opções da pergunta ao vivo atual (para o reveal)
  let timerInterval = null;

  const builderQuestions = [];

  // --- Utilidades de UI --------------------------------------------------
  const $ = (id) => document.getElementById(id);

  function showSection(id) {
    ['builder', 'lobby', 'live', 'podium'].forEach((s) => $(s).classList.add('hidden'));
    $(id).classList.remove('hidden');
  }

  function showAlert(message, type) {
    $('alert').innerHTML = `<div class="notice ${type}">${message}</div>`;
    if (type === 'ok') {
      setTimeout(() => ($('alert').innerHTML = ''), 4000);
    }
  }

  function newBlankQuestion() {
    return {
      text: '',
      timeLimitSec: 20,
      options: [
        { text: '', isCorrect: true },
        { text: '', isCorrect: false },
      ],
    };
  }

  // --- Montador de quiz --------------------------------------------------
  function renderBuilder() {
    const container = $('questions');
    container.innerHTML = '';
    builderQuestions.forEach((question, qi) => {
      container.appendChild(renderQuestion(question, qi));
    });
  }

  function renderQuestion(question, qi) {
    const box = document.createElement('div');
    box.className = 'builder-question';

    const header = document.createElement('div');
    header.className = 'row';
    header.innerHTML = `<strong>Pergunta ${qi + 1}</strong>`;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'ghost small';
    removeBtn.textContent = 'Remover';
    removeBtn.addEventListener('click', () => {
      builderQuestions.splice(qi, 1);
      renderBuilder();
    });
    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    header.appendChild(spacer);
    header.appendChild(removeBtn);
    box.appendChild(header);

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.placeholder = 'Enunciado da pergunta';
    textInput.value = question.text;
    textInput.addEventListener('input', (e) => (question.text = e.target.value));
    box.appendChild(labelled('Enunciado', textInput));

    const timeInput = document.createElement('input');
    timeInput.type = 'number';
    timeInput.min = '5';
    timeInput.max = '120';
    timeInput.value = question.timeLimitSec;
    timeInput.addEventListener('input', (e) => (question.timeLimitSec = Number(e.target.value)));
    box.appendChild(labelled('Tempo (segundos)', timeInput));

    const optsLabel = document.createElement('label');
    optsLabel.textContent = 'Opções (marque a correta)';
    box.appendChild(optsLabel);

    question.options.forEach((option, oi) => {
      box.appendChild(renderOption(question, qi, option, oi));
    });

    const addOpt = document.createElement('button');
    addOpt.className = 'ghost small';
    addOpt.textContent = '+ Opção';
    addOpt.disabled = question.options.length >= 4;
    addOpt.addEventListener('click', () => {
      question.options.push({ text: '', isCorrect: false });
      renderBuilder();
    });
    box.appendChild(addOpt);

    return box;
  }

  function renderOption(question, qi, option, oi) {
    const row = document.createElement('div');
    row.className = 'builder-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `correct-${qi}`;
    radio.checked = option.isCorrect;
    radio.addEventListener('change', () => {
      question.options.forEach((o) => (o.isCorrect = false));
      option.isCorrect = true;
    });
    row.appendChild(radio);

    const text = document.createElement('input');
    text.type = 'text';
    text.placeholder = `Opção ${oi + 1}`;
    text.value = option.text;
    text.addEventListener('input', (e) => (option.text = e.target.value));
    row.appendChild(text);

    if (question.options.length > 2) {
      const rm = document.createElement('button');
      rm.className = 'ghost small';
      rm.textContent = '✕';
      rm.addEventListener('click', () => {
        question.options.splice(oi, 1);
        if (!question.options.some((o) => o.isCorrect)) {
          question.options[0].isCorrect = true;
        }
        renderBuilder();
      });
      row.appendChild(rm);
    }

    return row;
  }

  function labelled(labelText, input) {
    const frag = document.createDocumentFragment();
    const label = document.createElement('label');
    label.textContent = labelText;
    frag.appendChild(label);
    frag.appendChild(input);
    return frag;
  }

  function collectQuiz() {
    return {
      title: $('quizTitle').value.trim(),
      questions: builderQuestions.map((q) => ({
        text: q.text.trim(),
        timeLimitSec: Number(q.timeLimitSec),
        options: q.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
      })),
    };
  }

  async function saveQuiz() {
    const payload = collectQuiz();
    const isUpdate = Boolean(managementCode);

    if (!isUpdate) {
      // Criando: o master escolhe a senha de gestão.
      const chosen = $('quizPassword').value;
      if (!chosen || chosen.length < 4) {
        showAlert('Defina uma senha de gestão com pelo menos 4 caracteres.', 'error');
        return;
      }
      payload.password = chosen;
    }

    const url = isUpdate ? `/api/quizzes/${managementCode}` : '/api/quizzes';
    const method = isUpdate ? 'PUT' : 'POST';
    const headers = { 'Content-Type': 'application/json' };
    if (isUpdate && quizPassword) {
      headers['x-quiz-password'] = quizPassword;
    }
    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      showAlert('Senha de gestão inválida. Recarregue a página e informe a senha correta.', 'error');
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const details = (body.details || ['erro ao salvar']).join('<br>');
      showAlert(details, 'error');
      return;
    }
    const body = await res.json();
    if (!isUpdate) {
      quizPassword = payload.password; // mantém a senha para futuros salvamentos
    }
    managementCode = body.managementCode || managementCode;
    hidePasswordField();
    showSavedInfo();
    showAlert('Quiz salvo com sucesso.', 'ok');
  }

  function hidePasswordField() {
    const group = $('passwordGroup');
    if (group) {
      group.classList.add('hidden');
    }
  }

  function showSavedInfo() {
    $('mgmtCodeShow').textContent = managementCode;
    $('manageLink').textContent =
      `Link de gestão: ${window.location.origin}/host.html?code=${managementCode}`;
    $('savedInfo').classList.remove('hidden');
  }

  async function loadQuiz(code, password) {
    const headers = {};
    if (password) {
      headers['x-quiz-password'] = password;
    }
    const res = await fetch(`/api/quizzes/${code}`, { headers });

    if (res.status === 401) {
      const entered = window.prompt('Este quiz é protegido. Digite a senha de gestão para editar:');
      if (entered === null) {
        // Cancelou: volta para a lista.
        window.location.href = '/quizzes.html';
        return;
      }
      await loadQuiz(code, entered);
      return;
    }
    if (!res.ok) {
      showAlert('Quiz não encontrado para este código de gestão.', 'error');
      hidePasswordField();
      builderQuestions.push(newBlankQuestion());
      renderBuilder();
      return;
    }

    quizPassword = password || null; // senha verificada, guardada para salvar
    hidePasswordField();
    const quiz = await res.json();
    $('builderTitle').textContent = 'Editar quiz';
    $('quizTitle').value = quiz.title;
    builderQuestions.length = 0;
    quiz.questions.forEach((q) => {
      builderQuestions.push({
        text: q.text,
        timeLimitSec: q.timeLimitSec,
        options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
      });
    });
    renderBuilder();
    showSavedInfo();
  }

  // --- Partida ao vivo ---------------------------------------------------
  async function launchGame() {
    const response = await emitAsync('host:launchRoom', { managementCode });
    if (!response.ok) {
      showAlert(`Não foi possível lançar: ${response.error}`, 'error');
      return;
    }
    roomCode = response.code;
    $('lobbyQuizTitle').textContent = response.quizTitle;
    $('roomCode').textContent = roomCode;

    // URL de entrada direta (código embutido) para o QR code e para exibição.
    const joinUrl = `${window.location.origin}/play.html?code=${roomCode}`;
    $('joinUrl').textContent = joinUrl;
    $('qrImage').src = `/api/qrcode?text=${encodeURIComponent(joinUrl)}`;

    showSection('lobby');
  }

  async function startGame() {
    const response = await emitAsync('host:startGame', { code: roomCode });
    if (!response.ok) {
      showAlert(`Não foi possível iniciar: ${response.error}`, 'error');
    }
  }

  function onQuestion(payload) {
    currentOptions = payload.options;
    showSection('live');
    $('revealBox').classList.add('hidden');
    $('questionCounter').textContent = `Pergunta ${payload.index + 1} de ${payload.total}`;
    $('hostQuestionText').textContent = payload.text;

    const optsBox = $('hostOptions');
    optsBox.innerHTML = '';
    payload.options.forEach((opt) => {
      const el = document.createElement('div');
      el.className = 'option';
      el.textContent = opt.text;
      optsBox.appendChild(el);
    });

    startCountdown(payload.timeLimitSec);
  }

  function startCountdown(seconds) {
    stopCountdown();
    let remaining = seconds;
    $('hostTimer').textContent = `⏱ ${remaining}s`;
    timerInterval = setInterval(() => {
      remaining -= 1;
      $('hostTimer').textContent = remaining > 0 ? `⏱ ${remaining}s` : 'Tempo esgotado';
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

  function onReveal(payload) {
    stopCountdown();
    $('hostTimer').textContent = '';

    const distBox = $('distribution');
    distBox.innerHTML = '';
    currentOptions.forEach((opt) => {
      const count = payload.distribution[opt.id] || 0;
      const isCorrect = opt.id === payload.correctOptionId;
      const line = document.createElement('div');
      line.className = 'pill';
      line.textContent = `${isCorrect ? '✅ ' : ''}${opt.text}: ${count}`;
      distBox.appendChild(line);
    });

    renderRankingList($('hostRanking'), payload.ranking);
    $('revealBox').classList.remove('hidden');
  }

  function renderRankingList(listEl, ranking) {
    listEl.innerHTML = '';
    ranking.forEach((entry) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="pos">${entry.rank}</span><span>${escapeHtml(entry.nickname)}</span><div class="spacer"></div><strong>${entry.score}</strong>`;
      listEl.appendChild(li);
    });
  }

  function onPodium(payload) {
    stopCountdown();
    showSection('podium');
    renderPodium(payload.podium);
    renderRankingList($('fullRanking'), payload.fullRanking);
  }

  function renderPodium(podium) {
    const box = $('podiumBox');
    box.innerHTML = '';
    const order = [1, 0, 2]; // 2º, 1º, 3º para o visual do pódio
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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Eventos de socket -------------------------------------------------
  socket.on('lobby:update', (data) => {
    $('playerCount').textContent = data.count;
    const list = $('playerList');
    list.innerHTML = '';
    data.players.forEach((p) => {
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = p.connected ? p.nickname : `${p.nickname} (off)`;
      list.appendChild(pill);
    });
  });

  socket.on('game:question', onQuestion);
  socket.on('game:reveal', onReveal);
  socket.on('game:podium', onPodium);

  // --- Ligações de botões ------------------------------------------------
  $('addQuestion').addEventListener('click', () => {
    builderQuestions.push(newBlankQuestion());
    renderBuilder();
  });
  $('saveQuiz').addEventListener('click', saveQuiz);
  $('launchGame').addEventListener('click', launchGame);
  $('startGame').addEventListener('click', startGame);
  $('nextQuestion').addEventListener('click', () =>
    emitAsync('host:nextQuestion', { code: roomCode })
  );
  $('endGame').addEventListener('click', () => emitAsync('host:endGame', { code: roomCode }));

  // --- Início ------------------------------------------------------------
  const autoLaunch = new URLSearchParams(window.location.search).get('launch') === '1';
  if (managementCode && autoLaunch) {
    // Lançar não exige senha: inicia a partida sem carregar os detalhes.
    hidePasswordField();
    launchGame();
  } else if (managementCode) {
    // Editar/ver detalhes exige a senha (loadQuiz pede se necessário).
    loadQuiz(managementCode);
  } else {
    // Novo quiz: o campo de senha permanece visível para o master escolher.
    builderQuestions.push(newBlankQuestion());
    renderBuilder();
  }
})();
