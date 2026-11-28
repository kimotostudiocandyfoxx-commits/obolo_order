import { describe, expect, it, vi } from 'vitest';
import { PINCH_IN, PINCH_OUT, PinchTracker, pinchOf, WHEEL_REST_MS, WheelPinch } from './pinch';

describe('two-finger pinch (06 §1)', () => {
  it('closing to 0.72× is in, opening to 1.35× is out, between is nothing', () => {
    expect(PINCH_IN).toBe(0.72);
    expect(PINCH_OUT).toBe(1.35);
    expect(pinchOf(0.7)).toBe('in');
    expect(pinchOf(0.8)).toBeNull();
    expect(pinchOf(1.3)).toBeNull();
    expect(pinchOf(1.4)).toBe('out');
  });

  it('two fingers closing fire "in" once per gesture', () => {
    const p = new PinchTracker();
    p.down(1, 100, 400);
    p.down(2, 300, 400);
    expect(p.count).toBe(2);
    expect(p.move(2, 260, 400)).toBeNull(); // 0.8×
    expect(p.move(2, 230, 400)).toBe('in'); // 0.65×
    expect(p.move(2, 150, 400)).toBeNull(); // fired already
    p.up(2);
    p.down(2, 300, 400);
    // a new gesture (the second finger put down again): it may fire again
    expect(p.move(2, 400, 400)).toBe('out'); // 300 / 200
  });

  it('opening fires "out"; both fingers moving count', () => {
    const p = new PinchTracker();
    p.down(1, 150, 400);
    p.down(2, 250, 400); // 100 apart
    expect(p.move(1, 120, 400)).toBeNull(); // 130
    expect(p.move(2, 290, 400)).toBe('out'); // 170
  });

  it('one finger is never a pinch (a drag); a third finger stops the gesture', () => {
    const p = new PinchTracker();
    p.down(1, 100, 100);
    expect(p.move(1, 10, 10)).toBeNull();
    p.down(2, 300, 100);
    p.down(3, 200, 300);
    expect(p.count).toBe(3);
    expect(p.move(2, 110, 100)).toBeNull();
  });

  it('a finger that was never down is ignored; lifting one ends the pinch (the drag may go on)', () => {
    const p = new PinchTracker();
    expect(p.move(9, 0, 0)).toBeNull();
    p.down(1, 100, 100);
    p.down(2, 300, 100);
    p.up(1);
    expect(p.count).toBe(1);
    expect(p.move(2, 101, 100)).toBeNull();
  });

  it('fingers put down on the same spot do not divide by nothing', () => {
    const p = new PinchTracker();
    p.down(1, 100, 100);
    p.down(2, 101, 100);
    expect(p.move(2, 300, 100)).toBeNull();
  });
});

describe('a trackpad pinch (ctrl + wheel)', () => {
  it('ctrl + wheel down is in, up is out; plain scrolling is nothing', () => {
    const w = new WheelPinch();
    expect(w.of({ ctrlKey: false, deltaY: 40 }, 0)).toBeNull();
    expect(w.of({ ctrlKey: true, deltaY: 2 }, 0)).toBeNull();
    expect(w.of({ ctrlKey: true, deltaY: 20 }, 0)).toBe('in');
  });
  it('one pinch per gesture: the stream of events after it rests, then the next fires', () => {
    const w = new WheelPinch();
    expect(w.of({ ctrlKey: true, deltaY: -20 }, 1000)).toBe('out');
    expect(w.of({ ctrlKey: true, deltaY: -20 }, 1100)).toBeNull();
    expect(w.of({ ctrlKey: true, deltaY: -20 }, 1600)).toBeNull();
    expect(w.of({ ctrlKey: true, deltaY: 20 }, 1600 + WHEEL_REST_MS + 1)).toBe('in');
  });
});

describe('M-R344: a profile always lets you back', () => {
  it('two fingers closing on a profile go back to the home — on every planet, sky or not; on the home they go up to the sky', async () => {
    const { pinchGoes } = await import('./pinch');
    expect(pinchGoes('in', { profile: true, sky: false, skyOn: true })).toBe('home');
    expect(pinchGoes('in', { profile: true, sky: false, skyOn: false })).toBe('home');
    expect(pinchGoes('in', { profile: false, sky: false, skyOn: true })).toBe('sky');
    expect(pinchGoes('in', { profile: false, sky: false, skyOn: false })).toBeNull();
    // the sky listens for itself; opening fingers and no pinch do nothing here
    expect(pinchGoes('in', { profile: false, sky: true, skyOn: true })).toBeNull();
    expect(pinchGoes('out', { profile: true, sky: false, skyOn: true })).toBeNull();
    expect(pinchGoes(null, { profile: true, sky: false, skyOn: true })).toBeNull();
  });
  it('the click that follows the first touch on 〔←〕 is swallowed once, and only for a moment', async () => {
    const { swallowNextClick } = await import('./pinch');
    vi.useFakeTimers();
    const ls = new Set<(e: Event) => void>();
    const target = { addEventListener: (_t: string, f: unknown) => void ls.add(f as (e: Event) => void), removeEventListener: (_t: string, f: unknown) => void ls.delete(f as (e: Event) => void) } as unknown as Window;
    swallowNextClick(600, target);
    expect(ls.size).toBe(1);
    const e = { stopPropagation: vi.fn(), preventDefault: vi.fn() };
    [...ls][0](e as unknown as Event);
    expect(e.stopPropagation).toHaveBeenCalledOnce();
    expect(ls.size).toBe(0);
    swallowNextClick(600, target);
    vi.advanceTimersByTime(601);
    expect(ls.size).toBe(0);
    vi.useRealTimers();
  });
});
