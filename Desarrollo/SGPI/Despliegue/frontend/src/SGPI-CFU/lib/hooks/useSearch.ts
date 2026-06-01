'use client';

/**
 * @file useSearch.ts
 * @description Hook de búsqueda global del SGPI con debounce y paginación integrada.
 *
 * Características:
 * - Debounce de 400ms para evitar llamadas excesivas al backend
 * - Paginación integrada con controles de navegación
 * - Filtros combinables por tipo de entidad
 * - Estado de búsqueda vacía, carga y sin resultados
 * - Cancela peticiones anteriores al escribir nueva búsqueda
 *
 * @example
 * const { query, setQuery, results, isLoading, pagination, setType } = useSearch();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SearchResult, SearchType, PaginatedData } from '../types';
import { apiClient }                                    from '../api/client';
import { ApiClientError }                               from '../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** Debounce en milisegundos antes de enviar la búsqueda al backend */
const DEBOUNCE_MS = 400;

/** Longitud mínima del término de búsqueda para disparar la petición */
const MIN_QUERY_LENGTH = 2;

/** Número de resultados por página */
const DEFAULT_LIMIT = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Estado de paginación de los resultados */
export interface SearchPagination {
  /** Página actual */
  page:      number;
  /** Total de resultados */
  total:     number;
  /** Total de páginas */
  pages:     number;
  /** Resultados por página */
  limit:     number;
  /** Si hay página siguiente */
  hasNext:   boolean;
  /** Si hay página anterior */
  hasPrev:   boolean;
}

/** Estado completo del hook useSearch */
export interface SearchState {
  /** Término de búsqueda actual */
  query:      string;
  /** Tipo de entidad filtrada (undefined = todos) */
  type:       SearchType | undefined;
  /** Resultados de la búsqueda */
  results:    SearchResult[];
  /** true mientras se está buscando */
  isLoading:  boolean;
  /** Mensaje de error si la búsqueda falló */
  error:      string | null;
  /** Datos de paginación */
  pagination: SearchPagination;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook de búsqueda global del SGPI.
 *
 * @example
 * const { query, setQuery, results, isLoading, error, pagination, nextPage, type, setType } = useSearch();
 *
 * return (
 *   <>
 *     <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *     {results.map(r => <SearchResultItem key={r.id} result={r} />)}
 *     <button onClick={pagination.hasPrev ? prevPage : undefined}>Anterior</button>
 *     <button onClick={pagination.hasNext ? nextPage : undefined}>Siguiente</button>
 *   </>
 * );
 */
export function useSearch() {
  // ──────────────────────────────────────────────────────────────────────────
  // Estado
  // ──────────────────────────────────────────────────────────────────────────

  const [query,     setQueryState] = useState<string>('');
  const [type,      setTypeState]  = useState<SearchType | undefined>(undefined);
  const [page,      setPage]       = useState<number>(1);
  const [results,   setResults]    = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading]  = useState<boolean>(false);
  const [error,     setError]      = useState<string | null>(null);
  const [pagination, setPagination] = useState<SearchPagination>({
    page:    1,
    total:   0,
    pages:   1,
    limit:   DEFAULT_LIMIT,
    hasNext: false,
    hasPrev: false,
  });

  // Ref para el timer de debounce
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref para el AbortController de la petición en curso
  const abortControllerRef = useRef<AbortController | null>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // Función de búsqueda
  // ──────────────────────────────────────────────────────────────────────────

  const performSearch = useCallback(async (
    searchQuery: string,
    searchType:  SearchType | undefined,
    searchPage:  number
  ) => {
    // Validar longitud mínima
    if (searchQuery.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsLoading(false);
      setPagination({
        page: 1, total: 0, pages: 1, limit: DEFAULT_LIMIT,
        hasNext: false, hasPrev: false,
      });
      return;
    }

    // Cancelar petición anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    // Construir query string
    const params = new URLSearchParams({
      q:     searchQuery.trim(),
      page:  String(searchPage),
      limit: String(DEFAULT_LIMIT),
    });
    if (searchType) params.append('type', searchType);

    try {
      const data = await apiClient.get<PaginatedData<SearchResult>>(
        `/search?${params.toString()}`
      );

      setResults(data.items);
      setPagination({
        page:    data.page,
        total:   data.total,
        pages:   data.pages,
        limit:   data.limit,
        hasNext: data.page < data.pages,
        hasPrev: data.page > 1,
      });

    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Petición cancelada → no es un error real
        return;
      }

      const message = err instanceof ApiClientError
        ? err.message
        : 'Error al realizar la búsqueda. Intente nuevamente.';

      setError(message);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Efecto: debounce para la búsqueda
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Limpiar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Si el query está vacío, limpiar resultados inmediatamente
    if (!query.trim() || query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      setPagination({
        page: 1, total: 0, pages: 1, limit: DEFAULT_LIMIT,
        hasNext: false, hasPrev: false,
      });
      return;
    }

    // Programar la búsqueda con debounce
    debounceTimerRef.current = setTimeout(() => {
      performSearch(query, type, page);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, type, page, performSearch]);

  // ──────────────────────────────────────────────────────────────────────────
  // Setters con reset de página
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Actualiza el término de búsqueda y resetea a la página 1.
   */
  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    setPage(1); // Resetear a la primera página al cambiar el query
  }, []);

  /**
   * Actualiza el filtro de tipo de entidad y resetea a la página 1.
   */
  const setType = useCallback((newType: SearchType | undefined) => {
    setTypeState(newType);
    setPage(1); // Resetear a la primera página al cambiar el filtro
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Navegación de páginas
  // ──────────────────────────────────────────────────────────────────────────

  /** Avanza a la siguiente página de resultados */
  const nextPage = useCallback(() => {
    if (pagination.hasNext) setPage((p) => p + 1);
  }, [pagination.hasNext]);

  /** Retrocede a la página anterior de resultados */
  const prevPage = useCallback(() => {
    if (pagination.hasPrev) setPage((p) => p - 1);
  }, [pagination.hasPrev]);

  /** Navega a una página específica */
  const goToPage = useCallback((targetPage: number) => {
    if (targetPage >= 1 && targetPage <= pagination.pages) {
      setPage(targetPage);
    }
  }, [pagination.pages]);

  // ──────────────────────────────────────────────────────────────────────────
  // Limpiar búsqueda
  // ──────────────────────────────────────────────────────────────────────────

  /** Limpia completamente el estado de búsqueda */
  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current)    clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current)  abortControllerRef.current.abort();

    setQueryState('');
    setTypeState(undefined);
    setPage(1);
    setResults([]);
    setIsLoading(false);
    setError(null);
    setPagination({
      page: 1, total: 0, pages: 1, limit: DEFAULT_LIMIT,
      hasNext: false, hasPrev: false,
    });
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Estado derivado
  // ──────────────────────────────────────────────────────────────────────────

  /** true cuando hay un query válido pero no hay resultados */
  const isEmpty = !isLoading && query.trim().length >= MIN_QUERY_LENGTH && results.length === 0 && !error;

  /** true cuando la búsqueda está vacía (sin query) */
  const isBlank = query.trim().length < MIN_QUERY_LENGTH;

  return {
    // Estado
    query,
    type,
    results,
    isLoading,
    error,
    pagination,
    isEmpty,
    isBlank,

    // Setters
    setQuery,
    setType,

    // Navegación
    nextPage,
    prevPage,
    goToPage,
    clearSearch,
  };
}
