import { emitStorageChange } from '../utils';

const COLLECTION_KEYS = ['events', 'expenses', 'dailyTemplates', 'meetings', 'memos'];
const ARRAY_KEYS = ['accounts', 'quickTitles'];
const MAX_COLLECTION_ITEMS = 5000;
const MIN_SANITIZE_INTERVAL_MS = 1000 * 60 * 10;

function safeParse(raw, fallback) {
  try {
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function stableStringify(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
}

function uniqueStrings(input) {
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set();
  const out = [];

  for (let i = 0; i < arr.length; i += 1) {
    const value = arr[i];
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function normalizeCollectionItems(input) {
  const arr = Array.isArray(input) ? input : [];
  const map = new Map();

  for (let i = 0; i < arr.length; i += 1) {
    const item = arr[i];
    if (!item || typeof item !== 'object') continue;
    if (!item.id) continue;
    map.set(item.id, item);
  }

  const result = Array.from(map.values());
  if (result.length <= MAX_COLLECTION_ITEMS) return result;

  return result
    .sort((a, b) => new Date(b.createdAt || b.date || b.startDate || 0).getTime() - new Date(a.createdAt || a.date || a.startDate || 0).getTime())
    .slice(0, MAX_COLLECTION_ITEMS);
}

function normalizeDailyCompletionMap(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const entries = Object.entries(input);
  const normalized = {};

  for (let i = 0; i < entries.length; i += 1) {
    const [key, value] = entries[i];
    if (!key) continue;
    normalized[key] = Boolean(value);
  }

  return normalized;
}

function normalizeCurrentUser(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  return {
    ...input,
    name: typeof input.name === 'string' ? input.name : (typeof input.displayName === 'string' ? input.displayName : '사용자'),
    email: typeof input.email === 'string' ? input.email : '',
  };
}

class AppStabilityAgent {
  constructor() {
    this.intervalId = null;
    this.visibilityHandler = null;
    this.idleId = null;
    this.errorTimestamps = [];
    this.runtimeCleanup = null;
    this.lastSanitizedAt = 0;
  }

  writeIfChanged(key, nextValue) {
    const prevValue = safeParse(window.localStorage.getItem(key), null);
    const prevHash = stableStringify(prevValue);
    const nextHash = stableStringify(nextValue);
    if (prevHash === nextHash) return false;

    window.localStorage.setItem(key, nextHash);
    emitStorageChange(key, nextValue);
    return true;
  }

  sanitizeAllStorage(force = false) {
    if (typeof window === 'undefined') return { changed: 0 };

    const now = Date.now();
    if (!force && now - this.lastSanitizedAt < MIN_SANITIZE_INTERVAL_MS) {
      return { changed: 0, skipped: true };
    }
    this.lastSanitizedAt = now;

    let changed = 0;

    if (window.localStorage.getItem('notificationSettings') != null) {
      window.localStorage.removeItem('notificationSettings');
      changed += 1;
    }

    COLLECTION_KEYS.forEach((key) => {
      const parsed = safeParse(window.localStorage.getItem(key), []);
      const normalized = normalizeCollectionItems(parsed);
      if (this.writeIfChanged(key, normalized)) changed += 1;
    });

    ARRAY_KEYS.forEach((key) => {
      const parsed = safeParse(window.localStorage.getItem(key), []);
      const normalized = uniqueStrings(parsed);
      if (this.writeIfChanged(key, normalized)) changed += 1;
    });

    const dailyMap = normalizeDailyCompletionMap(safeParse(window.localStorage.getItem('dailyCompletionMap'), {}));
    if (this.writeIfChanged('dailyCompletionMap', dailyMap)) changed += 1;

    const user = normalizeCurrentUser(safeParse(window.localStorage.getItem('currentUser'), null));
    if (this.writeIfChanged('currentUser', user)) changed += 1;

    return { changed };
  }

  scheduleIdleSanitize() {
    if (typeof window === 'undefined') return;

    const run = () => {
      this.sanitizeAllStorage();
    };

    if ('requestIdleCallback' in window) {
      this.idleId = window.requestIdleCallback(run, { timeout: 1500 });
      return;
    }

    window.setTimeout(run, 400);
  }

  startBackgroundMaintenance() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

    this.stopBackgroundMaintenance();
    this.scheduleIdleSanitize();

    this.intervalId = window.setInterval(() => {
      if (document.hidden) return;
      this.scheduleIdleSanitize();
    }, 1000 * 60 * 15);

    this.visibilityHandler = () => {
      if (!document.hidden) this.scheduleIdleSanitize();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    return () => this.stopBackgroundMaintenance();
  }

  stopBackgroundMaintenance() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.idleId && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(this.idleId);
      this.idleId = null;
    }
  }

  setupRuntimeGuards(onRecover) {
    if (typeof window === 'undefined') return () => {};

    if (this.runtimeCleanup) this.runtimeCleanup();

    const onError = () => {
      const now = Date.now();
      this.errorTimestamps = this.errorTimestamps.filter((ts) => now - ts < 20000);
      this.errorTimestamps.push(now);

      if (this.errorTimestamps.length >= 3) {
        this.errorTimestamps = [];
        this.sanitizeAllStorage(true);
        if (typeof onRecover === 'function') onRecover();
      }
    };

    const onUnhandledRejection = () => onError();

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    const cleanup = () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };

    this.runtimeCleanup = cleanup;
    return cleanup;
  }
}

export const appStabilityAgent = new AppStabilityAgent();
export default AppStabilityAgent;
