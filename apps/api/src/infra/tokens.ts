export const KV = Symbol('KV');
export const QUEUE = Symbol('QUEUE');
export const EMAIL = Symbol('EMAIL');
export const LLM = Symbol('LLM');
/** R17: each picture use on its own model — the art (ART_MODEL), the look (LOOK_MODEL), {bati} (BATI_MODEL), the kororin (KORORIN_MODEL) */
export const IMAGES = Symbol('IMAGES');
export const LOOK_IMAGES = Symbol('LOOK_IMAGES');
export const BATI_IMAGES = Symbol('BATI_IMAGES');
export const KORORIN_IMAGES = Symbol('KORORIN_IMAGES');
/** Bati's conversation: Claude Haiku 5.5 when its key is set, else the same chain as LLM */
export const BUDDY_LLM = Symbol('BUDDY_LLM');
/** client 2026-11-25: a book's chapters (NOVEL_MODEL) and a game's code (GAME_MODEL), each its own provider chain */
export const NOVEL_LLM = Symbol('NOVEL_LLM');
/** R17: the game tiers — GAME_LLM the full chain (GAME_MODEL_FULL), the cheap one (GAME_MODEL_CHEAP), the trial's (GAME_MODEL_TRIAL) */
export const GAME_LLM = Symbol('GAME_LLM');
export const GAME_CHEAP_LLM = Symbol('GAME_CHEAP_LLM');
export const GAME_TRIAL_LLM = Symbol('GAME_TRIAL_LLM');
/** R13: a song's lyrics with metatags (LYRICS_MODEL: Gemini Flash now, Claude by config) */
export const LYRICS_LLM = Symbol('LYRICS_LLM');
/** R14: the model that builds a spell first (SPELL_MODEL: Gemini Flash now, Claude by config) */
export const SPELL_LLM = Symbol('SPELL_LLM');
