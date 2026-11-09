/*!
 * A.max — print / save-as-PDF host
 * Created by Arash Makki | Released under the MIT License
 */
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const key = params.get('key');
  const autoprint = params.get('print') !== '0';
  const frame = document.getElementById('frame');
  const stage = document.getElementById('stage');
  const btnPrint = document.getElementById('btn-print');
  const btnHtml = document.getElementById('btn-html');
  const btnClose = document.getElementById('btn-close');

  let payload = null;
  let printed = false;

  // The exported document is written into a srcdoc iframe whose CSP forbids
  // external requests (`default-src 'none'`), so the self-hosted Vazirmatn face
  // is embedded as a data URL — that keeps the PDF text searchable and Persian.
  async function injectFonts() {
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.head) return;
      if (doc.querySelector('style[data-am-fonts]')) {
        await doc.fonts.ready;
        return;
      }
      const response = await fetch(chrome.runtime.getURL('dist/fonts/vazirmatn-arabic.woff2'));
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunk));
      }
      const style = doc.createElement('style');
      style.dataset.amFonts = '1';
      style.textContent = `@font-face{font-family:'Vazirmatn';font-style:normal;font-weight:400 700;font-display:block;src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2')}`;
      doc.head.appendChild(style);
      await doc.fonts.ready;
    } catch (error) {
      console.warn('A.max: font injection skipped.', error);
    }
  }

  function fallback(message) {
    stage.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'fallback';
    box.textContent = message;
    stage.appendChild(box);
    btnPrint.disabled = true;
    btnHtml.disabled = true;
  }

  function doPrint() {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (error) {
      try {
        window.print();
      } catch (inner) {
        fallback('چاپ خودکار ممکن نشد. از منوی مرورگر (Ctrl+P) استفاده کنید.');
      }
    }
  }

  btnPrint.addEventListener('click', doPrint);

  btnClose.addEventListener('click', () => {
    window.close();
  });

  btnHtml.addEventListener('click', () => {
    if (!payload) return;
    const blob = new Blob([payload.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
      anchor.download = (payload.filename || 'a-max-chat').replace(/\.pdf$/i, '') + '.html';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  });

  function run() {
    if (!key) {
      fallback('محتوایی برای نمایش پیدا نشد.');
      return;
    }
    if (!chrome.storage || !chrome.storage.local) {
      fallback('دسترسی به حافظه افزونه ممکن نشد.');
      return;
    }
    chrome.storage.local.get(key, (result) => {
      void (chrome.runtime && chrome.runtime.lastError);
      const data = result && result[key];
      if (!data || !data.html) {
        fallback('محتوای چاپ منقضی شده است. دوباره از افزونه خروجی بگیرید.');
        return;
      }
      payload = data;
      document.title = (data.filename || 'A.max').replace(/\.(pdf|html)$/i, '') + ' — A.max';
      frame.addEventListener('load', async () => {
        if (!payload) return;
        await injectFonts();
        if (!autoprint || printed) return;
        printed = true;
        doPrint();
      });
      frame.srcdoc = data.html;
      chrome.storage.local.remove(key, () => void (chrome.runtime && chrome.runtime.lastError));
    });
  }

  run();
})();
