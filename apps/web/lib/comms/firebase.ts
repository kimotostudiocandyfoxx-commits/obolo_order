'use client';

import type { DmMessage } from '@obolo/shared';
import { getApi } from '@/lib/api';

/**
 * Firebase real-time mail (loaded only when Firebase is set up — see docs/earth-comms.md).
 * Our API gives a sign-in token (uid = our user id); Firestore rules let a member read only the
 * conversations they are in (dm/{a_b}, members [a, b]); nobody writes from the app.
 */
const pairKey = (a: string, b: string) => [a, b].sort().join('_');

type Stored = { id: string; senderId: string; recipientId: string; kind: string; text: string; audioUrl: string | null; createdAt: string };

export async function listenConversation(configJson: string, myId: string, peerId: string, onNew: (m: DmMessage[]) => void): Promise<() => void> {
  const [{ initializeApp, getApps }, { getAuth, signInWithCustomToken }, { getFirestore, collection, query, orderBy, limit, onSnapshot }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);
  const app = getApps().find((a) => a.name === 'obolo-comms') ?? initializeApp(JSON.parse(configJson), 'obolo-comms');
  const auth = getAuth(app);
  if (auth.currentUser?.uid !== myId) {
    const { token } = await getApi().firebaseToken();
    await signInWithCustomToken(auth, token);
  }
  const q = query(collection(getFirestore(app), 'dm', pairKey(myId, peerId), 'messages'), orderBy('createdAt', 'asc'), limit(200));
  return onSnapshot(q, (snap) => {
    const added = snap
      .docChanges()
      .filter((c) => c.type === 'added')
      .map((c) => c.doc.data() as Stored)
      .map((m) => ({ id: m.id, fromMe: m.senderId === myId, kind: (m.kind === 'voice' ? 'voice' : 'text') as DmMessage['kind'], text: m.text, audioUrl: m.audioUrl, createdAt: m.createdAt }));
    if (added.length) onNew(added);
  });
}
