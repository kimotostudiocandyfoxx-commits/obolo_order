export const KV = Symbol('KV');
export const QUEUE = Symbol('QUEUE');
export const EMAIL = Symbol('EMAIL');
export const LLM = Symbol('LLM');
export const IMAGES = Symbol('IMAGES');
export const LOOK_IMAGES = Symbol('LOOK_IMAGES');
/** Bati's conversation: Claude Haiku 5.5 when its key is set, else the same chain as LLM */
export const BUDDY_LLM = Symbol('BUDDY_LLM');
/** client 2026-11-25: a book's chapters (NOVEL_MODEL) and a game's code (GAME_MODEL), each its own provider chain */
export const NOVEL_LLM = Symbol('NOVEL_LLM');
export const GAME_LLM = Symbol('GAME_LLM');
