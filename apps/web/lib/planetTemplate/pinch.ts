/**
 * Two-finger pinch (handoff 06 §1, M-R295): on the home, fingers closing to 0.72× of where they started goes up to the
 * sky; on the sky, opening to 1.35× comes home; on a continent, closing goes back up to the sky. A trackpad pinch on a
 * computer arrives as ctrl + wheel. Pure (pinch.test.ts): the screens feed pointer events in and act on what comes out.
 *
 * Drag and pinch never fight: while two fingers are down `count` is 2 and the screens let go of a drag (the pinch
 * wins); a pinch fires once per gesture (fingers lifted and put down again for the next).
 */
export const PINCH_IN = 0.72;
export const PINCH_OUT = 1.35;
export type Pinch = 'in' | 'out';
export const pinchOf = (ratio: number): Pinch | null => (ratio < PINCH_IN ? 'in' : ratio > PINCH_OUT ? 'out' : null);

export class PinchTracker {
  private pts = new Map<number, { x: number; y: number }>();
  private d0 = 0;
  private fired = false;

  /** how many fingers are down (2 or more: a pinch, no drag) */
  get count(): number {
    return this.pts.size;
  }

  private dist(): number {
    const a = [...this.pts.values()];
    return a.length === 2 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0;
  }

  down(id: number, x: number, y: number): void {
    this.pts.set(id, { x, y });
    if (this.pts.size === 2) {
      this.d0 = this.dist();
      this.fired = false;
    } else if (this.pts.size > 2) this.d0 = 0;
  }

  /** a finger moved: 'in' / 'out' once when the two fingers have closed / opened far enough */
  move(id: number, x: number, y: number): Pinch | null {
    if (!this.pts.has(id)) return null;
    this.pts.set(id, { x, y });
    if (this.pts.size !== 2 || this.fired || this.d0 < 8) return null;
    const k = pinchOf(this.dist() / this.d0);
    if (k) this.fired = true;
    return k;
  }

  up(id: number): void {
    this.pts.delete(id);
    if (this.pts.size < 2) this.d0 = 0;
  }

  reset(): void {
    this.pts.clear();
    this.d0 = 0;
    this.fired = false;
  }
}

/** a trackpad's pinch (ctrl + wheel) sends many events: one pinch per gesture, then a short rest */
export const WHEEL_REST_MS = 700;
export class WheelPinch {
  private last = -Infinity;
  /** deltaY > 0 is the fingers closing (zoom out): 'in'; < 0 opening: 'out' */
  of(e: { ctrlKey: boolean; deltaY: number }, now: number): Pinch | null {
    if (!e.ctrlKey || Math.abs(e.deltaY) <= 4) return null;
    if (now - this.last < WHEEL_REST_MS) {
      this.last = now;
      return null;
    }
    this.last = now;
    return e.deltaY > 0 ? 'in' : 'out';
  }
}
