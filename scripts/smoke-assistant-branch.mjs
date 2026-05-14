#!/usr/bin/env node
/* Branch-level smoke for the shipped browser intent shim and the submit
 * handler's decision tree in assets/assistant.js. NOT a real DOM test —
 * jsdom is not a project dependency. What this script does:
 *   1. Load assets/assistant-intents.js into a vm sandbox (matches the
 *      pattern in scripts/build-assistant-corpus.mjs).
 *   2. Assert the shim's window.ONEWALLET_INTENTS classifier agrees with
 *      the ESM source of truth on the same test matrix — drift fails CI.
 *   3. Simulate the form-submit branch from assets/assistant.js so the
 *      privateData redaction and "no Worker call" invariants are exercised
 *      against the production shim. Note: the simulator mirrors the branch
 *      shape; if assistant.js diverges, update both. A real DOM smoke
 *      (jsdom + form submit) is recommended as a follow-up; for now, do a
 *      manual local browser pass before shipping.
 *
 *   node scripts/smoke-assistant-branch.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { classifyIntent as esmClassifyIntent, classifyOfftopic as esmClassifyOfftopic } from '../shared/assistant-intents.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

// Load the shipped browser shim into a sandbox that mimics just enough of `window`.
const shimSrc = readFileSync(resolve(ROOT, 'assets/assistant-intents.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(shimSrc, sandbox);
const shim = sandbox.window.ONEWALLET_INTENTS;

let pass = 0, fail = 0;
function ok(label) { pass++; console.log(`✓ ${label}`); }
function bad(label, info) { fail++; console.error(`✗ ${label}  ${info || ''}`); }

if (!shim || typeof shim.classifyIntent !== 'function') {
  console.error('Browser shim did not attach window.ONEWALLET_INTENTS.classifyIntent');
  process.exit(1);
}

// ── 1. Shim ↔ ESM agreement on critical rows. ──
const matrix = [
  ['hello',                                                  'greeting'],
  ['hi',                                                     'greeting'],
  ['안녕',                                                    'greeting'],
  ['thanks',                                                 'courtesy'],
  ['what can you do?',                                       'capability'],
  ['tell me about ONEWALLET',                                'supportedProductQuestion'],
  ['how does MPC recovery work?',                            'supportedProductQuestion'],
  ['do I need a seed phrase?',                               'supportedProductQuestion'],
  ['here is my seed phrase abandon abandon abandon',         'privateData'],
  ['abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about', 'privateData'],
  ['what is the price of $1 next month?',                    'unsafeFinancial'],
  ['will $1 list on Binance?',                               'unsafeFinancial']
];

console.log('--- shim agrees with ESM source of truth ---');
for (const [q, expected] of matrix) {
  const fromShim = shim.classifyIntent(q);
  const fromEsm = esmClassifyIntent(q);
  if (fromShim !== expected) { bad(`shim "${q}"`, `got ${fromShim}, expected ${expected}`); continue; }
  if (fromEsm !== expected)  { bad(`esm  "${q}"`, `got ${fromEsm}, expected ${expected}`); continue; }
  if (fromShim !== fromEsm)  { bad(`drift "${q}"`, `shim=${fromShim} esm=${fromEsm}`); continue; }
  ok(`"${q}" → ${fromShim}`);
}

// Offtopic helper agreement.
const offtopicMatrix = [
  ['weather in seoul?',    'unsupportedDomain'],
  ['tell me a joke',       'benignOfftopic'],
  ['how are you?',         'benignOfftopic']
];
console.log('\n--- offtopic helper agrees ---');
for (const [q, expected] of offtopicMatrix) {
  const fromShim = shim.classifyOfftopic(q);
  const fromEsm = esmClassifyOfftopic(q);
  if (fromShim !== expected || fromEsm !== expected) {
    bad(`offtopic "${q}"`, `shim=${fromShim} esm=${fromEsm} expected=${expected}`);
  } else {
    ok(`"${q}" → ${fromShim}`);
  }
}

// ── 2. Submit-handler branching simulator. ──
// Mirrors the branch in assets/assistant.js. If the production code changes
// shape, update this simulator — and the DOM smoke will tell you.
function simulateSubmit(q, t, intents) {
  const intent = intents.classifyIntent(q);
  const copy = t.intents || {};
  const history = [];
  let workerCalled = false;
  const askWorker = () => { workerCalled = true; };

  if (intent === 'privateData') {
    history.push({ role: 'user', text: copy.privateDataUserRedacted });
    history.push({ role: 'bot', text: copy.privateData });
    return { history, workerCalled, intent };
  }
  const cannedKey = ({ greeting: 'greeting', courtesy: 'courtesy', capability: 'capability', unsafeFinancial: 'unsafeFinancial' })[intent];
  if (cannedKey) {
    history.push({ role: 'user', text: q });
    history.push({ role: 'bot', text: copy[cannedKey] });
    return { history, workerCalled, intent };
  }
  // supportedProductQuestion: pretend retrieval missed (null) or hit ('match')
  const match = q.includes('MPC') ? { a: 'MPC answer' } : null;
  history.push({ role: 'user', text: q });
  if (match) {
    history.push({ role: 'bot', text: match.a });
    askWorker();
  } else {
    const off = intents.classifyOfftopic(q);
    const offKey = ({ unsupportedDomain: 'unsupportedDomain', benignOfftopic: 'benignOfftopic' })[off];
    history.push({ role: 'bot', text: (offKey && copy[offKey]) || t.fallback });
  }
  return { history, workerCalled, intent };
}

// Load the locale strings the same way build-assistant-corpus.mjs does.
const knowSrc = readFileSync(resolve(ROOT, 'assets/assistant-knowledge.js'), 'utf8');
const knowSandbox = { window: {} };
vm.createContext(knowSandbox);
vm.runInContext(knowSrc, knowSandbox);
const STR = knowSandbox.window.ONEWALLET_ASSISTANT.STR;
const tEn = STR.en;

console.log('\n--- submit-handler branch invariants ---');

// hello: greeting copy, no worker call, raw "hello" still echoed in user bubble.
{
  const r = simulateSubmit('hello', tEn, shim);
  if (r.history[0].text !== 'hello') bad('hello user echo', JSON.stringify(r.history[0]));
  else if (r.history[1].text !== tEn.intents.greeting) bad('hello greeting copy', r.history[1].text);
  else if (r.workerCalled) bad('hello worker call', 'unexpected');
  else ok('hello → greeting copy, no Worker call');
}

// seed-paste: user bubble must NOT contain the raw paste; redaction copy used.
{
  const seedPaste = 'here is my seed phrase abandon abandon abandon';
  const r = simulateSubmit(seedPaste, tEn, shim);
  if (r.history[0].text === seedPaste) bad('seed paste leaked into user bubble', r.history[0].text);
  else if (r.history[0].text !== tEn.intents.privateDataUserRedacted) bad('redaction copy missing', r.history[0].text);
  else if (r.history[1].text !== tEn.intents.privateData) bad('privateData bot copy missing', r.history[1].text);
  else if (r.workerCalled) bad('privateData worker call', 'unexpected');
  else ok('seed paste → redacted user bubble, no Worker call');
}

// Bare BIP39-ish paste: same protection.
{
  const bip = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const r = simulateSubmit(bip, tEn, shim);
  if (r.history[0].text === bip) bad('bip39 paste leaked', 'raw paste echoed');
  else if (r.history[0].text !== tEn.intents.privateDataUserRedacted) bad('bip39 redaction copy', r.history[0].text);
  else ok('bip39 paste → redacted user bubble');
}

// Financial probe: refusal copy, no worker call, user bubble OK to keep.
{
  const r = simulateSubmit('will $1 list on Binance?', tEn, shim);
  if (r.history[1].text !== tEn.intents.unsafeFinancial) bad('financial refusal copy', r.history[1].text);
  else if (r.workerCalled) bad('financial worker call', 'unexpected');
  else ok('financial probe → refusal copy, no Worker call');
}

// MPC product question: falls through to retrieval (simulator hit), worker called.
{
  const r = simulateSubmit('how does MPC recovery work?', tEn, shim);
  if (r.intent !== 'supportedProductQuestion') bad('MPC intent', r.intent);
  else if (!r.workerCalled) bad('MPC worker call', 'expected Worker call after match');
  else ok('MPC question → supported, Worker invoked');
}

// Off-topic with retrieval miss: classifyOfftopic kicks in via simulator.
{
  const r = simulateSubmit('weather in seoul?', tEn, shim);
  if (r.intent !== 'supportedProductQuestion') bad('weather intent', r.intent);
  else if (r.history[1].text !== tEn.intents.unsupportedDomain) bad('weather offtopic copy', r.history[1].text);
  else ok('weather → unsupportedDomain copy after retrieval miss');
}

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
