/**
 * M-R252: the start-of-app agreement, the terms of use and the privacy summary — the words of the draft
 * (docs/legal/同意の画面と規約の下書き.md), word for word.
 * PLACEHOLDER (P-LEGAL-1 / P-LEGAL-2): these are DRAFTS. A specialist (a lawyer) checks them before launch (M-R248);
 * until then they stand in the app as they are. The contact (〔問い合わせ先〕) is left blank, as in the draft.
 * `{bati}` is {bati}'s name (バティ until one is given).
 */

/** 1-1: the year asked first; no answer / not known = treated as under 13 */
export const CONSENT_YEAR = {
  ask: '生まれた年を教えてください',
  pick: '年を選ぶ',
  /** the choice for no answer (the draft: 「答えない・分からない時は、13歳未満と同じ扱いにする」) */
  none: '答えない・分からない',
} as const;

/** 1-2: the agreement, split by age */
export const CONSENT_TEXT = {
  title: 'はじめる前に',
  adult: [
    'このアプリでは、あなたの写真と声を、あなたの姿と、相方（バティ）の声を作るためだけに使います。ほかの目的には使いません。',
    '作った作品は、あなたが『飛ばす』を選んだ時だけ、ほかの人に見えます。',
    '写真と声は、いつでも設定から消せます。',
  ],
  /** 13〜15: added to the body above */
  teen: '保護者の人と一緒に読んで、同意してもらってください。',
  under13: 'このアプリでは、写真と声を使いません。好きな動物からあなたの姿を作り、相方の声は、用意した声を使います。',
  terms: '利用規約',
  privacy: 'プライバシーについて',
  agree: '同意してはじめる',
  guardianAgreed: '保護者の人が同意しました',
  noGuardian: '保護者の同意なしではじめる',
  start: 'はじめる',
} as const;

export interface LegalItem {
  title: string;
  body: string;
}

/** 2: the terms of use (the draft's points) */
export const TERMS_TITLE = '利用規約';
export const TERMS_DRAFT: LegalItem[] = [
  { title: 'このアプリについて', body: 'Obolo Order は、相方の{bati}と話しながら、コロリン・アート・曲・映像・ラジオを作り、星に飛ばして見せ合うアプリです。' },
  { title: '会員（Obolo Order）', body: '月額88円（毎月88マナ）。値上げはしません。自動で続き、いつでも設定からやめられます。やめても、作った物は残ります。' },
  { title: 'マナ', body: 'アプリの中だけで使えるポイントです。人にあげたり、お金に換えたりはできません。' },
  { title: '作った物の権利', body: 'あなたが作った物は、あなたの物です。運営は、アプリの中で表示・保存するためにだけ使います。' },
  { title: 'してはいけないこと', body: '他人の写真や声を使うこと、人を傷つける物・性的な物・ほかの人の作品のまねを作って飛ばすこと、なりすまし。' },
  { title: '通報と対応', body: '問題のある作品や会話は通報できます。運営は、見えなくしたり、使えなくしたりできます。' },
  { title: 'AIについて', body: '{bati}の返事や作品づくりには AI を使います。まちがうことがあります。大事なことは、自分でも確かめてください。' },
  { title: '変更', body: '規約を変える時は、アプリの中で知らせます。' },
];

/** 3: the privacy summary (the draft's points) */
export const PRIVACY_TITLE = 'プライバシーについて';
export const PRIVACY_DRAFT: LegalItem[] = [
  { title: '集めるもの', body: '生まれた年、名前（呼び名）、写真（16歳以上と、保護者の同意がある13〜15歳だけ）、声（同じ）、作った物、{bati}との会話、支払いの記録。' },
  { title: '使い道', body: 'あなたの姿と相方の声を作るため、アプリを動かすため、困った時の対応のため。広告には使いません。' },
  { title: 'AI の会社へ渡すもの', body: '返事や作品を作るために、必要な分だけを AI の会社（Anthropic など）や、声・画像を作る会社に送ります。それらの会社が、学習に使わない設定で使います。' },
  { title: '見えるもの', body: '飛ばした作品は、星で88時間ほかの人に見えます（15歳未満の人には、ダチの作品だけが見えます）。会話はダチどうしだけです。' },
  { title: '消す', body: '写真・声・作った物・会話は、設定から消せます。退会すると、すべて消します（支払いの記録など、法律で残す必要があるものを除く）。' },
  { title: '子ども', body: '13歳未満の人の写真と声は集めません。13〜15歳は、保護者の同意がある時だけ集めます。' },
  // PLACEHOLDER (P-LEGAL-1): the contact is blank in the draft
  { title: '問い合わせ', body: '〔問い合わせ先〕' },
];

/** the note shown on the terms / privacy pages until the specialist's check (M-R248) */
export const LEGAL_DRAFT_NOTE = '下書きです。公開する前に、専門の人に確かめてもらいます。';

/** `{bati}` → {bati}'s name */
export const legalText = (s: string, bati?: string | null) => s.replace(/\{bati\}/g, bati || 'バティ');
