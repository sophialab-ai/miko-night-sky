/* intro.js  導入予告アニメーション（試作）

   質問に入る前に、2〜4秒ほどの短い予告を見せるための、独立した部品です。
   文字・入力欄・ボタンは出しません。画面全体を使った、短い絵本アニメです。

   使い方：
     <link rel="stylesheet" href="intro.css">
     <script src="js/intro.js"></script>
     Intro.play().then(function () { ... 次へ ... });

   外すとき：intro.css と js/intro.js を消すだけです。
   本編（app.js / ui.js / questions.js / storage.js / api.js / pdf.js）には手を入れていません。 */

const Intro = {
  /* アニメーション全体の長さ（ms）。CSSの遅延＋長さの合計に合わせています */
  DURATION: 6300,

  root: null,

  /* 予告用の画面を、必要になったときに作る */
  build: function () {
    if (this.root) return this.root;

    const box = document.createElement('div');
    box.id = 'intro-preview-animation';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML =
      '<div class="intro-bg intro-bg--pickup"></div>' +
      '<div class="intro-bg intro-bg--overview"></div>' +
      '<img class="intro-miko intro-miko--main"  src="assets/images/miko-main.png"  alt="">' +
      '<img class="intro-crystal intro-crystal--pick" src="assets/images/crystal.png" alt="">' +
      '<img class="intro-miko intro-miko--pick"  src="assets/images/miko-pick.png"  alt="">' +
      '<p class="intro-bubble">あっ、みつけた…！</p>' +
      '<img class="intro-miko intro-miko--back"  src="assets/images/miko-back.png"  alt="">' +
      '<img class="intro-miko intro-miko--place" src="assets/images/miko-place.png" alt="">' +
      '<img class="intro-miko intro-miko--back2" src="assets/images/miko-back.png"  alt="">' +
      '<img class="intro-crystal intro-crystal--sky" src="assets/images/crystal.png" alt="">';

    document.body.appendChild(box);
    this.root = box;
    return box;
  },

  /* 再生する。終わると解決するPromiseを返す */
  play: function () {
    const self = this;
    const box = this.build();

    /* 何度でも見られるように、いったんアニメーションを外してから付け直す */
    box.classList.remove('is-playing');
    void box.offsetWidth;

    /* 幕は「すぐ」おろす。
       ゆっくり出すと、その0.5秒のあいだ前の画面が透けて見えてしまうため。
       （閉じるときのフェードは、下でCSSに戻します） */
    box.style.transition = 'none';
    box.classList.add('is-playing');
    void box.offsetWidth;
    box.style.transition = '';

    return new Promise(function (resolve) {
      setTimeout(function () {
        /* 幕をおろしたまま、先に次の画面へ進んでもらう。
           そのあと幕を上げるので、前の画面が見えることがない。 */
        resolve();
        setTimeout(function () {
          box.classList.remove('is-playing');
        }, 80);
      }, self.DURATION + 600);
    });
  },

  /* 途中でやめる */
  stop: function () {
    if (this.root) this.root.classList.remove('is-playing');
  },

  /* 片づける（DOMごと消す） */
  destroy: function () {
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
  }
};
