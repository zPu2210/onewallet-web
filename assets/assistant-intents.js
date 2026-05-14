/* ONEWALLET assistant intent classifier — browser shim.
 *
 * Classic <script> sibling of shared/assistant-intents.js so that
 * assets/assistant.js (also a classic script) can call the same classifier
 * synchronously, before any history.push or Worker call.
 *
 * The ESM module at shared/assistant-intents.js is the source of truth used
 * by Node smoke tests and the Cloudflare Worker (Stage 2). The pattern
 * tables below MUST stay structurally identical. scripts/smoke-assistant-dom.mjs
 * exercises this shim through jsdom; scripts/smoke-retrieval.mjs exercises
 * the shared ESM module; both run on the same test matrix so drift fails CI.
 */
(function () {
  // Full mirror of shared/banned-claims.js BANNED patterns. Drift between
  // this list and the source is a safety bug — the DOM/branch smoke asserts
  // shim and ESM classifier agree on a row-by-row matrix.
  var BANNED_USER = [
    /\bguaranteed (returns?|yield|profit|roi|listing)/i,
    /\b(roi|return on investment)\b[^.\n]{0,40}\b(of|will|guaranteed)/i,
    /\blisted on (binance|coinbase|okx|bybit|upbit|bithumb)\b/i,
    /\baudit (completed|passed|finalized|finished)\b/i,
    /\bbank[- ]grade (security|custody|infrastructure)\b/i,
    /\bhsm[- ]backed\b/i,
    /\bisolated vpc\b/i,
    /\bregulator[- ]?approved\b/i,
    /\bfdic[- ]?insured\b/i
  ];

  var PRIVATE_DATA_KEYWORDS = [
    /\bseed\s*phrase\b/i,
    /\brecovery\s*phrase\b/i,
    /\bmnemonic\b/i,
    /\bprivate\s*key\b/i,
    /\bsecret\s*key\b/i,
    /시드\s*(구문|문구|키)/, /니모닉/, /개인\s*키/, /복구\s*(구문|문구|키)/,
    /シード\s*フレーズ/, /ニーモニック/, /秘密\s*鍵/, /リカバリー\s*(フレーズ|キー)/,
    /助记词/, /私钥/, /恢复\s*(短语|词组|密钥)/
  ];
  var PRIVATE_DATA_SHARE = [
    /\b(here\s+is|here\s+are|this\s+is|my)\b/i,
    /\b(share|paste|enter|sending|sent|saving)\b/i,
    /\bi['’]?ll\b/i,
    /(여기|이게|제\s*것|공유)/u,
    /(これは|私の|共有|貼り付け)/u,
    /(这是|我的|分享|粘贴)/u
  ];
  var PRIVATE_DATA_PASTE = /(?:\b[a-z]{3,8}\b\s+){11,}\b[a-z]{3,8}\b/;

  var FINANCIAL_PROBE = [
    /\b(price|pump|moon|listing|airdrop|yield|apr|apy)\b/i,
    /\b(when|will).{0,20}\b(list|listed|listing)\b/i,
    /\b(roi|return on investment)\b/i,
    /\b(guarantee|guaranteed)\b/i,
    /상장|에어드(랍|롭)|수익률|이자율|보장|가격|시세/,
    /上場|エアドロップ|利回り|保証/,
    /上(线|架)|空投|收益率|保证|保障/
  ];

  var GREETING = [
    /^(hello|hi+|hey+|yo|howdy|sup|hola|greetings)\b/i,
    /^안녕(하세요|히)?$/u,
    /^반가워요?$/u,
    /^(こんにちは|こんばんは|やあ|もしもし|おはよう(ございます)?)$/u,
    /^(你好|您好|嗨|哈喽|哈囉)$/u
  ];

  var COURTESY = [
    /^(thanks?|thank\s*you|ty|thx|cheers|ok(ay)?|cool|got\s*it|nice|great)\b/i,
    /^(고마워요?|고맙습니다|감사(합니다|해요)?|알겠어요?|좋아요?|넵|네)$/u,
    /^(ありがとう(ございます)?|了解(です)?|わかりました|オーケー)$/u,
    /^(谢谢|多谢|好的|明白了|了解|可以)$/u
  ];

  var CAPABILITY = [
    /^(help|topics|menu|what can (you|i) (do|ask)|what (do|can) you do)\b/i,
    /\b(what topics|what subjects|어떤(\s*것|걸)?\s*(물어|도와))/i,
    /무엇을\s*(도와|물어|할\s*수\s*있)/u,
    /^(何が(できる|聞ける))/u,
    /(能做什么|可以问什么|帮我做什么)/u
  ];

  var BENIGN_OFFTOPIC = [
    /^how\s+are\s+you\b/i,
    /\b(your\s+name|who\s+are\s+you)\b/i,
    /\btell\s+me\s+a\s+joke\b/i,
    /잘\s*지내|이름이\s*뭐|농담/u,
    /(元気|お名前|冗談)/u,
    /(你\s*好\s*吗|你叫什么|讲个笑话|说个笑话)/u
  ];

  var UNSUPPORTED_DOMAIN = [
    /\b(weather|forecast|temperature)\b/i,
    /\b(stocks?|nasdaq|s&p|dow\s+jones)\b/i,
    /\b(nba|nfl|fifa|world\s+cup|soccer|football\s+score)\b/i,
    /\b(movie|netflix|recipe|cooking)\b/i,
    /\b(btc|bitcoin|eth|ethereum)\s+price\b/i,
    /\b(crypto|coin)\s+(price|chart)\b/i,
    /날씨|영화|레시피|요리|주가/u,
    /天気|映画|レシピ|料理|株価/u,
    /天气|电影|食谱|烹饪|股价/u
  ];

  var MAX_GREETING_TOKENS = 3;

  function matchesAny(patterns, text) {
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].test(text)) return true;
    }
    return false;
  }
  function tokenCount(str) {
    return String(str).split(/\s+/).filter(Boolean).length;
  }

  function classifyIntent(query) {
    var raw = String(query || '').trim();
    if (!raw) return 'supportedProductQuestion';
    if (PRIVATE_DATA_PASTE.test(raw)) return 'privateData';
    if (matchesAny(PRIVATE_DATA_KEYWORDS, raw) && matchesAny(PRIVATE_DATA_SHARE, raw)) return 'privateData';
    if (matchesAny(BANNED_USER, raw))      return 'unsafeFinancial';
    if (matchesAny(FINANCIAL_PROBE, raw))  return 'unsafeFinancial';
    if (tokenCount(raw) <= MAX_GREETING_TOKENS && matchesAny(GREETING, raw)) return 'greeting';
    if (tokenCount(raw) <= MAX_GREETING_TOKENS && matchesAny(COURTESY, raw)) return 'courtesy';
    if (matchesAny(CAPABILITY, raw))       return 'capability';
    return 'supportedProductQuestion';
  }

  function classifyOfftopic(query) {
    var raw = String(query || '').trim();
    if (!raw) return 'supportedProductQuestion';
    if (matchesAny(UNSUPPORTED_DOMAIN, raw)) return 'unsupportedDomain';
    if (matchesAny(BENIGN_OFFTOPIC, raw))    return 'benignOfftopic';
    return 'supportedProductQuestion';
  }

  window.ONEWALLET_INTENTS = { classifyIntent: classifyIntent, classifyOfftopic: classifyOfftopic };
})();
