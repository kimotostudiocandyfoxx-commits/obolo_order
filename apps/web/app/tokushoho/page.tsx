import { MANA_GEMS, OPERATOR, ORDER_PRICE_JPY } from '@obolo/shared';
import { LegalPage } from '@/components/LegalPage';

const TITLE = '特定商取引法に基づく表記';
export const metadata = { title: TITLE };

/** 88円・888円・8,888円 — and each gem's mana (P-BILL-1, MANA_GEMS: 1 yen = 1 mana, client 2026-11-24) */
const yen = (n: number) => n.toLocaleString('ja-JP');
const GEM_PRICES = MANA_GEMS.map((g) => `${yen(g.priceJpy)}円`).join('・');
const GEM_LINES = MANA_GEMS.map((g) => `${yen(g.priceJpy)}円（${yen(g.mana)}マナ）`).join('、');

/**
 * 〔特定商取引法に基づく表記〕 for the ¥88/month Eclipse subscription and the mana gems (P-BILL-1; linked from the payment screen, the settings and
 * next to 〔利用規約〕〔プライバシーについて〕). The operator's details come from OPERATOR (packages/shared/src/legal.ts,
 * client 2026-11-24); the phone number is disclosed on request, not published.
 */
const ITEMS: { term: string; body: string }[] = [
  { term: '販売事業者', body: OPERATOR.company },
  { term: '運営責任者', body: OPERATOR.manager },
  { term: '所在地', body: OPERATOR.address },
  { term: '電話番号', body: OPERATOR.phone },
  { term: 'メールアドレス', body: OPERATOR.email },
  { term: '販売価格', body: `エクリプス（OBOLO ORDER 月額）：月額${ORDER_PRICE_JPY}円（税込）` },
  { term: '販売価格（マナジェム）', body: `${GEM_PRICES}（税込）。マナジェムは、Obolo Order の方が、マナが足りない時に買えるアプリの中のマナです。それぞれ ${GEM_LINES} が加わります。` },
  { term: '商品代金以外の必要料金', body: 'インターネットにつなぐための通信料は、お客様のご負担になります。' },
  { term: '支払方法', body: 'クレジットカード（Stripe による決済）' },
  { term: '支払時期', body: 'エクリプス：初回はお申し込みの時。そのあとは毎月の更新日（お申し込みの日と同じ日）に、自動でお支払いになります。マナジェム：お買い上げの時に、一回だけお支払いになります（自動で続くことはありません）。' },
  { term: '提供時期', body: 'エクリプス：お支払いが済んだその時から、すぐに使えます。マナジェム：お支払いが済むとすぐに、マナがあなたのマナに加わります。' },
  {
    term: '解約・返品（エクリプス）',
    body: '〔設定〕→〔エクリプス（月¥88）〕→〔支払い方法の変更・解約〕から、いつでも解約できます。解約しても、その月の終わり（次の更新日の前日）までは使えます。次の更新日からお支払いは止まります。日割りでの返金はありません。デジタルのサービスのため、返品はできません。まちがって二重にお支払いになった時は、お問い合わせから返金します。',
  },
  {
    term: '返品・返金（マナジェム）',
    body: 'マナジェムはデジタルの品のため、マナが加わった後の返品・返金はできません（法律で返金が必要な場合を除きます）。マナはアプリの中だけで使え、人にあげたり、お金に換えたりはできません。マナが加わらなかった時や、まちがって二重にお支払いになった時は、お問い合わせから対応します。',
  },
  { term: '動作環境', body: 'スマートフォン（iPhone の Safari、Android の Chrome）またはパソコン（Chrome・Safari・Edge）の新しい版。インターネットへの接続が必要です。' },
];

export default function TokushohoPage() {
  return (
    <LegalPage>
      <article>
        <h1 className="text-lg font-black">{TITLE}</h1>
        <dl className="mt-4 divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/5 px-4">
          {ITEMS.map((it) => (
            <div key={it.term} className="py-3 text-[14px] leading-relaxed">
              <dt className="font-bold text-amber-100">{it.term}</dt>
              <dd className="mt-1 text-white/80">{it.body}</dd>
            </div>
          ))}
        </dl>
      </article>
    </LegalPage>
  );
}
