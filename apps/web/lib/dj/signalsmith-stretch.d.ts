// signalsmith-stretch (MIT) ships no types: the parts the DJ engine uses (its README).
declare module 'signalsmith-stretch' {
  export interface StretchSchedule {
    output?: number;
    active?: boolean;
    input?: number;
    rate?: number;
    semitones?: number;
    tonalityHz?: number;
    formantSemitones?: number;
    formantCompensation?: boolean;
    loopStart?: number;
    loopEnd?: number;
  }
  export interface StretchNode extends AudioWorkletNode {
    inputTime: number;
    schedule(s: StretchSchedule): Promise<void>;
    start(when?: number): Promise<void>;
    stop(when?: number): Promise<void>;
    addBuffers(channels: Float32Array[]): Promise<number>;
    dropBuffers(toSeconds?: number): Promise<unknown>;
    latency(): Promise<number>;
    configure(c: { blockMs?: number | null; intervalMs?: number; splitComputation?: boolean; preset?: 'default' | 'cheaper' }): Promise<void>;
    setUpdateInterval(seconds: number, callback?: (inputTime: number) => void): Promise<void>;
  }
  export default function SignalsmithStretch(ctx: BaseAudioContext, options?: AudioWorkletNodeOptions): Promise<StretchNode>;
}
