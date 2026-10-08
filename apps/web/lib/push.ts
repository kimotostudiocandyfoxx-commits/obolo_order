'use client';

import { getApi } from '@/lib/api';

/**
 * Web Push on this device (client request 2026-10-08): incoming calls and mail as notifications,
 * even when the app is closed. iPad / iPhone: only from the app added to the Home Screen.
 */
export type PushState = 'unsupported' | 'needs-home-screen' | 'off' | 'on' | 'denied';

const isIos = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const standalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIos() && !standalone() ? 'needs-home-screen' : 'unsupported';
  }
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/** Turn notifications on (call from a tap: the browser asks for permission). */
export async function enablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.register('/sw.js');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  await navigator.serviceWorker.ready;
  const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')}/push/key`);
  const { publicKey } = (await res.json()) as { publicKey: string };
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await getApi().subscribePush(json);
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await getApi()
      .unsubscribePush(sub.endpoint)
      .catch(() => undefined);
    await sub.unsubscribe();
  }
  return 'off';
}
