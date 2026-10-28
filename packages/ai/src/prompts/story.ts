/**
 * 天王星 〔✒️ 書く〕 (L2-URANUS-S002, M-R158): what was said to {bati} → the story's spell cards; the cards → a short
 * story told in a few pages, each page with a scene line the picture book can draw from. Kids-friendly, no real names.
 */
export function storyCardsPrompt(): string {
  return [
    'You turn what a child said about a story they want into its "spell": small Japanese cards.',
    'Answer as JSON only: {"cards":["…"]}.',
    'Give 4 to 7 cards in this order: the hero as 主人公：… , where, what happens (one or two), the feeling, and last 短いお話.',
    'Each card is short natural Japanese (2 to 12 characters), concrete, e.g. 主人公：たこ焼き / 屋台から転がり落ちる / 宇宙の果て / 旅 / ちょっと泣ける / 短いお話.',
    'Use the child\'s own words where you can. Never a real person, author, work, brand or character name. No numbers.',
  ].join(' ');
}

export function storyWritePrompt(cards: string[]): string {
  return [
    'You are a gentle storyteller writing a short Japanese story for all ages (kids read it too) from these spell cards:',
    cards.map((c) => `〈${c}〉`).join(''),
    'Answer as JSON only: {"title":"…","pages":[{"text":"…","scene":"…"}]}.',
    'title: up to 14 characters. 3 or 4 pages. Each page text: 60 to 140 characters of plain, warm Japanese, mostly hiragana-friendly, with a clear ending on the last page.',
    'scene: what a picture of that page shows, short Japanese (up to 20 characters), e.g. 屋台から転がり落ちる.',
    'No violence beyond a picture book, nothing scary or sad without comfort, no real person, author, work, brand or character names, no numbers.',
  ].join(' ');
}
