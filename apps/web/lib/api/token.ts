const KEY = 'obolo.token';

/** Session token (opaque, server-side session in Redis). localStorage keeps it working in PWA + future native shells. */
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(t: string) {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* private mode */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
