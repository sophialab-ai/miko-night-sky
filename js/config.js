/* config.js
   あとから変える場所を、ここ1か所にまとめています。
   （ここ以外のファイルには、URLを直接書かないでください） */

/* 体験後アンケート（Googleフォーム）。回答者が開くURLです。
   2026-09-23に、分岐つきの新しいフォームへ差し替えました。
   旧: https://forms.gle/kyrPZq9hbynfBjhf9 （回答は残してあります） */
const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfa2BVSnnm7TuHdf4UsWeg3T-Q2J1a0_vxgjeoXt-71xe7LUw/viewform';

/* 公開URL（記録用）。
   SNS向けの設定（og:url / og:image / twitter:image）は index.html の <head> にあります。
   公開先を変えるときは、この値と index.html の3か所を書き換えてください。 */
const PUBLIC_URL = 'https://sophialab-ai.github.io/miko-night-sky/';
