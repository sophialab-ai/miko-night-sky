/* api.js
   GAS（Google Apps Script）との通信だけを担当する。

   ★ここを通るデータには、本人の回答本文を絶対に含めない。
     送ってよいのは「アクセスコード」「sessionId」だけ。

   いまつないでいるGASの仕様（実際に確認したもの）
     ・check / start は POST だけで受け付ける（アクセスコードをURLに載せないため）
     ・GET は疎通確認だけ（{"ok":true,"message":"miko-night-sky"} を返す）
     ・check  → {"ok":true,"valid":true/false,"reason":"...","remaining":n}
     ・start  → {"ok":true,"started":true/false,"resumed":true/false,"reason":"...","remaining":n}
     ・event（利用状況の記録）は、まだ受け付けない（invalid_action が返る）
*/

/* GASウェブアプリのURL */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxTQr4wnjF88UoA9JnagbpOFOb8gcDtoV9q2xDM_hhUSLR1W64xJJdGPdBvTjdP2SPP/exec';

/* 開発用のローカル判定モード。GASにつないだので使わない。 */
const LOCAL_TEST_MODE = false;

/* 利用状況（到達地点など）の記録。
   いまのGASは event を受け付けないため送らない。
   GAS側に event を足したら true にすれば、そのまま送りはじめる。 */
const SEND_EVENTS = false;

/* GASへ送ってよいキーだけを通す関門。ここに無いキーは捨てる。 */
const ALLOWED_KEYS = ['action', 'code', 'session_id', 'event', 'step', 'client_time'];

function buildParams(obj) {
  const out = [];
  ALLOWED_KEYS.forEach(function (key) {
    const v = obj[key];
    if (v !== undefined && v !== null && v !== '') {
      out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
    }
  });
  return out.join('&');
}

/* 問い合わせはすべてPOSTで送る。
   アクセスコードや session_id はURLに出ず、本文に入る。
   フォーム形式（x-www-form-urlencoded）にしているのは、
   ブラウザの事前確認（preflight）を起こさず、GAS側が e.parameter で読めるため。 */
function gasPost(params) {
  return fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: buildParams(params),
    redirect: 'follow'
  }).then(function (res) {
    return res.json();
  });
}

function toNumber(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

/* ---------- 公開API ---------- */
const Api = {
  /* GASにつないだので、仮モードでは動かない */
  usingLocalTestMode: function () {
    return !GAS_URL && LOCAL_TEST_MODE;
  },

  /* アクセスコードの有効性確認。回数は消費しない。 */
  checkCode: function (code) {
    if (!GAS_URL) return Promise.resolve({ ok: false, reason: 'not_configured' });

    return gasPost({ action: 'check', code: code }).then(function (json) {
      if (!json || json.ok !== true) return { ok: false, reason: 'network' };
      if (json.valid !== true) return { ok: false, reason: 'invalid' };
      return {
        ok: true,
        remaining: toNumber(json.remaining),
        maxUses: toNumber(json.max_uses !== undefined ? json.max_uses : json.maxUses),
        usedUses: toNumber(json.used !== undefined ? json.used : json.usedUses)
      };
    }).catch(function () {
      return { ok: false, reason: 'network' };
    });
  },

  /* 「ミコと歩きはじめる」を押したときだけ呼ぶ。ここで1回消費する。 */
  startSession: function (code, sessionId) {
    if (!GAS_URL) return Promise.resolve({ ok: false, reason: 'not_configured' });

    return gasPost({ action: 'start', code: code, session_id: sessionId }).then(function (json) {
      if (!json || json.ok !== true) return { ok: false, reason: 'network' };

      if (json.started !== true) {
        /* 「そのコードが無い」のか「回数を使い切った」のかを分ける */
        const reason = String(json.reason || '').toLowerCase();
        if (/not_found|invalid|unknown|missing|no_code/.test(reason)) {
          return { ok: false, reason: 'invalid', remaining: 0 };
        }
        if (/limit|used|remain|no_use|over|max|exceed|full/.test(reason)) {
          return { ok: false, reason: 'no_uses', remaining: 0 };
        }
        return { ok: false, reason: 'unknown', remaining: toNumber(json.remaining) };
      }

      return { ok: true, started: true, remaining: toNumber(json.remaining) };
    }).catch(function () {
      return { ok: false, reason: 'network' };
    });
  },

  /* 到達地点などの利用状況だけを記録する（回答本文は含めない）。
     いまのGASは受け付けないので、送らずにそのまま終わる。 */
  logEvent: function (code, sessionId, eventName) {
    if (!GAS_URL || !SEND_EVENTS) return Promise.resolve({ ok: true, skipped: true });

    return gasPost({
      action: 'event',
      code: code,
      session_id: sessionId,
      event: eventName,
      client_time: new Date().toISOString()
    }).catch(function () {
      return { ok: false };
    });
  }
};
