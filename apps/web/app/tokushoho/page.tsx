import { ORDER_PRICE_JPY } from '@obolo/shared';
import { LegalPage } from '@/components/LegalPage';

const TITLE = '特定商取引法に基づく表記';
export const metadata = { title: TITLE };

/** what the operator still has to write in (PLACEHOLDER P-BILL-5 in docs/placeholders.md) */
const FILL = '（記入してください）';

/**
 * 〔特定商取引法に基づく表記〕 for the ¥88/month Eclipse subscription (linked from the payment screen, the settings and
 * next to 〔利用規約〕〔プライバシーについて〕). PLACEHOLDER (P-BILL-5): the operator's name, address, phone and e-mail are
 * left as 「（記入してください）」. For 所在地・電話番号 the law allows 「請求があれば遅滞なく開示します」 instead, where
 * the operator qualifies (e.g. an individual business that discloses on request) — the operator decides.
 */
const ITEMS: { term: string; body: string }[] = [
  { term: '販売事業者', body: FILL },
  { term: '運営責任者', body: FILL },
  { term: '所在地', body: FILL },
  { term: '電話番号', body: FILL },
  { term: 'メールアドレス', body: FILL },
  { term: '販売価格', body: `エクリプス（OBOLO ORDER 月額）：月額${ORDER_PRICE_JPY}円（税込）` },
  { term: '商品代金以外の必要料金', body: 'インターネットにつなぐための通信料は、お客様のご負担になります。' },
  { term: '支払方法', body: 'クレジットカード（Stripe による決済）' },
  { term: '支払時期', body: '初回はお申し込みの時。そのあとは毎月の更新日（お申し込みの日と同じ日）に、自動でお支払いになります。' },
  { term: '提供時期', body: 'お支払いが済んだその時から、すぐに使えます。' },
  {
    term: '解約・返品',
    body: '〔設定〕→〔エクリプス（月¥88）〕→〔支払い方法の変更・解約〕から、いつでも解約できます。解約しても、その月の終わり（次の更新日の前日）までは使えます。次の更新日からお支払いは止まります。日割りでの返金はありません。デジタルのサービスのため、返品はできません。まちがって二重にお支払いになった時は、お問い合わせから返金します。',
  },
  { term: '動作環境', body: 'スマートフォン（iPhone の Safari、Android の Chrome）またはパソコン（Chrome・Safari・Edge）の新しい版。インターネットへの接続が必要です。' },
];

export default function TokushohoPage() {
  return (
    <LegalPage>
      <article>
        <h1 className="text-lg font-black">{TITLE}</h1>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          下書きです。「{FILL}」の所は、運営者が記入します。所在地・電話番号は、法律で認められる場合は「請求があれば遅滞なく開示します」と書くこともできます。
        </p>
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
