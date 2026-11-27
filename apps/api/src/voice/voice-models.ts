import { HttpStatus } from '@nestjs/common';
import { batiFixedVoice, type BatiEggKind } from '@obolo/shared';
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
 * THE default cute voice (client 2026-11-27): one constant, the config's FISH_DEFAULT_VOICE_ID — the shared voice model
 * made from design/voices/default-bati-source.* pitched up two semitones (scripts/make-default-bati-voice.ts).
 * It reads the ダチ messages of a member who is not recorded (dachi/cute-voice.service.ts). M-R342: it is no longer
 * {bati}'s voice (batiVoiceId below) — a constant of its own. Another voice = that one variable; null = no such voice here.
 */
export const defaultCuteVoiceId = (cfg: Partial<Pick<AppConfig, 'FISH_DEFAULT_VOICE_ID'>>): string | null => cfg.FISH_DEFAULT_VOICE_ID || null;

/** the two settings {bati}'s fixed voices come from */
export type BatiVoiceIds = Partial<Pick<AppConfig, 'FISH_BATI_MOON_VOICE_ID' | 'FISH_BATI_SUN_VOICE_ID'>>;

/**
 * {bati}'s voice (M-R342, client 2026-11-27): the FIXED Fish voice of the egg it was born from — ♀ Moon / ♂ Sun, the
 * server's FISH_BATI_MOON_VOICE_ID / FISH_BATI_SUN_VOICE_ID, else the shared constants (batiFixedVoice.ts). The same for
 * every member (recorded or not, under 13 too) and for the 2nd / 3rd {bati} (each its own egg's). No egg known (no
 * {bati} born yet): the Moon egg's. Never null: the voice exists whenever the voice service is connected.
 */
export const batiVoiceId = (cfg: BatiVoiceIds, egg?: BatiEggKind | null): string => batiFixedVoice(egg, { moon: cfg.FISH_BATI_MOON_VOICE_ID, sun: cfg.FISH_BATI_SUN_VOICE_ID });
