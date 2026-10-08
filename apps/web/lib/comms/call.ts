'use client';

import type { CallJoin } from '@obolo/shared';

/**
 * Earth phone: the audio of a call (client decision 2026-10-08: Agora).
 * With Agora set up (the API hands out an Agora pass) the microphone is published to the call's
 * channel and the other person's voice is played; in demo mode nothing is sent (the call still
 * rings, connects and ends, so the whole flow can be tried).
 */
export type CallAudio = { mute: (on: boolean) => void; leave: () => Promise<void>; demo: boolean };

export async function connectAudio(join: CallJoin, onPeerLeft?: () => void): Promise<CallAudio> {
  if (join.provider !== 'agora') return { mute: () => {}, leave: async () => {}, demo: true };
  const { default: AgoraRTC } = await import('agora-rtc-sdk-ng');
  AgoraRTC.setLogLevel(3);
  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  client.on('user-published', async (user, mediaType) => {
    await client.subscribe(user, mediaType);
    if (mediaType === 'audio') user.audioTrack?.play();
  });
  client.on('user-left', () => onPeerLeft?.());
  await client.join(join.appId, join.channel, join.token, join.uid);
  const mic = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
  await client.publish([mic]);
  return {
    demo: false,
    mute: (on) => void mic.setEnabled(!on),
    leave: async () => {
      mic.close();
      await client.leave();
    },
  };
}
