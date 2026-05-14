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
  // English stopwords only — KO/JA/ZH tokens are kept (no shared question particles to drop).
  const STOPWORDS = new Set([
    'a','an','the','and','or','but','of','to','in','on','at','for','with','by','from',
    'is','are','was','were','be','been','being','am','do','does','did','done','doing',
    'have','has','had','will','would','can','could','should','may','might','must',
    'i','me','my','we','our','you','your','it','its','they','their','this','that',
    'how','what','why','when','where','who','which','whose','if','so','as','than','then',
    'about','into','onto','over','under','out','up','down','off','out','no','not','yes',
    'me','us','him','her','them','also'
  ]);
  function tokenize(value, { keepStopwords = false } = {}) {
    const toks = normalize(value).split(/\s+/).filter(t => t.length > 1);
    return keepStopwords ? toks : toks.filter(t => !STOPWORDS.has(t));
  }

  // ── Retrieval over JSON corpus when available; falls back to curated items.
  // Scoring: idf-weighted term hits, with title and tags boosted over text.
  let CORPUS = null;          // { meta, chunks } once loaded
  let CORPUS_INDEX = null;    // { idf: Map<term, number>, byLocale: { [loc]: PreparedChunk[] } }
  const RETRIEVAL_THRESHOLD = 1.2; // empirical floor before falling back

  function prepareChunk(c) {
    const titleTokens = tokenize(c.title);
    const tagTokens   = (c.tags || []).flatMap(tokenize);
    const textTokens  = tokenize(c.text);
    return { chunk: c, titleTokens, tagTokens, textTokens };
  }
  function buildIndex(corpus) {
    const byLocale = {};
    for (const c of corpus.chunks) (byLocale[c.locale] = byLocale[c.locale] || []).push(prepareChunk(c));
    // Compute IDF across the full corpus (locale-agnostic — small dictionary, locale tokens rarely overlap).
    const df = new Map();
    const all = corpus.chunks.length;
    for (const c of corpus.chunks) {
      const uniq = new Set([...tokenize(c.title), ...(c.tags || []).flatMap(tokenize), ...tokenize(c.text)]);
      for (const t of uniq) df.set(t, (df.get(t) || 0) + 1);
    }
    const idf = new Map();
    for (const [t, d] of df) idf.set(t, Math.log(1 + all / (1 + d)));
    return { idf, byLocale };
  }
  // Optional grounded-answer upgrade via Cloudflare Worker. Disabled unless
  // window.ONEWALLET_ASSISTANT_API_URL is set (build/deploy injects it).
  // Returns { answer, sources } on success, null otherwise. Never throws to caller.
  function askWorker(question) {
    const url = (typeof window !== 'undefined') && window.ONEWALLET_ASSISTANT_API_URL;
    if (!url) return Promise.resolve(null);
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 12000) : null;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: lang(), question }),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data || data.ok !== true || typeof data.answer !== 'string') return null;
        return { answer: data.answer, sources: data.sources || [] };
      })
      .catch(() => null)
      .finally(() => { if (timer) clearTimeout(timer); });
  }

  function loadCorpus() {
    // Resolve relative to site root so it works from index.html and whitepaper.html.
    const base = location.pathname.endsWith('whitepaper.html') ? '' : '';
    fetch(base + 'assets/assistant-knowledge.json', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.chunks) { CORPUS = data; CORPUS_INDEX = buildIndex(data); } })
      .catch(() => { /* offline / file:// → curated fallback remains */ });
  }

  function scoreChunk(prep, terms, idf) {
    let score = 0, hits = 0, titleOrTagHit = false;
    for (const t of terms) {
      const w = idf.get(t) || 0.4;
      const inTitle = prep.titleTokens.includes(t);
      const inTag   = prep.tagTokens.includes(t);
      const inText  = prep.textTokens.includes(t);
      if (inTitle) score += w * 2.2;
      if (inTag)   score += w * 1.6;
      if (inText)  score += w * 1.0;
      if (inTitle || inTag || inText) hits++;
      if (inTitle || inTag) titleOrTagHit = true;
    }
    return { score, hits, titleOrTagHit };
  }
  function retrieveFromCorpus(query, locale) {
    if (!CORPUS_INDEX) return null;
    const terms = tokenize(query);
    if (!terms.length) return null;
    const pool = (CORPUS_INDEX.byLocale[locale] || []).concat(CORPUS_INDEX.byLocale.en || []);
    if (!pool.length) return null;
    let best = null;
    for (const prep of pool) {
      const s = scoreChunk(prep, terms, CORPUS_INDEX.idf);
      if (!best || s.score > best.score) best = { prep, ...s };
    }
    if (!best) return null;
    // Precision floors: a match needs either evidence in title/tag, OR ≥2 distinct term hits.
    // Stops single body-token bleed-overs like "company" → some chunk that mentions "company" once.
    const precise = best.titleOrTagHit || best.hits >= 2;
    return (precise && best.score >= RETRIEVAL_THRESHOLD) ? best : null;
  }
  function bestMatch(query, items) {
    // Try corpus retrieval first. Curated items remain authoritative for QA wording + links.
    const lc = lang();
    const corpusHit = retrieveFromCorpus(query, lc);
    if (corpusHit) {
      const c = corpusHit.prep.chunk;
      const m = /^qa-([a-z0-9]+)-([a-z]{2})$/.exec(c.id);
      if (m) {
        const curated = items.find(x => x.id === m[1]);
        if (curated) return curated;
      }
      // Non-QA chunk → synthesize an item shape compatible with the renderer.
      return { id: c.id, q: c.title, a: c.text, href: c.source, link: c.title, k: (c.tags || []).join(' ') };
    }
    // Fallback (corpus not loaded yet, or offline): score curated items with the same
    // precision rule as the corpus path. q+k act as title+tags, a as text.
    const terms = tokenize(query);
    if (!terms.length) return null;
    let best = null;
    for (const item of items) {
      const qTokens = tokenize(item.q);
      const kTokens = tokenize(item.k);
      const aTokens = tokenize(item.a);
      let score = 0, hits = 0, titleHit = false;
      for (const t of terms) {
        const inQ = qTokens.includes(t);
        const inK = kTokens.includes(t);
        const inA = aTokens.includes(t);
        if (inQ) score += 2.2;
        if (inK) score += 1.6;
        if (inA) score += 1.0;
        if (inQ || inK || inA) hits++;
        if (inQ) titleHit = true;
      }
      if (!best || score > best.score) best = { item, score, hits, titleHit };
    }
    if (!best || best.score === 0) return null;
    // Keyword-only single-token hits ("security" in k of a custody item) are too permissive;
    // require either a question-text hit, or ≥2 distinct hits across q/k/a.
    const precise = best.titleHit || best.hits >= 2;
    return precise ? best.item : null;
  }

  function resolveHref(href) {
    if (!href) return '';
    const onWhitepaper = /whitepaper\.html$/.test(location.pathname);
    if (onWhitepaper && href.startsWith('#')) return 'index.html' + href;
    return href;
  }

  function iconAi() {
    return '<svg class="ow-sparkle" viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M12 2C12.45 5.55 13.95 8.05 16.5 9.5C13.95 10.95 12.45 13.45 12 17C11.55 13.45 10.05 10.95 7.5 9.5C10.05 8.05 11.55 5.55 12 2Z" fill="currentColor" opacity="0.92"/><path d="M19 13C19.3 14.8 20.1 15.9 21.5 16.5C20.1 17.1 19.3 18.2 19 20C18.7 18.2 17.9 17.1 16.5 16.5C17.9 15.9 18.7 14.8 19 13Z" fill="currentColor" opacity="0.65"/><path d="M5 15.5C5.2 16.6 5.7 17.2 6.5 17.5C5.7 17.8 5.2 18.4 5 19.5C4.8 18.4 4.3 17.8 3.5 17.5C4.3 17.2 4.8 16.6 5 15.5Z" fill="currentColor" opacity="0.4"/></svg>';
  }
  function iconAiNav() {
    return '<svg class="ow-sparkle" viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M12 1C12.6 6.2 14.8 9.2 18 11C14.8 12.8 12.6 15.8 12 21C11.4 15.8 9.2 12.8 6 11C9.2 9.2 11.4 6.2 12 1Z" fill="currentColor"/></svg>';
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
      navBtn.innerHTML = iconAiNav();
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
            (t.trustChip ? '<span class="ow-trust-chip" aria-label="' + t.trustChip + '">' + t.trustChip + '</span>' : '') +
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

      // Intent router runs BEFORE history.push so privateData input is never
      // echoed back to the DOM. Shim at assets/assistant-intents.js attaches
      // the classifier to window.ONEWALLET_INTENTS. If absent (offline / load
      // failure), every query falls through to supportedProductQuestion and
      // the existing retrieval path is preserved.
      const intents = (window.ONEWALLET_INTENTS && window.ONEWALLET_INTENTS.classifyIntent)
        ? window.ONEWALLET_INTENTS
        : { classifyIntent: () => 'supportedProductQuestion', classifyOfftopic: () => 'supportedProductQuestion' };
      const intent = intents.classifyIntent(q, lang());
      const intentCopy = (t.intents || {});

      // privateData: redact the user bubble before pushing. Raw q is dropped.
      if (intent === 'privateData') {
        history.push({ role: 'user', text: intentCopy.privateDataUserRedacted || '[hidden]' });
        history.push({ role: 'bot', text: intentCopy.privateData || t.fallback });
        view = 'answering';
        input.value = '';
        render();
        return;
      }

      // Other canned-reply intents: push raw user message + canned bot copy. No Worker call.
      const cannedKey = {
        greeting: 'greeting',
        courtesy: 'courtesy',
        capability: 'capability',
        unsafeFinancial: 'unsafeFinancial'
      }[intent];
      if (cannedKey) {
        history.push({ role: 'user', text: q });
        history.push({ role: 'bot', text: intentCopy[cannedKey] || t.fallback });
        view = 'answering';
        input.value = '';
        render();
        return;
      }

      // supportedProductQuestion (fall-through): try retrieval first.
      const match = bestMatch(q, t.items);
      const workerUrl = (typeof window !== 'undefined') && window.ONEWALLET_ASSISTANT_API_URL;
      const useWorker = !!(match && workerUrl);

      history.push({ role: 'user', text: q });
      const botIdx = history.length;

      if (useWorker) {
        // Pending bubble first — no static answer flashes before Worker reply.
        // On Worker success: replace with grounded answer + Worker source.
        // On Worker failure/timeout: reveal the static match.a as graceful fallback.
        history.push({ role: 'bot', pending: true, text: (intentCopy.thinking || 'Searching sources') });
      } else if (match) {
        history.push({ role: 'bot', text: match.a, href: match.href, link: match.link });
      } else {
        // Retrieval missed — give the off-topic classifier a turn to decide
        // between unsupportedDomain, benignOfftopic, or a final t.fallback.
        const offtopic = intents.classifyOfftopic(q, lang());
        const offKey = { unsupportedDomain: 'unsupportedDomain', benignOfftopic: 'benignOfftopic' }[offtopic];
        history.push({ role: 'bot', text: (offKey && intentCopy[offKey]) || t.fallback });
      }
      view = 'answering';
      input.value = '';
      render();

      // Worker upgrade path: fulfill the pending bubble with grounded answer,
      // or fall back to static match.a if the Worker is unreachable/unsafe.
      if (useWorker) askWorker(q).then((reply) => {
        if (!history[botIdx] || history[botIdx].role !== 'bot') return;
        if (reply && reply.answer) {
          const top = Array.isArray(reply.sources) && reply.sources[0];
          const next = { role: 'bot', text: reply.answer, href: match.href, link: match.link };
          if (top && top.source) {
            next.href = top.source;
            next.link = top.title || match.link;
          }
          history[botIdx] = next;
        } else {
          // Worker null/failed → reveal static fallback in the same bubble.
          history[botIdx] = { role: 'bot', text: match.a, href: match.href, link: match.link };
        }
        if (view === 'answering') render();
      }).catch(() => {
        if (history[botIdx] && history[botIdx].role === 'bot') {
          history[botIdx] = { role: 'bot', text: match.a, href: match.href, link: match.link };
          if (view === 'answering') render();
        }
      });
    });

    render();
  }

  function render() {
    const t = S();
    if (!t || !root) return;

    // Update header copy (language switch)
    head.querySelector('#owModalTitle').textContent = (view === 'disclosure') ? t.disclosureTitle : t.title;
    head.querySelector('.ow-modal-sub').textContent = t.subtitle;
    const chip = head.querySelector('.ow-trust-chip');
    if (chip) {
      if (t.trustChip && view !== 'disclosure') { chip.textContent = t.trustChip; chip.hidden = false; }
      else { chip.hidden = true; }
    }
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
              return '<li><a href="' + href + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + l.label + iconArrow() + '</a></li>';
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
          if (m.pending) {
            return '<li class="ow-msg ow-msg-bot ow-msg-pending" aria-live="polite">' +
              '<span class="ow-pending-text">' + escapeHtml(m.text) + '</span>' +
              '<span class="ow-pending-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
            '</li>';
          }
          const href = resolveHref(m.href || '');
          const ext = /^https?:/.test(href);
          const link = (href && m.link)
            ? '<a class="ow-msg-link" href="' + href + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + m.link + iconArrow() + '</a>'
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

  loadCorpus();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
