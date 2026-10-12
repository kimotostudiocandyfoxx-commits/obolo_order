import { ART_BASE } from '@/components/art/Stage';

/** The painted covers (Art workshop) a song wears until songs get their own jackets. */
const COVERS = ['moon', 'sakura', 'ocean', 'city', 'forest', 'candy', 'space', 'fire', 'rain', 'dawn'];
const hash = (t: string) => [...t].reduce((n, c) => n + c.charCodeAt(0), 0);

/** The same id always gets the same cover. */
export const songCover = (id: string) => `${ART_BASE}/cover-${COVERS[hash(id) % COVERS.length]}.jpg`;
