import type { WorkMaterial } from '@obolo/shared';
import { workMarkRef } from '@/lib/finds/works';
import type { AtelierKind } from '@/lib/atelier/unlock';
export { dayWord, madeDay, PROPOSAL, PROPOSAL_ASK, proposalFor, type Proposal } from './proposal';
import type { Work } from './work';

/**
 * M-R253 §3: a work made before as the material of the next one. On the morning a kind opens {bati} offers the works
 * of the days before (the member chooses); a work dragged from Bluena into the chat is material too. What each kind
 * takes: a kororin's words → a song's lyrics / a picture's words; a picture → an MV's still; songs → an MV, a show.
 */
export { TAKES, usesOf } from './proposal';

/** a work as material (small on the new card) */
export function asMaterial(w: Work): WorkMaterial {
  const ref = workMarkRef(w);
  return { id: w.atelierId ?? w.id, kind: w.kind, title: (w.title || w.text || w.prompt || '').slice(0, 120), image: w.image ?? w.poster ?? null, audio: w.audio && w.audio !== 'synth:' ? w.audio : null, text: w.kind === 'voice' ? (w.text ?? w.title ?? '').slice(0, 400) : null, ref: ref.kind === 'local' ? null : ref };
}

/** material back as a work the makers read (its words, picture, song) */
export function fromMaterial(m: WorkMaterial): Work {
  const r = m.ref;
  const ref: Work['ref'] = r?.kind === 'song' ? { songId: r.id } : r?.kind === 'jupiter_root' ? { rootId: r.id } : r?.kind === 'saturn_post' ? { postId: r.id } : r?.kind === 'mars_backstage' ? { backstageId: r.id } : r?.kind === 'radio_show' ? { showId: r.id } : undefined;
  return { id: m.id, kind: m.kind, prompt: '', status: 'ready', title: m.title, text: m.text ?? undefined, image: m.image ?? undefined, audio: m.audio ?? undefined, ref, saved: true };
}
