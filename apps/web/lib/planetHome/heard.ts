/**
 * M-R259: which kororins this member has heard (touched until it spoke), per planet — kept on this device so a reload
 * keeps them in the grooves. Only ids still on the record are kept. Browser storage can be missing (private window):
 * then nothing is remembered and the page still works.
 */
const key = (userId: string, planet: string) => `obolo.home.heard.${userId}.${planet}`;

export function loadHeard(userId: string, planet: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(userId, planet));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveHeard(userId: string, planet: string, heard: ReadonlySet<string>, keep?: ReadonlySet<string>) {
  try {
    const ids = [...heard].filter((id) => !keep || keep.has(id)).slice(-800);
    localStorage.setItem(key(userId, planet), JSON.stringify(ids));
  } catch {
    /* storage blocked: not remembered */
  }
}
