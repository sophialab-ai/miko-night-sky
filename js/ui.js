/* ui.js
   画面の切り替えと、ミコ・夜空・結晶の演出だけを担当する。
   回答内容によって演出を変えないこと（色・大きさ・輝き・表情は常に同じ）。 */

const UI = {
  el: function (id) { return document.getElementById(id); },

  sleep: function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  },

  /* ---------- 画面切り替え ---------- */
  showScreen: function (id) {
    const screens = document.querySelectorAll('.screen');
    for (let i = 0; i < screens.length; i++) {
      screens[i].classList.toggle('is-active', screens[i].id === id);
    }
    window.scrollTo(0, 0);
  },

  /* 夜空だけを見せる（対話パネルを消す） */
  showSkyOnly: function () {
    this.showScreen('screen-sky');
  },

  /* ---------- ミコの画像 ---------- */
  setMiko: function (file) {
    this.el('miko-img').src = 'assets/images/' + file;
  },

  /* Q1の拾う場面のミコ（大きく表示する） */
  setPickupMiko: function (file) {
    this.el('pickup-miko').src = 'assets/images/' + file;
  },

  /* 拾う場面のミコの、手元あたりの位置 */
  pickupHandPoint: function () {
    const r = this.el('pickup-miko').getBoundingClientRect();
    /* miko-pick.png の絵の中で、結晶を持つ手のあたり */
    return { x: r.left + r.width * 0.63, y: r.top + r.height * 0.76 };
  },

  showPickupLine: function (text) {
    const line = this.el('pickup-line');
    line.textContent = text;
    line.classList.remove('is-visible');
    requestAnimationFrame(function () { line.classList.add('is-visible'); });
  },

  /* ================= Q7のあと、正面で受け止める場面 ================= */
  /* 画面の下のほうに、正面向きで少し大きめに立たせる（フェードで現れる） */
  showBridgeMiko: function (file, ms) {
    const el = this.el('sky-miko');
    const img = this.el('sky-miko-img');
    const alt = this.el('sky-miko-img2');

    el.classList.remove('is-placing', 'is-offering');
    el.classList.add('is-bridge');
    document.body.classList.add('is-bridge-sky');

    alt.style.transition = 'none';
    alt.style.opacity = '0';

    /* いた場所からは動かさず、いったん消してから、下のほうに現れる */
    el.style.opacity = '0';
    el.style.setProperty('--miko-move', '0ms');
    el.style.setProperty('--miko-x', '50%');
    el.style.setProperty('--miko-y', '13%');
    const w = this.bridgeWidth();
    el.style.setProperty('--miko-w', w + 'px');
    this.placeBridgeLine(w);
    img.src = 'assets/images/' + file;

    const self = this;
    return this.sleep(60).then(function () {
      el.style.transition = 'opacity ' + (ms || 800) + 'ms var(--ease)';
      el.style.opacity = '1';
      return self.sleep(ms || 800);
    });
  },

  bridgeWidth: function () {
    /* 横長の画面でも頭が画面からはみ出さないよう、高さでも上限をかける */
    return Math.round(Math.min(420, this.vw() * 0.66, this.vh() * 0.46));
  },

  /* セリフを、ミコの頭のすぐ上に置く（余白が足りないときは足元の下へ） */
  placeBridgeLine: function (widthPx) {
    const vh = this.vh();
    const footPx = vh * 0.13;                  /* ミコの足元 */
    const topPx = footPx + widthPx * 0.96;     /* 絵の上端（下からの高さ） */
    const spaceAbove = vh - topPx;             /* 頭の上に残っている高さ */
    const line = this.el('sky-message');

    line.style.top = 'auto';
    line.style.bottom = (spaceAbove > 64)
      ? Math.round(topPx + 16) + 'px'   /* 頭のすぐ上 */
      : '4vh';                          /* 余白がなければ、足元の下に置く */
  },

  /* ポーズを、短いクロスフェードで入れ替える。
     同時に少しだけ大きくなり、数pxだけ前（上）へ出る。 */
  crossfadeSkyMiko: function (file, scale, ms) {
    const el = this.el('sky-miko');
    const img = this.el('sky-miko-img');
    const alt = this.el('sky-miko-img2');
    const dur = ms || 700;
    const width = Math.round(this.bridgeWidth() * (scale || 1));

    alt.src = 'assets/images/' + file;
    alt.style.transition = 'opacity ' + dur + 'ms var(--ease), width ' + dur + 'ms var(--ease)';
    el.style.setProperty('--miko-move', dur + 'ms');

    this.placeBridgeLine(width);
    requestAnimationFrame(function () {
      alt.style.opacity = '1';
      el.style.setProperty('--miko-w', width + 'px');
      /* 数pxだけ、こちらへ出てくるように */
      el.style.setProperty('--miko-y', '14.2%');
    });

    const self = this;
    return this.sleep(dur + 60).then(function () {
      img.src = 'assets/images/' + file;
      alt.style.transition = 'none';
      alt.style.opacity = '0';
      return self.sleep(40);
    });
  },

  clearBridge: function () {
    const el = this.el('sky-miko');
    el.classList.remove('is-bridge');
    el.style.transition = '';
    /* 演出の途中で画面が変わっても、ミコが透明のまま残らないようにする */
    el.style.opacity = '1';
    document.body.classList.remove('is-bridge-sky');
    this.el('sky-miko-img2').style.opacity = '0';
    const line = this.el('sky-message');
    line.style.top = '';
    line.style.bottom = '';
  },

  /* 最後の「眺める」画面のミコ。
     正面で、両手を下ろして少し広げた絵（miko-offer.png）があればそれを使い、
     無ければ正面の miko-main.png を使う。 */
  setFinalMiko: function () {
    const img = this.el('sky-miko-img');
    const el = this.el('sky-miko');
    el.classList.remove('is-placing');
    el.classList.add('is-offering');
    el.style.opacity = '1';

    const probe = new Image();
    probe.onload = function () { img.src = 'assets/images/miko-offer.png'; };
    probe.onerror = function () { img.src = 'assets/images/miko-main.png'; };
    probe.src = 'assets/images/miko-offer.png';
  },

  setSkyMiko: function (file) {
    this.el('sky-miko-img').src = 'assets/images/' + file;
    /* 置く姿勢の絵は手が右へ伸びているので、左右反転して手を道の側（左）へ向ける */
    this.el('sky-miko').classList.toggle('is-placing', file === 'miko-place.png');
    this.el('sky-miko').classList.remove('is-offering');
  },

  /* ミコが道のどこまで進んだか（0〜1）。
     道は手前の下から、月のほうへ細くなっていくので、進むほど上・右・小さくなる。 */
  /* offsetX を渡すと、その位置から少しだけずらして立たせる（短いスライド用） */
  setSkyMikoProgress: function (t, ms, offsetX) {
    const p = Math.max(0, Math.min(1, t));
    const point = this.roadPoint(p);
    const dx = offsetX || 0;
    const el = this.el('sky-miko');
    el.style.setProperty('--miko-move', (ms === undefined ? 2600 : ms) + 'ms');
    el.style.setProperty('--miko-x', ((point.x + dx) / this.vw() * 100) + '%');
    /* 足元が道に乗るように、少しだけ持ち上げる */
    el.style.setProperty('--miko-y', ((this.vh() - point.y) / this.vh() * 100 - 1) + '%');
    el.style.setProperty('--miko-w', (128 - (128 - 46) * p) + 'px');
    this.mikoProgress = p;
  },

  mikoProgress: 0,

  /* 眺める画面など、決まった場所に立たせるとき */
  setSkyMikoSpot: function (xPercent, yPercent, widthPx, ms) {
    const el = this.el('sky-miko');
    el.style.setProperty('--miko-move', (ms === undefined ? 2000 : ms) + 'ms');
    el.style.setProperty('--miko-x', xPercent + '%');
    el.style.setProperty('--miko-y', yPercent + '%');
    el.style.setProperty('--miko-w', widthPx + 'px');
  },

  /* ことばの札が、画面からはみ出したり、重なったりしないようにする */
  layoutLabels: function () {
    const crystals = document.querySelectorAll('#crystal-field .crystal--placed');
    const w = this.vw();
    const placed = [];

    for (let i = 0; i < crystals.length; i++) {
      const label = crystals[i].querySelector('.crystal-label');
      if (!label) continue;

      label.style.transform = '';
      const cx = crystals[i].getBoundingClientRect().left + 29;

      /* 画面の左半分にある結晶は右へ、右半分にある結晶は左へ */
      label.classList.toggle('crystal-label--left', cx > w * 0.5);

      let r = label.getBoundingClientRect();
      if (r.right > w - 8) label.classList.add('crystal-label--left');
      else if (r.left < 8) label.classList.remove('crystal-label--left');

      /* 1回目は「はみ出さない、かつ重ならない」場所を探し、
         見つからなければ2回目は「はみ出さない」ことを優先する */
      const wantLeft = label.classList.contains('crystal-label--left');
      const sides = [wantLeft, !wantLeft];
      const shifts = [0, -26, 26, -52, 52];
      let done = false;

      for (let pass = 0; pass < 2 && !done; pass++) {
        for (let a = 0; a < sides.length && !done; a++) {
          label.classList.toggle('crystal-label--left', sides[a]);
          for (let k = 0; k < shifts.length; k++) {
            label.style.transform = shifts[k] ? 'translateY(' + shifts[k] + 'px)' : '';
            r = label.getBoundingClientRect();
            if (r.right > w - 6 || r.left < 6) continue;

            let hit = false;
            if (pass === 0) {
              for (let j = 0; j < placed.length; j++) {
                const o = placed[j];
                if (r.left < o.right + 8 && r.right > o.left - 8 &&
                    r.top < o.bottom + 6 && r.bottom > o.top - 6) { hit = true; break; }
              }
            }
            if (!hit) { done = true; break; }
          }
        }
      }

      placed.push(label.getBoundingClientRect());
    }
  },

  /* ---------- カメラ（背景が1枚の画像なので、いまは動かさない） ---------- */
  cam: 0,
  camY: 0,
  zoom: 1,

  world: function () { return this.el('world'); },
  vw: function () { return window.innerWidth; },
  vh: function () { return window.innerHeight; },

  moveCam: function (px, ms) {
    this.cam = px;
    const w = this.world();
    w.style.setProperty('--pan', (ms === undefined ? 2400 : ms) + 'ms');
    w.style.setProperty('--cam', px + 'px');
    this.setCamY(px * CLIMB, ms);
  },

  setCamY: function (py, ms) {
    this.camY = py;
    const w = this.world();
    w.style.setProperty('--pan', (ms === undefined ? 2400 : ms) + 'ms');
    w.style.setProperty('--camy', py + 'px');
  },

  setZoom: function (zoom, ms) {
    this.zoom = zoom;
    const w = this.world();
    w.style.setProperty('--pan', (ms === undefined ? 2400 : ms) + 'ms');
    w.style.setProperty('--zoom', zoom);
    const size = Math.min(96, Math.round(58 / Math.max(zoom, 0.4)));
    w.style.setProperty('--crystal-size', size + 'px');
    const label = Math.min(20, Math.round(13 / Math.max(zoom, 0.4)));
    w.style.setProperty('--label-size', label + 'px');
  },

  resetCamera: function () {
    this.cam = 0;
    this.camY = 0;
    this.zoom = 1;
    const w = this.world();
    w.style.setProperty('--pan', '0ms');
    w.style.setProperty('--cam', '0px');
    w.style.setProperty('--camy', '0px');
    w.style.setProperty('--zoom', '1');
    w.style.setProperty('--crystal-size', '58px');
  },

  /* 置いた結晶の数から、道のどこまで来たかを決める */
  /* 結晶を置いた数から、ミコがいま道のどこに立っているかを決める */
  progressFor: function (count) {
    const i = Math.max(0, Math.min(count, MIKO_STEPS.length - 1));
    return MIKO_STEPS[i];
  },

  /* ---------- 背景画像 ---------- */
  /* 'pickup' … Q1の拾う演出 ／ 'overview' … 夜空全体 */
  setScene: function (name) {
    const b = document.body;
    b.classList.toggle('bg-pickup', name === 'pickup');
    b.classList.toggle('bg-overview', name === 'overview');
  },

  /* 背景画像は cover で表示されるので、画像の中の位置 (u,v) が
     いま画面のどこに来ているかを計算する */
  imagePoint: function (u, v) {
    const vw = this.vw();
    const vh = this.vh();
    const scale = Math.max(vw / BG_IMAGE_W, vh / BG_IMAGE_H);
    const w = BG_IMAGE_W * scale;
    const h = BG_IMAGE_H * scale;
    return {
      x: (vw - w) / 2 + u * w,
      y: (vh - h) / 2 + v * h
    };
  },

  /* 光の道の、t（0=手前 〜 1=月のそば）の地点 */
  roadPoint: function (t) {
    const pts = ROAD_POINTS.map(function (p) { return UI.imagePoint(p.u, p.v); });

    let total = 0;
    const seg = [];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      seg.push(d);
      total += d;
    }

    const target = Math.max(0, Math.min(1, t)) * total;
    let walked = 0;
    for (let i = 0; i < seg.length; i++) {
      if (walked + seg[i] >= target || i === seg.length - 1) {
        const k = seg[i] === 0 ? 0 : (target - walked) / seg[i];
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        return {
          x: a.x + dx * k,
          y: a.y + dy * k,
          /* 道に対して横向きの方向（結晶を道の脇へ置くために使う） */
          nx: -dy / len,
          ny: dx / len
        };
      }
      walked += seg[i];
    }
    return { x: pts[0].x, y: pts[0].y, nx: 1, ny: 0 };
  },

  /* 結晶を置く場所。ミコが立っている足元（道の上）の、少し左側 */
  crystalPointFor: function (index) {
    const t = MIKO_STEPS[Math.max(0, Math.min(index, MIKO_STEPS.length - 1))];
    const p = this.roadPoint(t);
    const vw = this.vw();
    const dist = vw * CRYSTAL_SIDE_OFFSET;

    /* 道に対して直角の向きのうち、画面の左側へ寄るほうを選ぶ */
    const sign = (p.nx < 0) ? 1 : -1;
    let x = p.x + p.nx * dist * sign;
    const y = p.y + p.ny * dist * sign;

    x = Math.max(vw * 0.10, Math.min(vw * 0.90, x));

    /* ことばの札は、結晶が画面の左半分なら右へ、右半分なら左へ */
    return { x: x, y: y, side: (x < vw * 0.5 ? 'r' : 'l') };
  },

  /* 小さいミコの、結晶をのせている手のあたり（置く姿勢は左右反転している） */
  skyHandPoint: function () {
    const r = this.el('sky-miko-img').getBoundingClientRect();
    const placing = this.el('sky-miko').classList.contains('is-placing');
    const u = placing ? 0.17 : 0.83;
    return { x: r.left + r.width * u, y: r.top + r.height * 0.30 };
  },

  /* ---------- 座標のヘルパー ---------- */
  centerOf: function (element) {
    const r = element.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },

  /* 置き場所（いまの画面から見た割合）→ 夜空の中の座標 */
  spotToWorld: function (spot) {
    return {
      x: this.cam + this.vw() * spot.x,
      y: this.vh() * spot.y / 100 - this.camY
    };
  },

  /* 夜空の中の座標 → いま画面のどこに見えているか */
  worldToScreen: function (world) {
    return {
      x: (world.x - this.cam - this.vw() / 2) * this.zoom + this.vw() / 2,
      y: (world.y + this.camY - this.vh() / 2) * this.zoom + this.vh() / 2
    };
  },

  /* ---------- 結晶 ---------- */
  /* 移動中の結晶（1つだけ・画面の座標で動かす） */
  createFlyingCrystal: function (point) {
    const img = document.createElement('img');
    img.src = 'assets/images/crystal.png';
    img.className = 'crystal crystal--flying';
    img.alt = '';
    img.style.left = point.x + 'px';
    img.style.top = point.y + 'px';
    this.el('flight-layer').appendChild(img);
    requestAnimationFrame(function () { img.classList.add('is-visible'); });
    return img;
  },

  moveFlyingCrystal: function (img, point) {
    img.style.left = point.x + 'px';
    img.style.top = point.y + 'px';
  },

  glowFlyingCrystal: function (img) {
    img.classList.add('is-glowing');
  },

  removeFlyingCrystal: function (img) {
    if (img && img.parentNode) img.parentNode.removeChild(img);
  },

  /* 線を引くための場所を、必要なら作り直す */
  ensureConstellation: function () {
    let svg = this.el('constellation');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'constellation';
      svg.setAttribute('aria-hidden', 'true');
      const field = this.el('crystal-field');
      field.insertBefore(svg, field.firstChild);
    }
    return svg;
  },

  /* 置いた結晶を、光の線でつなぐ */
  drawConstellation: function () {
    const svg = this.ensureConstellation();
    const field = this.el('crystal-field');
    const nodes = field.querySelectorAll('.crystal--placed');

    const w = field.getBoundingClientRect().width / this.zoom;
    const h = field.getBoundingClientRect().height / this.zoom;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML = '';
    if (nodes.length < 2) return;

    let d = '';
    for (let i = 0; i < nodes.length; i++) {
      const x = parseFloat(nodes[i].style.left);
      const y = parseFloat(nodes[i].style.top);
      d += (i === 0 ? 'M' : ' L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }

    const ns = 'http://www.w3.org/2000/svg';
    ['line-soft', 'line-core'].forEach(function (cls) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', cls);
      svg.appendChild(path);
    });
  },

  /* 夜空に残る結晶。歩いてきた道のうえに置かれる */
  placeCrystalInSky: function (questionId, world, onTap, labelText, side) {
    const field = this.el('crystal-field');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'crystal crystal--placed';
    btn.style.left = world.x + 'px';
    btn.style.top = world.y + 'px';
    btn.dataset.questionId = questionId;
    btn.setAttribute('aria-label', 'ことばのかけらを見る');
    btn.innerHTML = '<img src="assets/images/crystal.png" alt="">';

    if (labelText) {
      const label = document.createElement('span');
      label.className = 'crystal-label' + (side === 'l' ? ' crystal-label--left' : '');
      label.textContent = labelText;
      btn.appendChild(label);
    }

    btn.addEventListener('click', function () { onTap(questionId); });
    field.appendChild(btn);
    requestAnimationFrame(function () { btn.classList.add('is-visible'); });
    this.drawConstellation();
    return btn;
  },

  clearSky: function () {
    this.el('crystal-field').innerHTML = '';
    this.ensureConstellation();
    this.el('flight-layer').innerHTML = '';
    this.resetCamera();
  },

  /* 結晶をタップできる状態にする（最終夜空画面のみ） */
  setCrystalsTappable: function (tappable) {
    this.el('crystal-field').classList.toggle('is-tappable', !!tappable);
  },

  /* ---------- 小さな表示ヘルパー ---------- */
  setText: function (id, text) {
    this.el(id).textContent = text;
  },

  setHidden: function (id, hidden) {
    this.el(id).classList.toggle('hidden', !!hidden);
  },

  /* ミコのひとこと（静かに出す） */
  showMikoLine: function (text) {
    const line = this.el('sky-message');
    line.textContent = text;
    line.classList.remove('is-visible');
    requestAnimationFrame(function () { line.classList.add('is-visible'); });
  },

  hideMikoLine: function () {
    const line = this.el('sky-message');
    line.classList.remove('is-visible');
    line.textContent = '';
  }
};
