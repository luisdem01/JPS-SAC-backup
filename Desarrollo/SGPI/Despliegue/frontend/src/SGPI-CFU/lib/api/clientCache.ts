/**
 * @file clientCache.ts
 * @description Gestor de caché en memoria del lado del cliente para peticiones HTTP.
 */

type CacheEntry = {
  data: any;
  timestamp: number;
};

const cacheMap = new Map<string, CacheEntry>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos por defecto

export const clientCache = {
  /**
   * Obtiene un elemento de la caché si no ha expirado.
   */
  get(key: string, ttl: number = DEFAULT_TTL): any | null {
    const entry = cacheMap.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now - entry.timestamp > ttl) {
      cacheMap.delete(key);
      return null;
    }
    return entry.data;
  },

  /**
   * Guarda un elemento en la caché con el timestamp actual.
   */
  set(key: string, data: any): void {
    cacheMap.set(key, { data, timestamp: Date.now() });
  },

  /**
   * Invalida una clave específica.
   */
  invalidate(key: string): void {
    cacheMap.delete(key);
  },

  invalidatePrefix(prefix: string): void {
    cacheMap.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        cacheMap.delete(key);
      }
    });
  },

  /**
   * Limpia toda la caché del cliente.
   */
  clear(): void {
    cacheMap.clear();
  }
};
