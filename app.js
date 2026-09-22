/* app.js
   体験全体の進行。
   ここでは「本人が入力した言葉」をそのまま保持し、そのまま返すだけにする。
   分析・要約・診断・意味づけは行わない。 */

const App = {
  session: null,
  index: 0,          // 何問目か（0..6）
  phase: 'main',     // 'main' | 'follow'
  busy: false,       // 演出中の二重操作を防ぐ
  pendingCode: '',   // 「確認」済みのコード（まだ回数は消費していない）
  activeCode: '',    // いま歩いている回のコード。★localStorageには保存しない

  /* ================= 起動 ================= */
  init: function () {
    this.bindEvents();

    const devView = Api.usingLocalTestMode() ||
      (window.location.search.indexOf('dev=1') >= 0);
    if (Api.usingLocalTestMode()) UI.setHidden('local-test-notice', false);
    if (devView) UI.setHidden('build-badge', false);

    UI.setScene('overview');

    const saved = Storage.load();

    /* 最初の画面は、フェードを使わずに組み立てる（下の revealApp で一度に出す） */
    UI.nextScreenInstant = true;

    if (saved && !saved.completed) {
      this.session = saved;
      UI.setText('resume-where', '前回は「' + this.stepLabel(saved.currentStep) + '」まで進んでいます。');
      UI.showScreen('screen-resume');
    } else {
      if (saved && saved.completed) {
        /* 終わったセッションは残しておくが、画面は最初から */
        this.session = saved;
      }
      UI.showScreen('screen-intro');
    }

    this.revealApp();
  },

  /* 背景の絵がそろってから、画面を一度だけ表示する。
     絵の読み込みが遅いときも、待ちすぎないように上限を置く。 */
  revealApp: function () {
    let shown = false;
    const show = function () {
      if (shown) return;
      shown = true;
      document.body.classList.remove('is-booting');
    };

    const probe = new Image();
    probe.onload = show;
    probe.onerror = show;
    probe.src = 'assets/images/bg-sky-overview.png';
    if (probe.complete) show();

    setTimeout(show, 1500);
  },

  /* いまどこまで進んだかを、やさしい言葉で */
  stepLabel: function (step) {
    const map = {
      sky: '最後の夜空',
      summary: '拾ったことばをまとめて見るところ',
      reflection1: 'ふりかえり',
      reflection2: 'ふりかえり',
      end: '終わりの画面'
    };
    if (map[step]) return map[step];
    for (let i = 0; i < QUESTIONS.length; i++) {
      if (QUESTIONS[i].id === step) return (i + 1) + 'つめの問い';
    }
    return 'はじめのところ';
  },

  bindEvents: function () {
    const self = this;

    UI.el('btn-intro-next').addEventListener('click', function () {
      UI.showScreen('screen-privacy');
    });
    UI.el('btn-privacy-back').addEventListener('click', function () {
      UI.showScreen('screen-intro');
    });
    UI.el('btn-privacy-next').addEventListener('click', function () {
      UI.showScreen('screen-start');
    });

    UI.el('btn-check-code').addEventListener('click', function () { self.onCheckCode(); });
    UI.el('btn-start-walk').addEventListener('click', function () { self.onStartWalk(); });

    UI.el('btn-resume').addEventListener('click', function () { self.onResume(); });
    UI.el('btn-fresh').addEventListener('click', function () {
      Storage.clear();
      self.session = null;
      UI.showScreen('screen-intro');
    });

    UI.el('btn-submit').addEventListener('click', function () { self.onSubmit(); });
    UI.el('btn-skip').addEventListener('click', function () { self.onSkip(); });
    UI.el('btn-back').addEventListener('click', function () { self.onBack(); });
    UI.el('answer-input').addEventListener('input', function () { self.refreshSubmitState(); });

    UI.el('btn-go-summary').addEventListener('click', function () { self.goSummary(); });
    UI.el('btn-summary-back').addEventListener('click', function () { self.goFinalSky(false); });
    UI.el('btn-summary-next').addEventListener('click', function () { self.goReflection(1); });

    UI.el('btn-reflect-submit').addEventListener('click', function () { self.onReflectSubmit(false); });
    UI.el('btn-reflect-skip').addEventListener('click', function () { self.onReflectSubmit(true); });

    UI.el('btn-pdf').addEventListener('click', function () { self.onPdf(); });
    UI.el('btn-pdf-go').addEventListener('click', function () { self.onPdfGo(); });
    UI.el('btn-copy-url').addEventListener('click', function () { self.onCopyUrl(); });
    UI.el('btn-pdf-back').addEventListener('click', function () { UI.showScreen('screen-end'); });
    UI.el('btn-view-sky').addEventListener('click', function () { self.goFinalSky(false); });
    UI.el('btn-restart').addEventListener('click', function () { self.onRestart(); });

    UI.el('btn-go-feedback').addEventListener('click', function () { self.goFeedback(); });
    UI.el('btn-forget').addEventListener('click', function () { self.onForget(); });
    UI.el('btn-feedback-open').addEventListener('click', function () { self.openFeedbackForm(); });
    UI.el('btn-feedback-close').addEventListener('click', function () {
      UI.showScreen('screen-end');
    });

    UI.el('btn-detail-close').addEventListener('click', function () {
      UI.setHidden('crystal-detail', true);
    });
    UI.el('crystal-detail').addEventListener('click', function (e) {
      if (e.target === this) UI.setHidden('crystal-detail', true);
    });

    /* 画面の向きや大きさが変わったら、夜空を組み立て直す */
    let resizeTimer = null;
    window.addEventListener('resize', function () {
      if (!self.session || self.busy) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        self.restoreSky();
        if (document.body.classList.contains('is-final-sky')) self.viewWholeSky(600);
      }, 300);
    });
  },

  /* ================= アクセスコード ================= */
  onCheckCode: function () {
    const self = this;
    const code = UI.el('input-code').value.trim();
    if (!code) {
      UI.setText('code-message', 'アクセスコードを入力してね。');
      return;
    }
    UI.el('btn-check-code').disabled = true;
    UI.setText('code-message', '確認しています…');
    UI.setHidden('start-walk-area', true);

    Api.checkCode(code).then(function (res) {
      UI.el('btn-check-code').disabled = false;
      if (!res || !res.ok) {
        if (res && res.reason === 'not_configured') {
          UI.setText('code-message', 'アクセスコードの確認先が、まだ設定されていません。');
        } else if (res && res.reason === 'network') {
          UI.setText('code-message', 'うまくつながりませんでした。少し時間をおいて、もう一度試してね。');
        } else {
          UI.setText('code-message', 'このアクセスコードは使えないみたいです。');
        }
        return;
      }
      if (res.remaining <= 0) {
        UI.setText('code-message', 'このコードでは、もう歩けません。');
        return;
      }
      self.pendingCode = code;
      UI.setText('code-message', 'このコードでは、あと' + res.remaining + '回歩けます');
      UI.setHidden('start-walk-area', false);
      Api.logEvent(code, '', 'code_checked');
    });
  },

  onStartWalk: function () {
    const self = this;
    if (!this.pendingCode) return;
    UI.el('btn-start-walk').disabled = true;
    const sessionId = Storage.newSessionId();

    Api.startSession(this.pendingCode, sessionId).then(function (res) {
      UI.el('btn-start-walk').disabled = false;
      if (!res || !res.ok) {
        if (res && res.reason === 'no_uses') {
          UI.setText('code-message', 'このコードでは、もう歩けません。');
        } else if (res && res.reason === 'invalid') {
          UI.setText('code-message', 'このアクセスコードは使えないみたいです。');
        } else {
          UI.setText('code-message', 'うまく始められませんでした。もう一度試してね。');
        }
        return;
      }
      self.activeCode = self.pendingCode;
      self.session = createEmptySession(sessionId);
      Storage.save(self.session);
      UI.clearSky();
      self.log('session_started');
      /* 質問が始まる前に、導入予告アニメーションを一度だけ流す */
      self.playIntroThen(function () { self.startQuestion(0, 'main'); });
    });
  },

  onResume: function () {
    /* 途中再開は新しい1回として数えない */
    UI.clearSky();
    this.restoreSky();
    const step = this.session.currentStep || 'q1';

    if (step === 'sky') { this.goFinalSky(true); return; }
    if (step === 'summary') { this.goSummary(); return; }
    if (step === 'reflection1') { this.goReflection(1); return; }
    if (step === 'reflection2') { this.goReflection(2); return; }
    if (step === 'end') { this.goEnd(); return; }

    let idx = 0;
    for (let i = 0; i < QUESTIONS.length; i++) {
      if (QUESTIONS[i].id === step) idx = i;
    }
    this.startQuestion(idx, this.session.currentPhase === 'follow' ? 'follow' : 'main');
  },

  /* 札に出す言葉。本人が書いた文章そのまま。
     長いときは、続きがあることを「…」で示すだけにする（言い換えや要約はしない） */
  labelTextFor: function (questionId) {
    const data = this.session.questions[questionId];
    if (!data || !data.answer) return '';
    const text = data.answer.replace(/\s+/g, ' ').trim();
    return (text.length > 14) ? (text.slice(0, 14) + '…') : text;
  },

  /* ================= 導入予告アニメーション ================= */
  /* 質問が始まる前に一度だけ流す。intro.css / js/intro.js が無ければ、そのままQ1へ。 */
  playIntroThen: function (next) {
    if (typeof Intro === 'undefined' || !Intro || typeof Intro.play !== 'function') {
      next();
      return;
    }
    Intro.play().then(function () {
      /* 幕が下りているあいだにQ1を組み立てる。
         フェードインを使うと、幕が上がる途中で下の夜空が見えてしまうため。 */
      UI.nextScreenInstant = true;
      next();
    });
  },

  /* ================= 結晶の記録 ================= */
  crystalIndexOf: function (questionId) {
    const list = this.session.crystals || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === questionId) return i;
    }
    return -1;
  },

  saveCam: function () {
    this.session.cam = UI.cam / UI.vw();
    Storage.save(this.session);
  },

  /* ================= 記録（回答本文は送らない） ================= */
  log: function (eventName) {
    if (!this.session) return;
    Api.logEvent(this.activeCode, this.session.sessionId, eventName);
  },

  /* ================= 質問画面 ================= */
  startQuestion: function (index, phase) {
    document.body.classList.remove('is-final-sky');
    UI.clearBridge();
    UI.setScene('overview');
    this.index = index;
    this.phase = phase;
    const q = QUESTIONS[index];

    this.session.currentStep = q.id;
    this.session.currentPhase = phase;
    Storage.save(this.session);
    if (phase === 'main') this.log(q.id + '_reached');

    this.renderQuestion();
    UI.showScreen('screen-dialogue');
    UI.setMiko('miko-main.png');
    UI.setCrystalsTappable(false);
  },

  renderQuestion: function () {
    const q = QUESTIONS[this.index];
    const data = this.session.questions[q.id];
    const isFollow = this.phase === 'follow';
    const src = isFollow ? q.followUp : q;

    UI.setText('step-indicator', (this.index + 1) + ' / ' + QUESTIONS.length);
    UI.setText('question-text', src.text);

    /* ヒント */
    const hints = src.hints || [];
    const hasHint = hints.length > 0 || !!src.hintNote || !!src.hintTitle;
    UI.setHidden('hint-box', !hasHint);
    UI.setHidden('hint-title', !src.hintTitle);
    if (src.hintTitle) UI.setText('hint-title', src.hintTitle);

    const list = UI.el('hint-list');
    list.innerHTML = '';
    hints.forEach(function (h) {
      const li = document.createElement('li');
      li.textContent = h;
      list.appendChild(li);
    });
    UI.setText('hint-note', src.hintNote || '');

    /* 入力欄（前の回答があれば、そのまま出す） */
    const input = UI.el('answer-input');
    input.value = isFollow ? (data.followUpAnswer || '') : (data.answer || '');

    /* ボタン（前の演出で止めたままにしない） */
    UI.el('btn-skip').disabled = false;
    UI.el('btn-back').disabled = (this.index === 0 && !isFollow);
    UI.setText('btn-submit', 'この言葉を置く');
    UI.setText('btn-skip', '今は思いつかない');

    const line = UI.el('miko-after-line');
    line.classList.remove('is-visible');
    line.textContent = '';

    this.refreshSubmitState();
  },

  refreshSubmitState: function () {
    const empty = UI.el('answer-input').value.trim() === '';
    UI.el('btn-submit').disabled = empty || this.busy;
  },

  setControlsDisabled: function (disabled) {
    ['btn-submit', 'btn-skip', 'btn-back'].forEach(function (id) {
      UI.el(id).disabled = disabled;
    });
    if (!disabled) this.refreshSubmitState();
  },

  showAfterLine: function (text) {
    const line = UI.el('miko-after-line');
    line.textContent = text;
    requestAnimationFrame(function () { line.classList.add('is-visible'); });
  },

  /* ---- 回答を置く ---- */
  onSubmit: function () {
    if (this.busy) return;
    const text = UI.el('answer-input').value.trim();
    if (!text) return;

    const q = QUESTIONS[this.index];
    const data = this.session.questions[q.id];

    if (this.phase === 'follow') {
      data.followUpAnswer = text;
      Storage.save(this.session);
      this.showAfterLine(q.followUp.afterText);
      this.finishTheme();
      return;
    }

    data.answer = text;
    data.answered = true;
    data.skipped = false;
    Storage.save(this.session);
    this.showAfterLine(q.afterText);

    if (q.followUp) {
      const self = this;
      this.busy = true;
      this.setControlsDisabled(true);
      UI.sleep(1600).then(function () {
        self.busy = false;
        self.startQuestion(self.index, 'follow');
      });
      return;
    }
    this.finishTheme();
  },

  /* ---- 今は思いつかない ---- */
  onSkip: function () {
    if (this.busy) return;
    const q = QUESTIONS[this.index];
    const data = this.session.questions[q.id];

    if (this.phase === 'follow') {
      /* 最初の質問に答えていれば、結晶はつくる */
      data.followUpAnswer = '';
      Storage.save(this.session);
      this.showAfterLine('うん。じゃあ、次へいこうか。');
      this.finishTheme();
      return;
    }

    const at = this.crystalIndexOf(q.id);
    data.skipped = true;
    data.answered = false;
    data.answer = '';
    data.followUpAnswer = '';

    if (at >= 0) {
      /* 戻って消した場合は、その結晶を夜空から外す */
      this.session.crystals.splice(at, 1);
      this.restoreSky();
    }
    Storage.save(this.session);
    this.showAfterLine('うん。じゃあ、次へいこうか。');

    const self = this;
    this.busy = true;
    this.setControlsDisabled(true);
    UI.sleep(1400).then(function () {
      self.busy = false;
      self.goNext();
    });
  },

  onBack: function () {
    if (this.busy) return;
    if (this.phase === 'follow') {
      this.startQuestion(this.index, 'main');
      return;
    }
    if (this.index === 0) return;

    const prev = QUESTIONS[this.index - 1];
    const prevData = this.session.questions[prev.id];
    /* 追加質問があり、最初の質問に答えていれば追加質問の画面へ戻る */
    if (prev.followUp && prevData.answered) {
      this.startQuestion(this.index - 1, 'follow');
    } else {
      this.startQuestion(this.index - 1, 'main');
    }
  },

  /* ---- テーマ完了（結晶を置く） ---- */
  finishTheme: function () {
    const self = this;
    const q = QUESTIONS[this.index];
    this.busy = true;
    this.setControlsDisabled(true);

    if (this.crystalIndexOf(q.id) >= 0) {
      /* 書き直しのとき。結晶は増やさない */
      UI.sleep(1400).then(function () {
        self.busy = false;
        self.goNext();
      });
      return;
    }

    const posIndex = this.session.crystals.length;
    /* 拾う場面は、質問が始まる前の導入アニメーションで見せているので、
       Q1〜Q7はどれも「置く → のぼる」だけにする */
    this.shortCeremony(q.id, posIndex).then(function () {
      self.busy = false;
      self.goNext();
    });
  },

  goNext: function () {
    if (this.index < QUESTIONS.length - 1) {
      this.startQuestion(this.index + 1, 'main');
    } else {
      this.afterLastQuestion();
    }
  },

  /* ================= 結晶の演出 ================= */
  /* 置き場所を決めて、記録する */
  registerCrystal: function (questionId, posIndex) {
    /* ミコが立っている足元（道の上）に置く */
    const world = UI.crystalPointFor(posIndex);
    this.session.crystals.push({
      id: questionId,
      x: world.x / UI.vw(),
      y: world.y / UI.vh(),
      side: world.side || 'r'
    });
    Storage.save(this.session);
    this.lastSide = world.side || 'r';
    return world;
  },

  /* 結晶を置く演出（Q1〜Q7で共通）。
     いま立っている足元へ結晶を置き、ひとつ上の場所まで道をのぼる。
     ※「拾う」場面は、質問が始まる前の導入アニメーション（js/intro.js）で見せています。 */
  shortCeremony: async function (questionId, posIndex) {
    await UI.sleep(700);

    /* 1. 夜空全体へ。いま立っている場所で、置く姿勢になる */
    UI.setScene('overview');
    UI.setSkyMiko('miko-place.png');
    UI.el('sky-miko').style.opacity = '1';
    UI.setSkyMikoProgress(UI.progressFor(posIndex), 0);
    UI.setHidden('sky-final-ui', true);
    UI.hideMikoLine();
    document.body.classList.remove('is-final-sky');
    UI.showSkyOnly();
    await UI.sleep(900);

    /* 2. 結晶が、手のひらの上に現れる（0.9秒） */
    const hand = UI.skyHandPoint();
    const crystal = UI.createFlyingCrystal(hand);
    await UI.sleep(900);

    /* 3. 置く：足元の光の道へ、そっと下りる（1.2秒） */
    const world = this.registerCrystal(questionId, posIndex);
    crystal.style.transition = 'left 1.2s var(--ease), top 1.2s var(--ease), opacity 1s var(--ease), filter 0.8s var(--ease)';
    UI.moveFlyingCrystal(crystal, UI.worldToScreen(world));
    await UI.sleep(1300);

    /* 4. 淡く光って、その場所に残る（0.7秒） */
    UI.glowFlyingCrystal(crystal);
    await UI.sleep(700);

    UI.placeCrystalInSky(questionId, world, this.openCrystal.bind(this), this.labelTextFor(questionId), this.lastSide);
    UI.removeFlyingCrystal(crystal);
    this.saveCam();

    /* 5. のぼる：ひとつ上の場所まで、道を進む（1.8秒） */
    UI.setSkyMiko('miko-back.png');
    UI.setSkyMikoProgress(UI.progressFor(posIndex + 1), 1800);
    await UI.sleep(1900);

    UI.setMiko('miko-main.png');
  },

  /* 保存済みデータから夜空を組み立て直す（途中再開・書き直し用） */
  restoreSky: function () {
    UI.el('crystal-field').innerHTML = '';
    UI.ensureConstellation();
    UI.setZoom(1, 0);
    UI.moveCam((this.session.cam || 0) * UI.vw(), 0);

    const self = this;
    (this.session.crystals || []).forEach(function (c) {
      /* 古いデータは画面の%で持っていたので、その場合だけ読み替える */
      const ratio = (c.y > 1.5) ? c.y / 100 : c.y;
      UI.placeCrystalInSky(
        c.id,
        { x: c.x * UI.vw(), y: ratio * UI.vh() },
        self.openCrystal.bind(self),
        self.labelTextFor(c.id),
        c.side
      );
    });
  },

  /* ================= Q7のあと ================= */
  /* 置いてきた言葉を、ミコと一緒に静かに受け止めてから、まとめて見る画面へ */
  afterLastQuestion: async function () {
    this.session.currentStep = 'sky';
    Storage.save(this.session);
    this.log('night_sky_reached');

    /* 1. これまで置いた結晶が残っている夜空全体を、少し長めに見せる（2.4秒） */
    UI.setScene('overview');
    UI.setHidden('sky-final-ui', true);
    UI.hideMikoLine();
    document.body.classList.remove('is-final-sky');
    UI.showSkyOnly();
    await UI.sleep(2400);

    /* 2. ミコが正面向き（祈りポーズ）で、画面の下のほうに現れる（0.8秒） */
    await UI.showBridgeMiko('miko-main.png', 800);

    /* 3. 受け止める言葉（1秒） */
    UI.showMikoLine('いろんなことばを拾ったね。');
    await UI.sleep(1000);

    /* 4. 少し間を置いてから、祈り → offer へクロスフェード
          （0.8秒・1.12倍・数pxだけ前へ） */
    UI.hideMikoLine();
    await UI.sleep(400);
    await UI.crossfadeSkyMiko('miko-offer.png', 1.12, 800);

    /* 5. 差し出す言葉（1秒） */
    UI.showMikoLine('ちょっと、一緒に眺めてみようか。');
    await UI.sleep(1000);

    /* 6. そのまま少し余韻（0.9秒） */
    UI.hideMikoLine();
    await UI.sleep(900);

    /* 7. 短いフェードで、まとめて見る画面へ */
    UI.clearBridge();
    this.goSummary();
  },

  goFinalSky: function (keepMessage) {
    this.session.currentStep = 'sky';
    Storage.save(this.session);

    this.restoreSky();
    UI.setScene('overview');
    UI.clearBridge();
    /* のぼってきた場所に立ち、正面を向いて、そっと差し出すように一緒に眺める */
    UI.setFinalMiko();
    UI.setSkyMikoProgress(UI.progressFor((this.session.crystals || []).length), 1600);
    UI.showSkyOnly();
    document.body.classList.add('is-final-sky');

    /* 歩いてきた夜空をまとめて眺められるところまで、そっと引く */
    this.viewWholeSky(keepMessage ? 2800 : 1200);

    UI.setCrystalsTappable(true);
    UI.setHidden('sky-final-ui', false);
    setTimeout(function () { UI.layoutLabels(); }, 400);
    if (!keepMessage) UI.hideMikoLine();
  },

  /* 背景画像の道に合わせて置いてあるので、引かずにそのまま眺める */
  viewWholeSky: function (ms) {
    UI.setZoom(1, ms);
    UI.moveCam(0, ms);
    UI.setCamY(0, ms);
    UI.drawConstellation();
    setTimeout(function () { UI.layoutLabels(); }, (ms || 0) + 150);
  },

  openCrystal: function (questionId) {
    let q = null;
    QUESTIONS.forEach(function (item) { if (item.id === questionId) q = item; });
    if (!q) return;
    const data = this.session.questions[q.id];

    const body = UI.el('detail-body');
    body.innerHTML = '';

    const qEl = document.createElement('p');
    qEl.className = 'q';
    qEl.textContent = q.text;
    body.appendChild(qEl);

    const aEl = document.createElement('p');
    aEl.className = 'a';
    aEl.textContent = data.answer;
    body.appendChild(aEl);

    if (q.followUp && data.followUpAnswer) {
      const div = document.createElement('div');
      div.className = 'divider';
      body.appendChild(div);

      const fq = document.createElement('p');
      fq.className = 'q';
      fq.textContent = q.followUp.text;
      body.appendChild(fq);

      const fa = document.createElement('p');
      fa.className = 'a';
      fa.textContent = data.followUpAnswer;
      body.appendChild(fa);
    }

    UI.setHidden('crystal-detail', false);
  },

  /* ================= まとめて見る ================= */
  goSummary: function () {
    this.session.currentStep = 'summary';
    Storage.save(this.session);
    this.log('summary_reached');

    const wrap = UI.el('summary-cards');
    wrap.innerHTML = '';
    const self = this;

    QUESTIONS.forEach(function (q) {
      const data = self.session.questions[q.id];
      if (!data.answered || data.skipped) return;   /* スキップしたテーマは出さない */

      const card = document.createElement('div');
      card.className = 'summary-card';

      const qEl = document.createElement('p');
      qEl.className = 'q';
      qEl.textContent = q.text;
      card.appendChild(qEl);

      const aEl = document.createElement('p');
      aEl.className = 'a';
      aEl.textContent = data.answer;
      card.appendChild(aEl);

      if (q.followUp && data.followUpAnswer) {
        const div = document.createElement('div');
        div.className = 'divider';
        card.appendChild(div);

        const fq = document.createElement('p');
        fq.className = 'q';
        fq.textContent = q.followUp.text;
        card.appendChild(fq);

        const fa = document.createElement('p');
        fa.className = 'a';
        fa.textContent = data.followUpAnswer;
        card.appendChild(fa);
      }
      wrap.appendChild(card);
    });

    if (!wrap.children.length) {
      const empty = document.createElement('p');
      empty.className = 'note';
      empty.textContent = '今日は、言葉を置かないで歩いたんだね。';
      wrap.appendChild(empty);
    }

    UI.setCrystalsTappable(false);
    UI.setHidden('crystal-detail', true);
    document.body.classList.remove('is-final-sky');
    UI.clearBridge();
    UI.showScreen('screen-summary');
  },

  /* ================= 振り返り ================= */
  goReflection: function (num) {
    this.reflectNum = num;
    this.session.currentStep = 'reflection' + num;
    Storage.save(this.session);
    this.log('reflection' + num + '_reached');

    const input = UI.el('reflect-input');
    const line = UI.el('reflect-after-line');
    line.classList.remove('is-visible');
    line.textContent = '';

    if (num === 1) {
      UI.setText('reflect-question', 'ここまで自分の言葉を見てきて、今、何を思う？');
      UI.setHidden('reflect-hint', true);
      UI.setText('btn-reflect-submit', 'この言葉を置いておく');
      UI.setText('btn-reflect-skip', '今は思いつかない');
      input.value = this.session.reflection1 || '';
    } else {
      UI.setText('reflect-question', 'ここまで見てきて、次、何をする？');
      const list = UI.el('reflect-hint-list');
      list.innerHTML = '';
      ['何かやってみる', 'もう少し考えてみる', '誰かと話してみる', '今は何もしない'].forEach(function (h) {
        const li = document.createElement('li');
        li.textContent = h;
        list.appendChild(li);
      });
      UI.setHidden('reflect-hint', false);
      UI.setText('btn-reflect-submit', 'この言葉を置いておく');
      UI.setText('btn-reflect-skip', '今は決めない');
      input.value = this.session.reflection2 || '';
    }

    UI.setCrystalsTappable(false);
    document.body.classList.remove('is-final-sky');
    UI.showScreen('screen-reflect');
  },

  onReflectSubmit: function (skipped) {
    const self = this;
    const text = skipped ? '' : UI.el('reflect-input').value.trim();
    const num = this.reflectNum;

    if (num === 1) {
      this.session.reflection1 = text;
    } else {
      this.session.reflection2 = text;
    }
    Storage.save(this.session);

    const line = UI.el('reflect-after-line');
    if (skipped) {
      line.textContent = 'うん。今は、そうなんだね。';
    } else {
      line.textContent = (num === 1) ? 'うん。今は、そう思ったんだね。' : 'うん。今は、そうしたいんだね。';
    }
    requestAnimationFrame(function () { line.classList.add('is-visible'); });

    UI.el('btn-reflect-submit').disabled = true;
    UI.el('btn-reflect-skip').disabled = true;

    UI.sleep(2000).then(function () {
      UI.el('btn-reflect-submit').disabled = false;
      UI.el('btn-reflect-skip').disabled = false;
      if (num === 1) self.goReflection(2);
      else self.goEnd();
    });
  },

  /* ================= 終わり ================= */
  goEnd: function () {
    this.session.currentStep = 'end';
    this.session.completed = true;
    Storage.save(this.session);
    this.log('completed');

    UI.setText('end-message', '');
    UI.setCrystalsTappable(false);
    document.body.classList.remove('is-final-sky');
    UI.showScreen('screen-end');
  },

  /* ================= 体験後アンケート ================= */
  goFeedback: function () {
    UI.setCrystalsTappable(false);
    UI.clearBridge();
    document.body.classList.remove('is-final-sky');
    UI.showScreen('screen-feedback');
  },

  /* アンケートは別の画面で開く。アプリの状態はそのまま残す。
     回答本文は渡さない（フォームには、本人がフォーム画面で書いたものだけが届きます）。 */
  openFeedbackForm: function () {
    const win = window.open(FEEDBACK_FORM_URL, '_blank', 'noopener,noreferrer');
    if (!win) {
      /* 別画面が開けない設定のときは、この画面のまま開く */
      window.location.href = FEEDBACK_FORM_URL;
    }
  },

  /* ================= この端末の回答を削除する ================= */
  onForget: function () {
    const ok = window.confirm('消すと元に戻せません。よろしいですか？');
    if (!ok) return;

    Storage.clear();
    this.session = null;
    this.activeCode = '';
    this.pendingCode = '';
    UI.clearSky();
    UI.hideMikoLine();

    /* 消したあとに押せてしまうボタンは、止めておく */
    ['btn-pdf', 'btn-pdf-go', 'btn-view-sky', 'btn-restart', 'btn-forget'].forEach(function (id) {
      UI.el(id).disabled = true;
    });

    UI.setText('end-message', 'この端末から回答を削除しました。');
  },

  /* アプリの中で開かれた簡易ブラウザか（Messenger・Instagram・LINEなど）。
     こうしたブラウザでは印刷が動かないことがある。 */
  isInAppBrowser: function () {
    const ua = navigator.userAgent || '';
    return /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|MicroMessenger|Twitter/i.test(ua);
  },

  isIOS: function () {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua)) return true;
    /* iPadOSはMacintoshを名乗るので、指で触れるかどうかで見分ける */
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  },

  isAndroid: function () {
    return /Android/i.test(navigator.userAgent || '');
  },

  /* PDFボタン：すぐ開かず、保存のしかたを伝える画面へ進む */
  onPdf: function () {
    this.buildPdfGuide();
    UI.setText('pdf-message', '');
    UI.showScreen('screen-pdf');
  },

  /* 端末に合わせて、案内画面の中身を作る */
  buildPdfGuide: function () {
    const inApp = this.isInAppBrowser();
    const ios = this.isIOS();
    const android = this.isAndroid();

    let title, lead, steps, after;

    if (inApp) {
      title = 'SafariかChromeで開いてください';
      lead = 'このブラウザでは、PDFの保存がうまく動かないことがあります。';
      steps = [
        '下のボタンで、このページのURLをコピーする',
        'SafariかChromeを開いて、URLを貼りつける',
        'その画面で、もう一度PDFを持ち帰る'
      ];
      after = 'うまくいかないときは、この画面をそのままにしておけば、あとから試せます。';
    } else if (ios) {
      title = 'PDFを保存します';
      lead = 'このあとPDFの画面が開きます。';
      steps = [
        '画面の共有ボタン（□に↑）を押す',
        '「ファイルに保存」を選ぶ'
      ];
      after = '保存したPDFは「ファイル」アプリから確認できます。紙に印刷する必要はありません。';
    } else if (android) {
      title = 'PDFを保存します';
      lead = 'このあとPDFの画面が開きます。';
      steps = [
        'プリンターや保存先の選択から「PDFとして保存」を選ぶ'
      ];
      after = '保存したPDFは「ファイル」アプリやダウンロードから確認できます。';
    } else {
      title = 'PDFを保存します';
      lead = 'このあとPDF保存の画面が開きます。';
      steps = [
        'プリンターや送信先の選択から「PDFに保存」を選ぶ',
        '保存先を指定して保存する'
      ];
      after = '紙に印刷する必要はありません。PDFとして手元に残せます。';
    }

    UI.setText('pdf-title', title);
    UI.setText('pdf-lead', lead);
    UI.setText('pdf-after', after);

    const list = UI.el('pdf-steps');
    list.innerHTML = '';
    steps.forEach(function (line) {
      const li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    });

    UI.el('pdf-copy-row').classList.toggle('hidden', !inApp);
  },

  /* 案内を読んだうえで、PDFの画面を開く */
  onPdfGo: function () {
    Pdf.generate(this.session);
    this.session.pdfGenerated = true;
    Storage.save(this.session);
    this.log('pdf_generated');
  },

  onCopyUrl: function () {
    const url = location.href.split('#')[0];
    const done = function () { UI.setText('pdf-message', 'URLをコピーしました。SafariかChromeのアドレス欄に貼りつけてください。'); };
    const fail = function () { UI.setText('pdf-message', 'コピーできませんでした。アドレス欄のURLを長押しして選んでください。'); };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, fail);
      return;
    }
    /* 古いブラウザ向けの控え */
    try {
      const box = document.createElement('textarea');
      box.value = url;
      box.setAttribute('readonly', '');
      box.style.position = 'fixed';
      box.style.opacity = '0';
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(box);
      if (ok) { done(); } else { fail(); }
    } catch (e) {
      fail();
    }
  },

  onRestart: function () {
    const self = this;
    const code = this.activeCode;

    /* ブラウザを閉じたあとなどで、コードが手元に残っていないとき */
    if (!code) {
      this.pendingCode = '';
      UI.setText('code-message', 'もう一度歩くには、アクセスコードを入れてね。');
      UI.setHidden('start-walk-area', true);
      UI.el('input-code').value = '';
      UI.showScreen('screen-start');
      return;
    }

    UI.el('btn-restart').disabled = true;
    UI.setText('end-message', '確認しています…');

    Api.checkCode(code).then(function (res) {
      if (!res || !res.ok || res.remaining <= 0) {
        UI.el('btn-restart').disabled = false;
        UI.setText('end-message', 'このコードでは、もう歩けません。');
        return;
      }
      const sessionId = Storage.newSessionId();
      Api.startSession(code, sessionId).then(function (startRes) {
        UI.el('btn-restart').disabled = false;
        if (!startRes || !startRes.ok) {
          UI.setText('end-message', (startRes && startRes.reason === 'no_uses')
            ? 'このコードでは、もう歩けません。'
            : 'うまく始められませんでした。もう一度試してね。');
          return;
        }
        Storage.clear();
        self.activeCode = code;
        self.session = createEmptySession(sessionId);
        Storage.save(self.session);
        UI.clearSky();
        UI.hideMikoLine();
        self.log('restart_started');
        self.playIntroThen(function () { self.startQuestion(0, 'main'); });
      });
    });
  }
};

window.addEventListener('DOMContentLoaded', function () { App.init(); });
