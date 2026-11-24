'use client';

import type { ClipFile } from '@obolo/shared';
import { useEffect, useRef, useState } from 'react';
import { getApi } from '@/lib/api';
import type { ClipMode } from './rows';

/**
 * Bluena's 📎 on the web: the upload in pieces, the private files as object URLs (they are fetched with the session's
 * token — never a public link), Bluena's list of them, and the hand-over to a ダチ talk / {bati}.
 */

/** one file up, in pieces; `onSent` gets the bytes gone so far */
export async function uploadClip(file: File, onSent: (bytes: number) => void): Promise<ClipFile> {
  const api = getApi();
  const st = await api.startClip({
    name: file.name,
    type: file.type,
    size: file.size,
  });
  for (let n = 0; n < st.parts; n++) {
    const from = n * st.chunkBytes;
    const piece = file.slice(from, Math.min(file.size, from + st.chunkBytes));
    let tries = 0;
    // a dropped connection on a phone: the same piece again (twice), not the whole file
    for (;;) {
      try {
        await api.putClipPart(st.id, n, piece, (b) => onSent(from + b));
        break;
      } catch (e) {
        if (++tries > 2 || (e as { status?: number }).status !== 0) throw e;
      }
    }
    onSent(from + piece.size);
  }
  return api.finishClip(st.id);
}

const urls = new Map<string, Promise<string | null>>();
/** a file's object URL (kept for the page's life: the same file in a talk and in Bluena is fetched once) */
export function clipUrl(id: string): Promise<string | null> {
  let p = urls.get(id);
  if (!p) {
    p = getApi()
      .clipBlob(id)
      .then((b) => URL.createObjectURL(b))
      .catch(() => {
        urls.delete(id);
        return null;
      });
    urls.set(id, p);
  }
  return p;
}
export function useClipUrl(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return setUrl(null);
    let live = true;
    void clipUrl(id).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [id]);
  return url;
}

const CHANGED = 'obolo:clips';
/** Bluena's files changed (one kept, sent, dropped): the lists load again */
export const clipsChanged = () => window.dispatchEvent(new Event(CHANGED));

/** your 📎 files, newest first (null while loading) */
export function useClips(): ClipFile[] | null {
  const [list, setList] = useState<ClipFile[] | null>(null);
  useEffect(() => {
    let live = true;
    const load = () =>
      void getApi()
        .clips()
        .then((l) => live && setList(l))
        .catch(() => live && setList([]));
    load();
    window.addEventListener(CHANGED, load);
    return () => {
      live = false;
      window.removeEventListener(CHANGED, load);
    };
  }, []);
  return list;
}

export const CLIP_SEND = 'obolo:clip-send';
export type ClipSendDetail = {
  to: Exclude<ClipMode, 'keep'>;
  files: ClipFile[];
};
/** the files to the open ダチ talk (DachiThread) or to {bati} (AtelierChat) */
export const sendClips = (to: ClipSendDetail['to'], files: ClipFile[]) => window.dispatchEvent(new CustomEvent<ClipSendDetail>(CLIP_SEND, { detail: { to, files } }));

/** listen for files sent to `to` (the newest `on` is called: it may read this render's state) */
export function useClipSend(to: ClipSendDetail['to'], on: (files: ClipFile[]) => void) {
  const cb = useRef(on);
  cb.current = on;
  useEffect(() => {
    const got = (e: Event) => {
      const d = (e as CustomEvent<ClipSendDetail>).detail;
      if (d?.to === to && d.files.length) cb.current(d.files);
    };
    window.addEventListener(CLIP_SEND, got);
    return () => window.removeEventListener(CLIP_SEND, got);
  }, [to]);
}
