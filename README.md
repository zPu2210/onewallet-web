# ONEWALLET — Telegram-Native Web3 Wallet & Payment Rail

Static prototype for [onewallet.app](https://onewallet.app) — homepage + technical whitepaper.

## Source Of Truth

This repository is the canonical source for the public ONEWALLET website and whitepaper.

| Resource | Location |
|----------|----------|
| GitHub | https://github.com/zPu2210/onewallet-web |
| Production | https://onewallet-web.vercel.app |
| Planning workspace | `/Users/pu/Documents/Playground/1DollarWallet` |
| PM decision record | `/Users/pu/Documents/Playground/1DollarWallet/docs/decisions/260513-onewallet-web-source-of-truth.md` |

Do not maintain deployable website code in the PM/planning repo. Earlier website work in `zPu2210/1dollar-wallet` PR #9 is superseded and should be used only as a legacy source reference for selective migration.

## Stack

- Single-file HTML pages (no build step)
- Vanilla JS i18n module (`assets/i18n.js`) covering EN / KO / JA / ZH
- Inline SVG diagrams (architecture, MPC topology, onboarding, growth loop, ecosystem flywheel)
- Google Fonts: Inter · Playfair Display · JetBrains Mono · Noto Sans KR/JP/SC

## Pages

| File | Purpose |
|------|---------|
| `index.html` | Homepage with 12-section IA |
| `whitepaper.html` | 12-chapter technical whitepaper with sticky TOC |

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Auto-deploys to Vercel on push to `main`.

## i18n

Click the `EN` pill in the nav to switch language. Selection persists in
`localStorage.onewallet_lang` and is shared between the homepage and whitepaper.
