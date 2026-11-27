/**
 * Postgres adapter of the cascade's CacheStore: food_cache is reached only through the
 * cache_get / cache_put SECURITY DEFINER functions (the API role has no table access).
 * Each call is its own short transaction, so no connection is held while a provider
 * is being fetched.
 */
import type { Db } from '../db';
import type { CacheSource, CacheStore } from './cascade';

export function dbCacheStore(db: Db, userId: string): CacheStore {
  return {
    async get(key: string): Promise<unknown | null> {
      const rows = await db.withUser(userId, (query) =>
        query<{ payload: unknown }>('SELECT public.cache_get($1) AS payload', [key]),
      );
      return rows[0]?.payload ?? null;
    },
    async put(key: string, source: CacheSource, payload: unknown, ttlMs: number): Promise<void> {
      await db.withUser(userId, (query) =>
        query('SELECT public.cache_put($1, $2, $3::jsonb, $4::integer)', [
          key,
          source,
          payload, // postgres.js serialises jsonb parameters itself
          Math.round(ttlMs / 1000),
        ]),
      );
    },
  };
}
