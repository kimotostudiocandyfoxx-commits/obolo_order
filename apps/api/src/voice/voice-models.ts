import { HttpStatus } from '@nestjs/common';
import { apiError } from '../common/errors';
import type { AppConfig } from '../config';
import { createVoiceModel, deleteVoiceModel, textToSpeech } from './fish.client';

/**
 * The voice-model provider (M-R246): makes / deletes a member's private voice model and reads a text in it. Fish Audio
 * behind it (fish.client.ts: POST /model, DELETE /model/{id}, POST /v1/tts); tests give a fake.
 */
export interface VoiceModels {
  readonly enabled: boolean;
  create(o: { title: string; audio: Buffer; filename: string; mime: string; text?: string }): Promise<string>;
  remove(id: string): Promise<void>;
  speak(id: string, text: string, speed?: number): Promise<Buffer>;
}

export const VOICE_MODELS = Symbol('VOICE_MODELS');

export function fishVoiceModels(cfg: Pick<AppConfig, 'FISH_API_KEY' | 'FISH_MODEL'>): VoiceModels {
  const key = () => {
    if (!cfg.FISH_API_KEY) throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'VOICE_OFF', 'The voice service is not connected yet');
    return cfg.FISH_API_KEY;
  };
  return {
    enabled: !!cfg.FISH_API_KEY,
    create: (o) => createVoiceModel(key(), o),
    remove: (id) => deleteVoiceModel(key(), id),
    speak: (id, text, speed) => textToSpeech(key(), cfg.FISH_MODEL, { text, referenceId: id, ...(speed && speed !== 1 ? { prosody: { speed, volume: 0 } } : {}) }),
  };
}

/**
 * THE default cute voice (client 2026-11-27): one constant, the config's FISH_DEFAULT_VOICE_ID — the shared {bati} voice
 * model made from design/voices/default-bati-source.* pitched up two semitones (scripts/make-default-bati-voice.ts).
 * It is {bati}'s voice for a member with no voice of their own, and the voice that reads the ダチ messages of a member
 * who is not recorded (dachi/cute-voice.service.ts). Another voice = that one variable; null = no such voice here.
 */
export const defaultCuteVoiceId = (cfg: Partial<Pick<AppConfig, 'FISH_DEFAULT_VOICE_ID'>>): string | null => cfg.FISH_DEFAULT_VOICE_ID || null;
