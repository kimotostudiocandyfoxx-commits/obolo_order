# 地球のメール・電話（2026-10-08）

ORDER（¥88）に入ったメンバーに、地球の「✉️ メール」「📞 電話」がひらきます。
相手は **ダチ（おたがいにフォローしている人）だけ**、相手もメンバーのときだけ使えます（P-COMMS-2）。

## しくみ（もうできている枠組み）

```
アプリ（地球）──送る──▶ API（メンバー？ダチ？言葉チェック → 保存）──▶ Firebase（リアルタイム配達）──▶ 相手のアプリ
アプリ（地球）──かける─▶ API（呼び出し・応答・終了 / Agora の入場券を発行）──▶ Agora（音声）◀── 相手のアプリ
```

- **メール**：送信はかならず API を通ります（メンバー・ダチ・NGワードのチェック、保存）。
  Firebase は「届ける」だけ。Firebase を入れる前は、アプリが数秒ごとに新着を確認します（今もこれで動きます）。
- **電話**：呼び出し・出る／出ない・切るは API が管理。音声は Agora。
  Agora を入れる前は「デモ」：呼び出し→応答→通話中→終了まで動き、声だけつながりません。
- 数字は出しません（未読は点だけ）。

| 場所 | ファイル |
|---|---|
| API | `apps/api/src/comms/`（`providers.ts` が Agora / Firebase のつなぎ口） |
| DB | `dm_messages`, `call_sessions`（`apps/api/drizzle/0017_earth_comms.sql`） |
| 画面 | `apps/web/components/earth/Comms.tsx` |
| 音声・配達 | `apps/web/lib/comms/call.ts`（Agora）, `mail.ts` / `firebase.ts`（Firebase） |
| Firestore のルール | `firebase/firestore.rules` |

それぞれ **キーを入れると自動で切り替わります**（コードの変更はいりません）。

## 手順 1：Agora（電話）

1. https://console.agora.io でアカウントを作り、プロジェクトを作成
   - 認証方式は **「Secured mode: APP ID + Token」** を選ぶ
2. プロジェクトの **App ID** と **App Certificate** を確認
3. Cloud Shell で `bash scripts/comms-setup.sh` を実行し、聞かれたら **App Certificate** を貼る（画面には出ません）
4. GitHub → Settings → Secrets and variables → Actions → **Variables** に
   `AGORA_APP_ID` = App ID を追加（App ID は秘密ではありません）
5. 作業ブランチに何か push する（または Actions の「Deploy API」を再実行）→ 電話が Agora に切り替わる
6. 確認：iPad 2台（または iPad＋スマホ）で、ダチ同士で電話 → 声が聞こえる

※ 料金の目安：Agora は毎月 10,000 分まで無料、それ以上は音声 1,000 分あたり約 $0.99（最新は Agora の料金ページで確認）。

## 手順 2：Firebase（メールのリアルタイム配達）

1. https://console.firebase.google.com →「プロジェクトを追加」→ **既存の Google Cloud プロジェクト `obolo-order` を選ぶ**
   （同じプロジェクトにすると、キーファイルを作らずに API が自分の権限で Firebase を使えます）
2. Cloud Shell で `bash scripts/comms-setup.sh`（手順1と同じスクリプト。Firestore の作成と権限の設定をします）
3. Firebase コンソール → Firestore → **ルール** に `firebase/firestore.rules` の中身を貼って「公開」
4. Firebase コンソール → プロジェクトの設定 →「アプリを追加」→ **Web** → 表示される `firebaseConfig` を確認
5. Vercel（oboloorder-web）→ Settings → Environment Variables に
   `NEXT_PUBLIC_FIREBASE_CONFIG` = その設定を1行のJSONで（例 `{"apiKey":"…","authDomain":"…","projectId":"obolo-order","appId":"…"}`）
   ※ この値は公開されても大丈夫な設定です（守っているのはルールと API）
6. GitHub の **Variables** に `FIREBASE_PROJECT_ID` = `obolo-order` を追加
7. API を再デプロイ（push）＋ Vercel を再デプロイ → メールが一瞬で届くようになる

## 手順 3：本番前のチェック

- [ ] `COMMS_MEMBERS_ONLY` は `true` のまま（GitHub Variables で `false` にすると、未入会でも試せるテストモード）
- [ ] 入会していない人には 🔒 が出る／ダチ以外には送れない・かけられない
- [ ] NG ワードが送れない
- [x] 通報・ブロック（メール・電話の「⋯」から。ブロックするとフォローが外れ、メールも電話もできない。相手には知らされない）
- [ ] 通報を運営が見る画面（P-COMMS-5：通報は `user_reports` に保存済み。確認画面はまだ）
- [x] 着信・メールのプッシュ通知（Web Push。地球の「🔔 お知らせをオン」から。キーはサーバーが自動で作る。iPad/iPhone はホーム画面に追加したアプリからだけ）
- [ ] 1時間をこえる通話（P-COMMS-4：入場券が1時間で切れる。更新のしくみを追加）
