import { kv } from "@vercel/kv";

const DEFAULT_TTL = 86400; // 24 hours in seconds

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return await kv.get<T>(key);
  } catch {
    // Graceful degradation if KV is unavailable (e.g. local dev without env vars)
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL
): Promise<void> {
  try {
    await kv.set(key, value, { ex: ttlSeconds });
  } catch {
    // Graceful degradation
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await kv.del(key);
  } catch {
    // Graceful degradation
  }
}
