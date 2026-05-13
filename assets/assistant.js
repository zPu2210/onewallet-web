/* ONEWALLET Circle-style assistant widget
 * Renders: nav icon button + bottom-center liquid-glass pill + centered modal + disclosure subview.
 * Knowledge: window.ONEWALLET_ASSISTANT.STR (see assistant-knowledge.js).
 */
(function () {
  const KEY_STORE = 'onewallet_lang';
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');

  function lang() {
    try { return localStorage.getItem(KEY_STORE) || document.documentElement.lang || 'en'; }
    catch (e) { return document.documentElement.lang || 'en'; }
  }
  function S() {
    const all = window.ONEWALLET_ASSISTANT && window.ONEWALLET_ASSISTANT.STR;
    if (!all) return null;
    return all[lang()] || all.en;
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}$]+/gu, ' ').trim();
  }
  function bestMatch(query, items) {
    const terms = normalize(query).split(/\s+/).filter(t => t.length > 1);
    if (!terms.length) return null;
    let best = null;
    for (const item of items) {
      const hay = normalize([item.q, item.a, item.k].join(' '));
      const score = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
      if (!best || score > best.score) best = { item, score };
    }
    return best && best.score > 0 ? best.item : null;
  }

  function resolveHref(href) {
    if (!href) return '';
    const onWhitepaper = /whitepaper\.html$/.test(location.pathname);
    if (onWhitepaper && href.startsWith('#')) return 'index.html' + href;
    return href;
  }

  function iconAi() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"/><path d="M19 14l.7 1.9L21.5 16.5l-1.8.7L19 19l-.7-1.8L16.5 16.5l1.8-.6L19 14z"/></svg>';
  }
  function iconClose() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  }
  function iconBack() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6 9 12l6 6"/></svg>';
  }
  function iconArrow() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
  }

  // ── State ─────────────────────────────────────────────────────────────
  let isOpen = false;
  let view = 'home'; // 'home' | 'answering' | 'disclosure'
  let history = []; // [{role:'user'|'bot', text, link, href}]
  let lastFocus = null;

  // ── DOM refs (built once) ─────────────────────────────────────────────
  let root, modal, backdrop, body, form, input, head, navBtn, pill;

  function mount() {
    const t = S();
    if (!t) return;

    // Nav icon button — slot into .nav-cta before .lang-switch
    const navCta = document.querySelector('.nav-cta') || document.querySelector('.bar-inner');
    if (navCta && !navCta.querySelector('.ow-nav-ai')) {
      navBtn = document.createElement('button');
      navBtn.type = 'button';
      navBtn.className = 'ow-nav-ai';
      navBtn.setAttribute('aria-label', t.navLabel);
      navBtn.setAttribute('aria-keyshortcuts', isMac ? 'Meta+K' : 'Control+K');
      navBtn.innerHTML = iconAi();
      navBtn.addEventListener('click', () => open());
      const langSwitch = navCta.querySelector('.lang-switch');
      if (langSwitch) navCta.insertBefore(navBtn, langSwitch);
      else navCta.insertBefore(navBtn, navCta.firstChild);
    }

    // Bottom-center glass pill
    pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'ow-ask-pill';
    pill.setAttribute('aria-label', t.pillText);
    pill.setAttribute('aria-keyshortcuts', isMac ? 'Meta+K' : 'Control+K');
    pill.innerHTML =
      '<span class="ow-pill-text">' + t.pillText + '</span>' +
      '<kbd class="ow-pill-key">' + (isMac ? t.pillKey : t.pillKeyAlt) + '</kbd>' +
      '<span class="ow-pill-go">' + iconAi() + '</span>';
    pill.addEventListener('click', () => open());
    document.body.appendChild(pill);

    // Backdrop + modal
    root = document.createElement('div');
    root.className = 'ow-modal-root';
    root.hidden = true;
    root.innerHTML =
      '<div class="ow-backdrop" data-close="1"></div>' +
      '<div class="ow-modal" role="dialog" aria-modal="true" aria-labelledby="owModalTitle">' +
        '<header class="ow-modal-head">' +
          '<button type="button" class="ow-back" aria-label="' + t.back + '" hidden>' + iconBack() + '<span>' + t.back + '</span></button>' +
          '<span class="ow-modal-icon" aria-hidden="true">' + iconAi() + '</span>' +
          '<div class="ow-modal-titles">' +
            '<h2 id="owModalTitle">' + t.title + '</h2>' +
            '<p class="ow-modal-sub">' + t.subtitle + '</p>' +
          '</div>' +
          '<button type="button" class="ow-close" data-close="1" aria-label="' + t.close + '">' + iconClose() + '</button>' +
        '</header>' +
        '<div class="ow-modal-body" tabindex="-1"></div>' +
        '<form class="ow-modal-form" autocomplete="off">' +
          '<div class="ow-form-row">' +
            '<input type="text" name="q" autocomplete="off" placeholder="' + t.placeholder + '" aria-label="' + t.placeholder + '" />' +
            '<button type="submit" aria-label="' + t.send + '">' + iconArrow() + '</button>' +
          '</div>' +
          '<button type="button" class="ow-disclosure-link">' + t.readDisclosure + '</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(root);

    modal    = root.querySelector('.ow-modal');
    backdrop = root.querySelector('.ow-backdrop');
    body     = root.querySelector('.ow-modal-body');
    form     = root.querySelector('.ow-modal-form');
    input    = root.querySelector('.ow-modal-form input');
    head     = root.querySelector('.ow-modal-head');

    root.addEventListener('click', (e) => {
      if (e.target instanceof HTMLElement && e.target.dataset.close === '1') close();
    });
    head.querySelector('.ow-back').addEventListener('click', () => { view = history.length ? 'answering' : 'home'; render(); });
    head.querySelector('.ow-close').addEventListener('click', () => close());
    form.querySelector('.ow-disclosure-link').addEventListener('click', () => { view = 'disclosure'; render(); });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      const t = S();
      const match = bestMatch(q, t.items);
      history.push({ role: 'user', text: q });
      if (match) history.push({ role: 'bot', text: match.a, href: match.href, link: match.link });
      else history.push({ role: 'bot', text: t.fallback });
      view = 'answering';
      input.value = '';
      render();
    });

    render();
  }

  function render() {
    const t = S();
    if (!t || !root) return;

    // Update header copy (language switch)
    head.querySelector('#owModalTitle').textContent = (view === 'disclosure') ? t.disclosureTitle : t.title;
    head.querySelector('.ow-modal-sub').textContent = t.subtitle;
    head.querySelector('.ow-back').hidden = (view !== 'disclosure');
    head.querySelector('.ow-back').querySelector('span').textContent = t.back;
    head.querySelector('.ow-close').setAttribute('aria-label', t.close);
    if (navBtn) navBtn.setAttribute('aria-label', t.navLabel);
    if (pill) {
      pill.setAttribute('aria-label', t.pillText);
      pill.querySelector('.ow-pill-text').textContent = t.pillText;
      pill.querySelector('.ow-pill-key').textContent = isMac ? t.pillKey : t.pillKeyAlt;
    }
    input.placeholder = t.placeholder;
    input.setAttribute('aria-label', t.placeholder);
    form.querySelector('.ow-disclosure-link').textContent = t.readDisclosure;

    // Body content
    if (view === 'disclosure') {
      form.hidden = true;
      body.innerHTML =
        '<div class="ow-disclosure">' +
          t.disclosure.map((p) => '<p>' + p + '</p>').join('') +
          '<ul class="ow-disclosure-links">' +
            t.disclosureLinks.map((l) => {
              const href = resolveHref(l.href);
              const ext = /^https?:/.test(href);
              return '<li><a href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + l.label + iconArrow() + '</a></li>';
            }).join('') +
          '</ul>' +
        '</div>';
      return;
    }

    form.hidden = false;

    if (view === 'home' || history.length === 0) {
      const featured = t.items.filter((it) => it.featured).slice(0, 4);
      body.innerHTML =
        '<div class="ow-intro">' +
          '<p class="ow-intro-text">' + t.subtitle + '</p>' +
          '<div class="ow-suggest-label">' + t.suggested + '</div>' +
          '<div class="ow-chips">' +
            featured.map((it) => '<button type="button" class="ow-chip" data-ask="' + it.id + '">' + it.q + iconArrow() + '</button>').join('') +
          '</div>' +
        '</div>';
      body.querySelectorAll('[data-ask]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = t.items.find((x) => x.id === btn.dataset.ask);
          if (!item) return;
          history.push({ role: 'user', text: item.q });
          history.push({ role: 'bot', text: item.a, href: item.href, link: item.link });
          view = 'answering';
          render();
          setTimeout(() => input && input.focus(), 0);
        });
      });
      return;
    }

    // answering
    body.innerHTML =
      '<ul class="ow-thread">' +
        history.map((m) => {
          if (m.role === 'user') return '<li class="ow-msg ow-msg-user">' + escapeHtml(m.text) + '</li>';
          const href = resolveHref(m.href || '');
          const ext = /^https?:/.test(href);
          const link = (href && m.link)
            ? '<a class="ow-msg-link" href="' + href + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + m.link + iconArrow() + '</a>'
            : '';
          return '<li class="ow-msg ow-msg-bot">' + escapeHtml(m.text) + link + '</li>';
        }).join('') +
      '</ul>';
    body.scrollTop = body.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function open() {
    if (!root) return;
    isOpen = true;
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add('ow-modal-locked');
    if (view === 'disclosure') view = history.length ? 'answering' : 'home';
    render();
    setTimeout(() => input && input.focus(), 50);
  }
  function close() {
    if (!root) return;
    isOpen = false;
    root.hidden = true;
    document.documentElement.classList.remove('ow-modal-locked');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  document.addEventListener('keydown', (e) => {
    const key = e.key;
    if ((e.metaKey || e.ctrlKey) && (key === 'k' || key === 'K')) {
      if (isTypingTarget(e.target) && !(root && root.contains(e.target))) return;
      e.preventDefault();
      isOpen ? close() : open();
      return;
    }
    if (key === 'Escape' && isOpen) { e.preventDefault(); close(); }
  });

  window.addEventListener('onewallet:lang', () => render());

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
