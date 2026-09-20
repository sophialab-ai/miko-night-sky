/* storage.js
   回答本文はこのブラウザの中だけで扱う。サーバーへは送らない。

   ・アクセスコードは保存しない（体験中はメモリにだけ持つ）
   ・保存のたびに updatedAt を更新する
   ・最後の操作から KEEP_DAYS 日が過ぎたデータは、開いたときに自動で消す */

const STORAGE_KEY = 'miko_current_session';

/* 最後に操作した日から、この日数だけ端末に残す */
const KEEP_DAYS = 7;

function createEmptySession(sessionId) {
  const q = {};
  QUESTIONS.forEach(function (item) {
    q[item.id] = { skipped: false, answered: false, answer: '', followUpAnswer: '' };
  });
  const now = new Date().toISOString();
  return {
    sessionId: sessionId,
    startedAt: now,
    updatedAt: now,
    questions: q,
    reflection1: '',
    reflection2: '',
    /* 置いた結晶。x は画面幅を1とした夜空の中の位置、y は画面の高さに対する割合 */
    crystals: [],
    cam: 0,             // どこまで歩いたか（画面幅を1とした割合）
    currentStep: 'q1',  // q1..q7 / sky / summary / reflection1 / reflection2 / end
    completed: false,
    pdfGenerated: false
  };
}

const Storage = {
  save: function (session) {
    if (!session) return;
    try {
      /* 念のため、アクセスコードが混ざっていたら落としてから保存する */
      if (session.code !== undefined) delete session.code;
      session.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
      /* 保存できない環境でも体験は続けられるようにする */
    }
  },

  load: function () {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);
      if (!data || !data.sessionId || !data.questions) return null;

      /* 前の形のデータに入っていたアクセスコードは、ここで捨てる */
      if (data.code !== undefined) delete data.code;

      /* 古い形のデータ（結晶の位置を持っていない）を、新しい形へ移す */
      if (!data.crystals) {
        data.crystals = [];
        const ids = data.order || [];
        ids.forEach(function (id) {
          data.crystals.push({ id: id, x: 0.3, y: 0.6 });
        });
        delete data.order;
      }
      if (typeof data.cam !== 'number') data.cam = 0;

      /* 最後の操作からの日数を見る。updatedAt が無いデータは、いまを起点にする */
      if (!data.updatedAt) {
        data.updatedAt = new Date().toISOString();
        this.save(data);
        return data;
      }

      const days = (Date.now() - new Date(data.updatedAt).getTime()) / 86400000;
      if (!isFinite(days) || days >= KEEP_DAYS) {
        this.clear();
        return null;
      }

      return data;
    } catch (e) {
      return null;
    }
  },

  clear: function () {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* noop */
    }
  },

  newSessionId: function () {
    const rnd = Math.random().toString(36).slice(2, 10);
    return 's-' + Date.now().toString(36) + '-' + rnd;
  }
};
