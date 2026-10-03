/** Prompt used by the background job that condenses chat history into long-term memory (spec §2.2). */
export const MEMORY_SUMMARY_PROMPT = {
  ja: `以下は相棒キャラクターとユーザーの会話です。今後の会話で役立つ「ユーザーについての長期記憶」を更新してください。
- 既存の記憶と新しい会話を統合し、箇条書き（最大15項目、各1行）で出力。
- 名前・好み・目標・最近の出来事・大事にしていること など、次に話すとき覚えておくべきことだけ。
- 一時的な雑談や、パスワード・住所・電話番号などの機微情報は記録しない。
- 箇条書き以外は出力しない。`,
  en: `Below is a conversation between a buddy character and the user. Update the long-term memory about the USER for future chats.
- Merge the existing memory with the new conversation; output up to 15 bullet points, one line each.
- Keep only what is worth remembering next time: name, likes, goals, recent events, values.
- Do not record small talk or sensitive data (passwords, addresses, phone numbers).
- Output only the bullet list.`,
} as const;
