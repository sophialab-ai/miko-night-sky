/* image.js
   まとめの内容を、夜空の色をした1枚の画像にする。
   ブラウザの中だけで描き、どこへも送らない。
   本人が書いた文章はそのまま載せる。要約・省略・言い換えはしない。 */

const ImageCard = {
  W: 1080,          // 画像の幅
  PAD: 72,          // 左右の余白
  MAX_H: 3600,      // 1枚の高さの上限（これを超えたら次の紙へ）

  /* 夜空の色 */
  COLORS: {
    top: '#0a0e2a',
    mid: '#1b1746',
    bottom: '#2e2154',
    title: '#f4f1ff',
    dim: '#b6bce0',
    text: '#ffffff',
    line: 'rgba(182, 188, 224, 0.28)',
    crystal: '#ffe6a6'
  },

  font: function (weight, size) {
    return weight + ' ' + size + 'px "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif';
  },

  /* 1行に収まらない文章を、幅で折り返す。文字は削らない */
  wrap: function (ctx, text, maxWidth) {
    const out = [];
    const paragraphs = String(text).split('\n');

    paragraphs.forEach(function (para) {
      if (para === '') { out.push(''); return; }
      let line = '';
      for (let i = 0; i < para.length; i++) {
        const next = line + para[i];
        if (ctx.measureText(next).width > maxWidth && line !== '') {
          out.push(line);
          line = para[i];
        } else {
          line = next;
        }
      }
      if (line !== '') out.push(line);
    });

    return out;
  },

  /* 載せるものを、ひとかたまりずつ用意する */
  buildBlocks: function (ctx, session) {
    const self = this;
    const inner = this.W - this.PAD * 2;
    const blocks = [];

    const add = function (kind, text, fontSize, weight, gapAfter) {
      ctx.font = self.font(weight, fontSize);
      const lines = self.wrap(ctx, text, inner - (kind === 'answer' ? 40 : 0));
      blocks.push({
        kind: kind,
        lines: lines,
        size: fontSize,
        weight: weight,
        height: lines.length * Math.round(fontSize * 1.65) + gapAfter
      });
    };

    QUESTIONS.forEach(function (q) {
      const data = session.questions[q.id];
      if (!data || data.skipped || !data.answered) return;

      add('question', q.text, 27, 'normal', 10);
      add('answer', data.answer, 34, 'normal', 30);

      if (q.followUp && data.followUpAnswer) {
        add('question', q.followUp.text, 27, 'normal', 10);
        add('answer', data.followUpAnswer, 34, 'normal', 30);
      }
      blocks.push({ kind: 'divider', lines: [], height: 34 });
    });

    const reflections = [
      { q: 'ここまで自分の言葉を見てきて、今、何を思う？', a: session.reflection1 },
      { q: 'ここまで見てきて、次、何をする？', a: session.reflection2 }
    ];

    reflections.forEach(function (r) {
      if (!r.a) return;
      add('question', r.q, 27, 'normal', 10);
      add('answer', r.a, 34, 'normal', 30);
      blocks.push({ kind: 'divider', lines: [], height: 34 });
    });

    return blocks;
  },

  /* 夜空の下地。星は毎回同じ位置に出るようにする */
  paintSky: function (ctx, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, this.COLORS.top);
    g.addColorStop(0.55, this.COLORS.mid);
    g.addColorStop(1, this.COLORS.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, h);

    let seed = 20260926;
    const rand = function () {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    const count = Math.round(h / 14);
    for (let i = 0; i < count; i++) {
      const x = rand() * this.W;
      const y = rand() * h;
      const r = rand() * 1.9 + 0.5;
      ctx.globalAlpha = 0.25 + rand() * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  drawHeader: function (ctx, miko, dateText, pageText) {
    const P = this.PAD;

    if (miko) {
      const w = 150;
      const h = w * (miko.naturalHeight / miko.naturalWidth);
      ctx.drawImage(miko, P, 54, w, h);
    }

    ctx.fillStyle = this.COLORS.title;
    ctx.font = this.font('bold', 46);
    ctx.fillText('ミコと一緒に歩いた夜空', P + 180, 112);

    ctx.fillStyle = this.COLORS.dim;
    ctx.font = this.font('normal', 26);
    ctx.fillText('今日ひろって、夜空に置いたことば', P + 180, 154);
    ctx.fillText(dateText + (pageText ? '　' + pageText : ''), P + 180, 194);

    ctx.strokeStyle = this.COLORS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(P, 236);
    ctx.lineTo(this.W - P, 236);
    ctx.stroke();

    return 300;
  },

  drawFooter: function (ctx, h) {
    ctx.strokeStyle = this.COLORS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.PAD, h - 92);
    ctx.lineTo(this.W - this.PAD, h - 92);
    ctx.stroke();

    ctx.fillStyle = this.COLORS.dim;
    ctx.font = this.font('normal', 24);
    ctx.fillText('ミコと一緒に歩く夜空', this.PAD, h - 48);
  },

  drawBlock: function (ctx, block, y) {
    const P = this.PAD;
    const step = Math.round(block.size * 1.65);

    if (block.kind === 'divider') {
      ctx.strokeStyle = this.COLORS.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(P, y + 10);
      ctx.lineTo(this.W - P, y + 10);
      ctx.stroke();
      return y + block.height;
    }

    ctx.font = this.font(block.weight, block.size);
    ctx.fillStyle = (block.kind === 'question') ? this.COLORS.dim : this.COLORS.text;

    let cy = y + block.size;
    const x = P + (block.kind === 'answer' ? 40 : 0);

    block.lines.forEach(function (line, i) {
      if (block.kind === 'answer' && i === 0) {
        /* 答えの頭に、小さな結晶の光を置く */
        ctx.save();
        ctx.fillStyle = ImageCard.COLORS.crystal;
        ctx.shadowColor = ImageCard.COLORS.crystal;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(P + 14, cy - 11, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = ImageCard.COLORS.text;
        ctx.font = ImageCard.font(block.weight, block.size);
      }
      ctx.fillText(line, x, cy);
      cy += step;
    });

    return y + block.height;
  },

  loadMiko: function () {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = 'assets/images/miko-main.png';
    });
  },

  /* まとめの画像を作る。長いときは複数枚に分ける */
  build: function (session) {
    const self = this;

    return this.loadMiko().then(function (miko) {
      const measure = document.createElement('canvas').getContext('2d');
      const blocks = self.buildBlocks(measure, session);

      const today = Pdf.formatDate(new Date());
      const headerH = 300;
      const footerH = 140;
      const budget = self.MAX_H - headerH - footerH;

      /* 何枚に分かれるかを先に決める */
      const pages = [];
      let current = [];
      let used = 0;

      blocks.forEach(function (b) {
        if (used + b.height > budget && current.length > 0) {
          pages.push(current);
          current = [];
          used = 0;
        }
        current.push(b);
        used += b.height;
      });
      if (current.length > 0) pages.push(current);

      /* 1枚ずつ描く */
      return pages.map(function (pageBlocks, index) {
        const contentH = pageBlocks.reduce(function (a, b) { return a + b.height; }, 0);
        const h = Math.max(900, headerH + contentH + footerH);

        const canvas = document.createElement('canvas');
        canvas.width = self.W;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'alphabetic';

        self.paintSky(ctx, h);

        const pageText = (pages.length > 1) ? ((index + 1) + ' / ' + pages.length) : '';
        let y = self.drawHeader(ctx, miko, today.jp, pageText);

        pageBlocks.forEach(function (b) { y = self.drawBlock(ctx, b, y); });

        self.drawFooter(ctx, h);

        return {
          url: canvas.toDataURL('image/jpeg', 0.92),
          name: 'miko-night-sky-' + today.iso + (pages.length > 1 ? '-' + (index + 1) : '') + '.jpg'
        };
      });
    });
  }
};
