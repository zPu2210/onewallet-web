/* ONEWALLET assistant knowledge (Phase 1 static)
 * Approved public copy only — no live LLM, no claims beyond website/whitepaper draft.
 * Each item: { id, q, a, href, link, k (search keywords), featured (visible chip) }
 * Disclosure subview copy lives under `.disclosure`.
 */
window.ONEWALLET_ASSISTANT = (function () {
  const STR = {
    en: {
      navLabel: 'Ask ONEWALLET',
      pillText: 'Ask us anything',
      pillKey: '⌘K',
      pillKeyAlt: 'Ctrl K',
      title: 'Ask ONEWALLET',
      subtitle: 'Static prototype · approved public copy only',
      close: 'Close',
      back: 'Back',
      send: 'Ask',
      placeholder: 'Ask about security, fees, payments, $1, roadmap…',
      suggested: 'Try one of these',
      readDisclosure: 'Read disclosure',
      disclosureTitle: 'About this assistant',
      disclosure: [
        'This assistant is a static prototype. It only returns answers drafted from the current public ONEWALLET website and whitepaper draft. It is not a live AI agent and it does not have access to your account.',
        'Nothing here is financial, legal, tax, or investment advice. No price, return, exchange-listing, audit, regulatory, or vendor-architecture guarantees are made. Forward-looking statements ("target", "planned", "draft") remain subject to final product, security, and legal review.',
        'For account-specific issues, launch dates, or anything not in the public copy, please contact us on Telegram.'
      ],
      disclosureLinks: [
        { href: 'whitepaper.html#ch11', label: 'Whitepaper · Risks & mitigations' },
        { href: 'whitepaper.html#ch12', label: 'Whitepaper · Glossary' },
        { href: 'https://t.me/onedollar_wallet_bot/app', label: 'Open ONEWALLET on Telegram' }
      ],
      fallback: 'I can only answer from the current public homepage and whitepaper draft. Try asking about wallet setup, MPC security, recovery, payments, fees, $1 utility, roadmap, risks, or Telegram support.',
      items: [
        { id: 'what', featured: true, q: 'What does ONEWALLET do?', a: 'ONEWALLET is a Telegram-native Web3 wallet and payment rail. It bundles keyless MPC custody, QR payments, merchant tools, and $1 utility into a single Mini App flow.', href: 'whitepaper.html#ch1', link: 'Executive summary', k: 'what product wallet payment rail telegram mini app' },
        { id: 'open', q: 'How do I open a wallet?', a: 'You open ONEWALLET inside Telegram, verify the device, create the wallet, and then send, pay, or earn from the Mini App. The default flow avoids app-store downloads and a seed-phrase setup.', href: '#product-flow', link: 'Product flow', k: 'open wallet telegram mini app onboarding setup start device' },
        { id: 'custody', featured: true, q: 'Is ONEWALLET custodial?', a: 'No single party can move funds. The target custody model is 2-of-3 MPC across device, server, and recovery shares. Any one share alone — including the server — cannot sign a transaction.', href: '#security', link: 'Security model', k: 'custody custodial mpc key security sign share server self' },
        { id: 'recovery', q: 'What happens if I lose my device or Telegram account?', a: 'Recovery is designed around issuing a fresh device share and validating it through the recovery share. Losing a device or Telegram session should not give the server enough authority to move funds alone.', href: 'whitepaper.html#ch5', link: 'Security chapter', k: 'lose device telegram recovery account share rotate' },
        { id: 'seed', q: 'Do I need a seed phrase?', a: 'Not by default. ONEWALLET uses MPC, so there is no single seed phrase a normal user must hold. Advanced backup or export behavior remains subject to product and security approval.', href: '#faq', link: 'FAQ', k: 'seed phrase backup key mpc' },
        { id: 'networks', q: 'Which networks are supported?', a: 'The public draft targets TON, Ethereum, BNB Chain, TRON, and major stablecoins. The final supported network list will be confirmed before public launch.', href: '#faq', link: 'Network FAQ', k: 'network chain ton ethereum bnb tron stablecoin usdt usdc' },
        { id: 'payments', featured: true, q: 'How do merchant payments work?', a: 'A merchant generates a QR invoice. The user scans it inside Telegram. ONEWALLET previews receiver, fees, and FX, MPC signs the transaction, and a settlement webhook supports POS reconciliation.', href: '#payments', link: 'Payments section', k: 'payment merchant qr invoice webhook settlement pos stablecoin checkout' },
        { id: 'fees', featured: true, q: 'What are the fees?', a: 'The public model is network gas plus transparent ONEWALLET fees for swaps and merchant payments. Holding $1 is described as a way to reduce fees at preferential rates, subject to final token and legal review.', href: '#token', link: '$1 utility', k: 'fees fee gas swap merchant discount token cheap' },
        { id: 'token', q: 'What is the $1 token used for?', a: '$1 is positioned as a utility token for fee discounts, user rewards, merchant incentives, ecosystem access, and governance signals. The site avoids price, return, or exchange-listing promises.', href: 'whitepaper.html#ch6', link: 'Token model', k: 'token utility rewards governance incentives discount one dollar' },
        { id: 'roadmap', q: 'Is ONEWALLET live yet?', a: 'The current public roadmap shows core wallet as done, payments rail in progress, and $1 utility plus ecosystem work as planned. Dates are intentionally omitted until owners approve public commitments.', href: '#roadmap', link: 'Roadmap', k: 'live status roadmap done progress planned date launch private testing beta' },
        { id: 'risks', q: 'What risks are disclosed?', a: 'The whitepaper calls out custody compromise, Telegram platform dependency, regulatory shifts, merchant adoption, token utility drift, and localization quality. Mitigations are described as planned or conditional where appropriate.', href: 'whitepaper.html#ch11', link: 'Risks & mitigations', k: 'risk risks mitigation telegram dependency regulatory custody adoption localization' },
        { id: 'whitepaper', q: 'Where should I read the details?', a: 'The whitepaper is the detailed product and technical reference. It covers executive summary, product thesis, UX, architecture, security, token model, growth, business model, roadmap, team, risks, and glossary.', href: 'whitepaper.html', link: 'Read whitepaper', k: 'whitepaper details documentation chapters glossary architecture pdf' },
        { id: 'team', q: 'Who is behind ONEWALLET?', a: 'The team section names the founders, engineering, and operating partners listed in the current public copy. For governance or partnership questions outside that list, please reach the team on Telegram.', href: '#team', link: 'Team section', k: 'team founders governance who behind people' },
        { id: 'support', q: 'How do I contact or try ONEWALLET?', a: 'The current public entry point is the Telegram Mini App link. For account-specific or launch-related questions, Telegram support should be treated as the source of action.', href: 'https://t.me/onedollar_wallet_bot/app', link: 'Open Telegram', k: 'contact support telegram try app bot help reach' }
      ]
    },
    ko: {
      navLabel: 'ONEWALLET 문의',
      pillText: '무엇이든 물어보세요',
      pillKey: '⌘K',
      pillKeyAlt: 'Ctrl K',
      title: 'ONEWALLET 문의',
      subtitle: '정적 프로토타입 · 승인된 공개 문구만 사용',
      close: '닫기',
      back: '뒤로',
      send: '질문',
      placeholder: '보안, 수수료, 결제, $1, 로드맵 등을 물어보세요…',
      suggested: '추천 질문',
      readDisclosure: '고지사항 보기',
      disclosureTitle: '도우미 안내',
      disclosure: [
        '이 도우미는 정적 프로토타입입니다. 현재 공개된 ONEWALLET 웹사이트와 백서 초안 기반의 답변만 제공합니다. 실시간 AI 에이전트가 아니며 사용자의 계정에 접근하지 않습니다.',
        '본 응답은 금융·법률·세무·투자 자문이 아닙니다. 가격, 수익, 거래소 상장, 감사, 규제, 벤더 아키텍처에 대해 보증하지 않습니다. "목표", "계획", "초안" 등 미래 표현은 최종 제품·보안·법무 검토를 거쳐 변경될 수 있습니다.',
        '계정별 문의나 출시 일정 등 공개 문구에 없는 사안은 Telegram을 통해 문의해 주세요.'
      ],
      disclosureLinks: [
        { href: 'whitepaper.html#ch11', label: '백서 · 리스크와 완화' },
        { href: 'whitepaper.html#ch12', label: '백서 · 용어집' },
        { href: 'https://t.me/onedollar_wallet_bot/app', label: 'Telegram에서 ONEWALLET 열기' }
      ],
      fallback: '현재 공개 홈페이지와 백서 초안에 있는 내용만 답변할 수 있습니다. 지갑 개설, MPC 보안, 복구, 결제, 수수료, $1 유틸리티, 로드맵, 리스크 또는 Telegram 지원을 물어보세요.',
      items: [
        { id: 'what', featured: true, q: 'ONEWALLET은 무엇을 하나요?', a: 'ONEWALLET은 Telegram 안에서 작동하는 Web3 지갑이자 결제 레일입니다. 무시드 MPC 커스터디, QR 결제, 머천트 도구, $1 유틸리티를 하나의 Mini App 흐름으로 연결합니다.', href: 'whitepaper.html#ch1', link: '요약 읽기', k: '무엇 제품 지갑 결제 telegram mini app' },
        { id: 'open', q: '지갑은 어떻게 열 수 있나요?', a: 'Telegram에서 ONEWALLET을 열고, 기기를 확인한 뒤 지갑을 생성합니다. 이후 Mini App 안에서 전송, 결제, 보상 흐름을 사용할 수 있습니다. 공개 문구는 앱스토어 다운로드와 기본 시드 문구 설정을 피하는 방향입니다.', href: '#product-flow', link: '제품 흐름', k: '열기 지갑 telegram 온보딩 시작 기기' },
        { id: 'custody', featured: true, q: 'ONEWALLET은 커스터디 방식인가요?', a: '단일 주체가 자금을 이동할 수 없도록 설계합니다. 목표 커스터디 모델은 기기·서버·복구 분산 키를 사용하는 2-of-3 MPC입니다. 서버 분산 키 하나만으로는 거래에 서명할 수 없습니다.', href: '#security', link: '보안 모델', k: '커스터디 mpc 보안 서명 분산키 서버' },
        { id: 'recovery', q: '기기나 Telegram 계정을 잃으면 어떻게 되나요?', a: '복구 흐름은 새 기기 분산 키를 발급하고 복구 분산 키로 검증하는 방향입니다. 기기나 Telegram 세션을 잃어도 서버 단독으로 자금을 이동할 수 있는 권한은 생기지 않습니다.', href: 'whitepaper.html#ch5', link: '보안 장', k: '분실 기기 telegram 복구 계정 분산키 회전' },
        { id: 'seed', q: '시드 문구가 필요한가요?', a: '기본적으로 필요하지 않습니다. ONEWALLET은 MPC를 사용하므로 일반 사용자가 관리해야 하는 단일 시드 문구가 없습니다. 고급 백업이나 내보내기 기능은 제품·보안 승인 범위로 남겨야 합니다.', href: '#faq', link: 'FAQ', k: '시드 문구 백업 키 mpc' },
        { id: 'networks', q: '어떤 네트워크를 지원하나요?', a: '공개 초안은 TON, Ethereum, BNB Chain, TRON, 주요 스테이블코인을 목표로 합니다. 최종 네트워크 목록은 공개 출시 전에 확정되어야 합니다.', href: '#faq', link: '네트워크 FAQ', k: '네트워크 체인 ton ethereum bnb tron stablecoin usdt usdc' },
        { id: 'payments', featured: true, q: '머천트 결제는 어떻게 작동하나요?', a: '머천트가 QR 인보이스를 만들고, 사용자가 Telegram 안에서 스캔합니다. ONEWALLET은 수신자, 수수료, 환율을 미리 보여주고, MPC 서명 후 정산 Webhook으로 POS 대조를 지원합니다.', href: '#payments', link: '결제 섹션', k: '결제 머천트 qr 인보이스 webhook 정산 pos 스테이블코인' },
        { id: 'fees', featured: true, q: '수수료는 어떻게 되나요?', a: '공개 모델은 네트워크 가스비와 스왑/머천트 결제에 대한 투명한 ONEWALLET 수수료입니다. $1 보유자는 우대 수수료를 받을 수 있다는 방향이지만, 최종 토큰·법무 검토가 필요합니다.', href: '#token', link: '$1 유틸리티', k: '수수료 가스 스왑 머천트 할인 토큰' },
        { id: 'token', q: '$1 토큰은 어디에 쓰이나요?', a: '$1은 수수료 할인, 사용자 보상, 머천트 인센티브, 생태계 접근, 거버넌스 신호를 위한 유틸리티 토큰으로 설명됩니다. 사이트는 가격, 수익, 거래소 상장 약속을 하지 않습니다.', href: 'whitepaper.html#ch6', link: '토큰 모델', k: '토큰 유틸리티 보상 거버넌스 인센티브 할인' },
        { id: 'roadmap', q: 'ONEWALLET은 현재 라이브인가요?', a: '현재 공개 로드맵은 코어 지갑 완료, 결제 레일 진행 중, $1 유틸리티와 생태계는 계획 단계로 표시합니다. 공개 일정은 담당자 승인 전까지 의도적으로 표시하지 않습니다.', href: '#roadmap', link: '로드맵', k: '라이브 상태 로드맵 완료 진행 계획 출시 테스트 베타' },
        { id: 'risks', q: '어떤 리스크가 공개되어 있나요?', a: '백서는 커스터디 침해, Telegram 플랫폼 의존성, 규제 변화, 머천트 채택, 토큰 유틸리티 이탈, 현지화 품질을 리스크로 공개합니다. 완화책은 필요한 경우 계획 또는 조건부로 표현합니다.', href: 'whitepaper.html#ch11', link: '리스크와 완화', k: '리스크 완화 telegram 의존성 규제 커스터디 채택 현지화' },
        { id: 'whitepaper', q: '자세한 내용은 어디서 보나요?', a: '백서가 제품 및 기술 상세 기준 문서입니다. 요약, 제품 논리, UX, 아키텍처, 보안, 토큰 모델, 성장, 비즈니스 모델, 로드맵, 팀, 리스크, 용어집을 다룹니다.', href: 'whitepaper.html', link: '백서 읽기', k: '백서 자세한 문서 장 용어집 아키텍처' },
        { id: 'team', q: 'ONEWALLET 팀은 어떻게 구성되어 있나요?', a: '팀 섹션에는 공개된 창립자, 엔지니어링, 운영 파트너가 명시되어 있습니다. 거버넌스나 파트너십 등 공개 정보 외 문의는 Telegram으로 연락해 주세요.', href: '#team', link: '팀 섹션', k: '팀 창립자 거버넌스 누구 사람' },
        { id: 'support', q: '어떻게 문의하거나 사용해볼 수 있나요?', a: '현재 공개 진입점은 Telegram 링크입니다. 계정별 또는 출시 관련 질문은 Telegram 지원 채널을 실제 행동 기준으로 보아야 합니다.', href: 'https://t.me/onedollar_wallet_bot/app', link: 'Telegram 열기', k: '문의 지원 telegram 사용 앱 봇 도움' }
      ]
    },
    ja: {
      navLabel: 'ONEWALLET に質問',
      pillText: '何でも聞いてください',
      pillKey: '⌘K',
      pillKeyAlt: 'Ctrl K',
      title: 'ONEWALLET に質問',
      subtitle: '静的プロトタイプ · 承認済み公開コピーのみ',
      close: '閉じる',
      back: '戻る',
      send: '質問',
      placeholder: 'セキュリティ、手数料、決済、$1、ロードマップを質問…',
      suggested: 'おすすめの質問',
      readDisclosure: '注意事項を見る',
      disclosureTitle: 'アシスタントについて',
      disclosure: [
        'このアシスタントは静的プロトタイプです。現在公開されている ONEWALLET ウェブサイトとホワイトペーパー草案から作成された回答のみを返します。ライブ AI エージェントではなく、ユーザーのアカウントにはアクセスしません。',
        'これは金融、法律、税務、投資の助言ではありません。価格、収益、取引所上場、監査、規制、ベンダーアーキテクチャの保証は行いません。「目標」「計画」「草案」などの将来表現は、最終的な製品・セキュリティ・法務レビューによって変更される可能性があります。',
        'アカウント固有の問題、ローンチ日、その他公開コピーにない事項は Telegram でお問い合わせください。'
      ],
      disclosureLinks: [
        { href: 'whitepaper.html#ch11', label: 'ホワイトペーパー · リスクと緩和' },
        { href: 'whitepaper.html#ch12', label: 'ホワイトペーパー · 用語集' },
        { href: 'https://t.me/onedollar_wallet_bot/app', label: 'Telegram で ONEWALLET を開く' }
      ],
      fallback: '現在の公開ホームページとホワイトペーパー草案にある内容だけ回答できます。ウォレット作成、MPC セキュリティ、復旧、決済、手数料、$1 ユーティリティ、ロードマップ、リスク、Telegram サポートについて質問してください。',
      items: [
        { id: 'what', featured: true, q: 'ONEWALLET は何をするものですか？', a: 'ONEWALLET は Telegram ネイティブの Web3 ウォレット兼決済レールです。キーレス MPC カストディ、QR 決済、加盟店ツール、$1 ユーティリティを Telegram の Mini App 内でつなぎます。', href: 'whitepaper.html#ch1', link: '概要を見る', k: 'what product wallet payment telegram mini app' },
        { id: 'open', q: 'ウォレットはどう開きますか？', a: 'Telegram から ONEWALLET を開き、デバイスを確認し、ウォレットを作成します。その後 Mini App 内で送金、支払い、報酬機能を使えます。公開コピーでは、アプリストアのダウンロードや標準のシードフレーズ設定を避ける流れです。', href: '#product-flow', link: 'プロダクトフロー', k: 'open wallet telegram onboarding setup device' },
        { id: 'custody', featured: true, q: 'ONEWALLET はカストディ型ですか？', a: '単一の当事者だけでは資金を動かせません。目標カストディモデルは、デバイス、サーバー、復旧シェアによる 2-of-3 MPC です。サーバーシェア単体では取引に署名できません。', href: '#security', link: 'セキュリティモデル', k: 'custody mpc security sign share server' },
        { id: 'recovery', q: 'デバイスや Telegram アカウントを失った場合は？', a: '復旧は新しいデバイスシェアを発行し、復旧シェアで検証する設計です。デバイスや Telegram セッションを失っても、サーバー単独で資金を動かす権限は生まれません。', href: 'whitepaper.html#ch5', link: 'セキュリティ章', k: 'lost device telegram recovery account share rotate' },
        { id: 'seed', q: 'シードフレーズは必要ですか？', a: '標準では不要です。ONEWALLET は MPC を使うため、通常ユーザーが管理する単一のシードフレーズはありません。高度なバックアップやエクスポートは、製品・セキュリティ承認の対象です。', href: '#faq', link: 'FAQ', k: 'seed phrase backup key mpc' },
        { id: 'networks', q: 'どのネットワークに対応しますか？', a: '公開草案では TON、Ethereum、BNB Chain、TRON、主要ステーブルコインを対象にしています。最終的な対応ネットワークは公開ローンチ前に確認される必要があります。', href: '#faq', link: 'ネットワーク FAQ', k: 'network chain ton ethereum bnb tron stablecoin usdt usdc' },
        { id: 'payments', featured: true, q: '加盟店決済はどう動きますか？', a: '加盟店が QR 請求を作成し、ユーザーが Telegram 内でスキャンします。ONEWALLET は受取先、手数料、為替プレビューを表示し、MPC 署名後に決済 Webhook で POS 照合を支援します。', href: '#payments', link: '決済セクション', k: 'payment merchant qr invoice webhook settlement pos stablecoin' },
        { id: 'fees', featured: true, q: '手数料はどうなりますか？', a: '公開モデルでは、ネットワークガス代に加えて、スワップと加盟店決済に透明な ONEWALLET 手数料があります。$1 保有による優遇手数料は、最終的なトークン・法務レビューの対象です。', href: '#token', link: '$1 ユーティリティ', k: 'fees gas swap merchant discount token' },
        { id: 'token', q: '$1 トークンは何に使いますか？', a: '$1 は手数料割引、ユーザー報酬、加盟店インセンティブ、エコシステムアクセス、ガバナンスシグナルのためのユーティリティトークンとして位置づけています。価格、収益、取引所上場の約束はしません。', href: 'whitepaper.html#ch6', link: 'トークンモデル', k: 'token utility rewards governance incentives discount' },
        { id: 'roadmap', q: 'ONEWALLET はライブですか？', a: '現在の公開ロードマップでは、コアウォレットは完了、決済レールは進行中、$1 ユーティリティとエコシステムは計画中です。日付は公開コミットメントが承認されるまで意図的に省いています。', href: '#roadmap', link: 'ロードマップ', k: 'live status roadmap done progress planned launch testing' },
        { id: 'risks', q: 'どんなリスクが開示されていますか？', a: 'ホワイトペーパーは、カストディ侵害、Telegram プラットフォーム依存、規制変化、加盟店採用、トークンユーティリティのずれ、ローカライズ品質をリスクとして開示しています。緩和策は必要に応じて計画または条件付きで記載しています。', href: 'whitepaper.html#ch11', link: 'リスクと緩和策', k: 'risk mitigation telegram dependency regulatory custody adoption localization' },
        { id: 'whitepaper', q: '詳細はどこで読めますか？', a: 'ホワイトペーパーが製品・技術の詳細リファレンスです。概要、製品論点、UX、アーキテクチャ、セキュリティ、トークンモデル、成長、ビジネスモデル、ロードマップ、チーム、リスク、用語集を扱います。', href: 'whitepaper.html', link: 'ホワイトペーパーを読む', k: 'whitepaper details documentation chapters glossary architecture' },
        { id: 'team', q: 'ONEWALLET のチームは？', a: 'チームセクションでは、公開コピーに記載された創業者、エンジニアリング、運営パートナーを紹介しています。ガバナンスやパートナーシップなど公開外の質問は Telegram でご連絡ください。', href: '#team', link: 'チームセクション', k: 'team founders governance who behind people' },
        { id: 'support', q: '問い合わせや試用はどうしますか？', a: '現在の公開エントリーポイントは Telegram リンクです。アカウント別またはローンチ関連の質問は、Telegram サポートを実際の案内先として扱ってください。', href: 'https://t.me/onedollar_wallet_bot/app', link: 'Telegram を開く', k: 'contact support telegram try app bot help' }
      ]
    },
    zh: {
      navLabel: '询问 ONEWALLET',
      pillText: '随便问点什么',
      pillKey: '⌘K',
      pillKeyAlt: 'Ctrl K',
      title: '询问 ONEWALLET',
      subtitle: '静态原型 · 仅使用已批准公开文案',
      close: '关闭',
      back: '返回',
      send: '提问',
      placeholder: '询问安全、费用、支付、$1、路线图…',
      suggested: '推荐问题',
      readDisclosure: '查看声明',
      disclosureTitle: '关于此助手',
      disclosure: [
        '此助手为静态原型，仅基于当前公开的 ONEWALLET 网站和白皮书草稿生成答复。它不是实时 AI 代理，也不会访问您的账户。',
        '此处内容不构成任何金融、法律、税务或投资建议。我们不对价格、收益、交易所上线、审计、监管或供应商架构作出保证。"目标"、"计划"、"草稿"等前瞻性表述仍需最终产品、安全及法律审查。',
        '关于账户问题、上线日期或公开文案未涵盖的事项，请通过 Telegram 联系我们。'
      ],
      disclosureLinks: [
        { href: 'whitepaper.html#ch11', label: '白皮书 · 风险与缓解' },
        { href: 'whitepaper.html#ch12', label: '白皮书 · 术语表' },
        { href: 'https://t.me/onedollar_wallet_bot/app', label: '在 Telegram 中打开 ONEWALLET' }
      ],
      fallback: '我只能根据当前公开主页和白皮书草稿回答。可以询问钱包开通、MPC 安全、恢复、支付、费用、$1 效用、路线图、风险或 Telegram 支持。',
      items: [
        { id: 'what', featured: true, q: 'ONEWALLET 是做什么的？', a: 'ONEWALLET 是原生于 Telegram 的 Web3 钱包和支付通道。它把无种子短语 MPC 托管、QR 支付、商户工具和 $1 效用整合到 Telegram Mini App 中。', href: 'whitepaper.html#ch1', link: '执行摘要', k: 'what product wallet payment telegram mini app' },
        { id: 'open', q: '如何打开钱包？', a: '从 Telegram 打开 ONEWALLET，验证设备，创建钱包，然后在 Mini App 中转账、支付或获得奖励。公开文案避免把应用商店下载和默认助记词设置作为主流程。', href: '#product-flow', link: '产品流程', k: 'open wallet telegram onboarding setup device' },
        { id: 'custody', featured: true, q: 'ONEWALLET 是托管型吗？', a: '没有任何单一主体可以移动资金。目标托管模型是设备、服务器和恢复分片组成的 2-of-3 MPC。任何单一分片，包括服务器分片，都不能单独签名交易。', href: '#security', link: '安全模型', k: 'custody mpc security sign share server' },
        { id: 'recovery', q: '丢失设备或 Telegram 账户怎么办？', a: '恢复流程设计为发放新的设备分片，并通过恢复分片进行验证。丢失设备或 Telegram 会话，不会让服务器单独获得移动资金的权限。', href: 'whitepaper.html#ch5', link: '安全章节', k: 'lost device telegram recovery account share rotate' },
        { id: 'seed', q: '需要助记词吗？', a: '默认不需要。ONEWALLET 使用 MPC，因此普通用户不需要管理单一助记词。高级备份或导出行为仍应经过产品和安全审批。', href: '#faq', link: 'FAQ', k: 'seed phrase backup key mpc' },
        { id: 'networks', q: '支持哪些网络？', a: '公开草稿目标支持 TON、Ethereum、BNB Chain、TRON 和主要稳定币。最终网络列表应在公开上线前确认。', href: '#faq', link: '网络 FAQ', k: 'network chain ton ethereum bnb tron stablecoin usdt usdc' },
        { id: 'payments', featured: true, q: '商户支付如何工作？', a: '商户生成 QR 发票，用户在 Telegram 内扫描。ONEWALLET 预览收款方、费用和汇率，MPC 签名后通过结算 Webhook 支持 POS 对账。', href: '#payments', link: '支付部分', k: 'payment merchant qr invoice webhook settlement pos stablecoin' },
        { id: 'fees', featured: true, q: '费用如何计算？', a: '公开模型为网络 gas 加上透明的 ONEWALLET 兑换和商户支付费用。持有 $1 可享受优惠费率的描述仍需最终代币和法律审查。', href: '#token', link: '$1 效用', k: 'fees gas swap merchant discount token' },
        { id: 'token', q: '$1 代币有什么用途？', a: '$1 被定位为效用型代币，用于费用折扣、用户奖励、商户激励、生态访问和治理信号。网站不承诺价格、收益或交易所上线。', href: 'whitepaper.html#ch6', link: '代币模型', k: 'token utility rewards governance incentives discount' },
        { id: 'roadmap', q: 'ONEWALLET 已经上线了吗？', a: '当前公开路线图显示，核心钱包已完成，支付通道进行中，$1 效用和生态建设为计划中。日期会在负责人批准公开承诺后再展示。', href: '#roadmap', link: '路线图', k: 'live status roadmap done progress planned launch testing' },
        { id: 'risks', q: '披露了哪些风险？', a: '白皮书披露了托管被入侵、Telegram 平台依赖、监管变化、商户采用、代币效用偏移和本地化质量等风险。缓解措施在适当位置标为计划或条件性内容。', href: 'whitepaper.html#ch11', link: '风险与缓解', k: 'risk mitigation telegram dependency regulatory custody adoption localization' },
        { id: 'whitepaper', q: '在哪里阅读详细信息？', a: '白皮书是详细的产品和技术参考，涵盖执行摘要、产品论点、UX、架构、安全、代币模型、增长、商业模型、路线图、团队、风险和术语表。', href: 'whitepaper.html', link: '阅读白皮书', k: 'whitepaper details documentation chapters glossary architecture' },
        { id: 'team', q: 'ONEWALLET 团队是谁？', a: '团队部分介绍了公开文案中列出的创始人、工程和运营合作伙伴。关于治理或合作的其他问题，请通过 Telegram 联系团队。', href: '#team', link: '团队部分', k: 'team founders governance who behind people' },
        { id: 'support', q: '如何联系或试用 ONEWALLET？', a: '当前公开入口是 Telegram 链接。账户相关或上线相关问题，应以 Telegram 支持作为实际操作入口。', href: 'https://t.me/onedollar_wallet_bot/app', link: '打开 Telegram', k: 'contact support telegram try app bot help' }
      ]
    }
  };

  return { STR };
})();
