/* pdf.js
   ブラウザの印刷機能でPDFを作る（A4横・白ベース）。
   外部サービスへは何も送らない。表示するのは本人が書いた文章そのまま。 */

const Pdf = {
  formatDate: function (date) {
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    return { iso: y + '-' + m + '-' + d, jp: y + '年' + m + '月' + d + '日' };
  },

  buildPrintView: function (session) {
    const root = UI.el('print-root');
    root.innerHTML = '';
    const today = this.formatDate(new Date());

    /* ヘッダー */
    const header = document.createElement('div');
    header.className = 'print-header';

    const miko = document.createElement('img');
    miko.src = 'assets/images/miko-main.png';
    miko.alt = '';
    header.appendChild(miko);

    const titleBox = document.createElement('div');
    const h1 = document.createElement('h1');
    h1.className = 'print-title';
    h1.textContent = 'ミコと一緒に歩いた夜空';
    const sub = document.createElement('p');
    sub.className = 'print-subtitle';
    sub.textContent = '今日ひろって、夜空に置いたことば';
    titleBox.appendChild(h1);
    titleBox.appendChild(sub);
    header.appendChild(titleBox);

    const dateEl = document.createElement('p');
    dateEl.className = 'print-date';
    dateEl.textContent = today.jp;
    header.appendChild(dateEl);

    root.appendChild(header);

    /* 質問と回答 */
    const grid = document.createElement('div');
    grid.className = 'print-grid';

    QUESTIONS.forEach(function (q) {
      const data = session.questions[q.id];
      if (!data || data.skipped || !data.answered) return;

      const item = document.createElement('div');
      item.className = 'print-item';

      const qEl = document.createElement('p');
      qEl.className = 'print-q';
      qEl.textContent = q.text;
      item.appendChild(qEl);

      const aEl = document.createElement('p');
      aEl.className = 'print-a';
      aEl.textContent = data.answer;
      item.appendChild(aEl);

      if (q.followUp && data.followUpAnswer) {
        const fqEl = document.createElement('p');
        fqEl.className = 'print-q';
        fqEl.textContent = q.followUp.text;
        item.appendChild(fqEl);

        const faEl = document.createElement('p');
        faEl.className = 'print-a';
        faEl.textContent = data.followUpAnswer;
        item.appendChild(faEl);
      }

      grid.appendChild(item);
    });

    root.appendChild(grid);

    /* 振り返り */
    const reflections = [
      { q: 'ここまで自分の言葉を見てきて、今、何を思う？', a: session.reflection1 },
      { q: 'ここまで見てきて、次、何をする？', a: session.reflection2 }
    ];

    reflections.forEach(function (r) {
      if (!r.a) return;
      const box = document.createElement('div');
      box.className = 'print-reflect';
      const qEl = document.createElement('p');
      qEl.className = 'print-q';
      qEl.textContent = r.q;
      const aEl = document.createElement('p');
      aEl.className = 'print-a';
      aEl.textContent = r.a;
      box.appendChild(qEl);
      box.appendChild(aEl);
      root.appendChild(box);
    });

    /* 書き足せる余白 */
    const space = document.createElement('div');
    space.className = 'print-space';
    space.textContent = 'あとから思いついたことば';
    root.appendChild(space);

    const footer = document.createElement('p');
    footer.className = 'print-footer';
    footer.textContent = 'ミコと一緒に歩く夜空　' + today.jp;
    root.appendChild(footer);

    return today.iso;
  },

  generate: function (session) {
    const iso = this.buildPrintView(session);
    const originalTitle = document.title;
    /* 多くのブラウザで、保存時のファイル名の初期値にタイトルが使われる */
    document.title = 'miko-night-sky-' + iso;

    const restore = function () {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    setTimeout(restore, 60000);

    window.print();
  }
};
