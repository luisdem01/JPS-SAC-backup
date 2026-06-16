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
const MIN_QUERY_LENGTH = 3;

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
 */
export function useSearch() {
  // ──────────────────────────────────────────────────────────────────────────
  // Estado
  // ──────────────────────────────────────────────────────────────────────────

  const [query,      setQueryState]    = useState<string>('');
  const [types,      setTypesState]    = useState<SearchType[]>([]);
  const [page,       setPage]          = useState<number>(1);
  const [results,    setResults]       = useState<SearchResult[]>([]);
  const [counts,     setCounts]        = useState<Record<string, number> | undefined>(undefined);
  const [isLoading,  setIsLoading]     = useState<boolean>(false);
  const [error,      setError]         = useState<string | null>(null);

  // Filtros avanzados
  const [sources,    setSourcesState]  = useState<string[]>([]);
  const [statuses,   setStatusesState] = useState<string[]>([]);
  const [yearStart,  setYearStartState] = useState<number | undefined>(undefined);
  const [yearEnd,    setYearEndState]   = useState<number | undefined>(undefined);
  const [liveRenacyt, setLiveRenacyt]   = useState<boolean>(false);
  const [liveCybertesis, setLiveCybertesis] = useState<boolean>(false);

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
  // Ref para saltar el debounce en búsquedas explícitas (enter/submit)
  const skipNextDebounceRef = useRef<boolean>(false);

  // ──────────────────────────────────────────────────────────────────────────
  // Función de búsqueda
  // ──────────────────────────────────────────────────────────────────────────

  const performSearch = useCallback(async (
    searchQuery: string,
    searchTypes: SearchType[],
    searchPage:  number,
    searchSources: string[],
    searchStatuses: string[],
    searchYearStart: number | undefined,
    searchYearEnd: number | undefined,
    searchLiveRenacyt: boolean,
    searchLiveCybertesis?: boolean
  ) => {
    // Validar longitud mínima
    if (searchQuery.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setCounts(undefined);
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
    
    if (searchTypes && searchTypes.length > 0) {
      searchTypes.forEach(t => params.append('type', t));
    }
    
    // Filtros avanzados
    if (searchSources && searchSources.length > 0) {
      searchSources.forEach(src => params.append('source', src));
    }
    if (searchStatuses && searchStatuses.length > 0) {
      searchStatuses.forEach(st => params.append('status', st));
    }
    if (searchYearStart !== undefined) {
      params.append('anio_inicio', String(searchYearStart));
    }
    if (searchYearEnd !== undefined) {
      params.append('anio_fin', String(searchYearEnd));
    }
    if (searchLiveRenacyt) {
      params.append('live_renacyt', 'true');
    }
    if (searchLiveCybertesis) {
      params.append('live_cybertesis', 'true');
    }

    try {
      const data = await apiClient.get<PaginatedData<SearchResult> & { counts?: Record<string, number> }>(
        `/search?${params.toString()}`,
        { timeout: 30000 }
      );

      setResults(data.items);
      setCounts(data.counts);
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
      setCounts(undefined);
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
      setCounts(undefined);
      setIsLoading(false);
      setError(null);
      setPagination({
        page: 1, total: 0, pages: 1, limit: DEFAULT_LIMIT,
        hasNext: false, hasPrev: false,
      });
      setLiveRenacyt(false);
      setLiveCybertesis(false);
      return;
    }

    // Si se solicitó saltar el debounce (búsqueda explícita)
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;
      setLiveRenacyt(false);
      setLiveCybertesis(false);
      performSearch(query, types, page, sources, statuses, yearStart, yearEnd, false, false);
    } else {
      // Programar la búsqueda con debounce
      debounceTimerRef.current = setTimeout(() => {
        setLiveRenacyt(false);
        setLiveCybertesis(false);
        performSearch(query, types, page, sources, statuses, yearStart, yearEnd, false, false);
      }, DEBOUNCE_MS);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, types, page, sources, statuses, yearStart, yearEnd, performSearch]);

  // ──────────────────────────────────────────────────────────────────────────
  // Setters con reset de página
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Actualiza el término de búsqueda y resetea a la página 1.
   */
  const setQuery = useCallback((newQuery: string) => {
    skipNextDebounceRef.current = true;
    setQueryState(newQuery);
    setPage(1);
    if (newQuery.trim().length >= MIN_QUERY_LENGTH) {
      setResults([]);
      setIsLoading(true);
      setError(null);
    }
  }, []);

  /**
   * Actualiza el filtro de tipo de entidad y resetea a la página 1.
   */
  const setTypes = useCallback((newTypes: SearchType[]) => {
    setTypesState(newTypes);
    setPage(1);
    setResults([]);
    setIsLoading(true);
    setError(null);
  }, []);

  // Backwards compatibility for single type
  const type = types[0] || undefined;
  const setType = useCallback((newType: SearchType | undefined) => {
    setTypesState(newType ? [newType] : []);
    setPage(1);
    setResults([]);
    setIsLoading(true);
    setError(null);
  }, []);

  /**
   * Actualiza las fuentes y resetea a la página 1.
   */
  const setSources = useCallback((newSources: string[]) => {
    setSourcesState(newSources);
    setPage(1);
    setResults([]);
    setIsLoading(true);
    setError(null);
  }, []);

  /**
   * Actualiza los estados y resetea a la página 1.
   */
  const setStatuses = useCallback((newStatuses: string[]) => {
    setStatusesState(newStatuses);
    setPage(1);
    setResults([]);
    setIsLoading(true);
    setError(null);
  }, []);

  /**
   * Actualiza el año inicial y resetea a la página 1.
   */
  const setYearStart = useCallback((newYearStart: number | undefined) => {
    setYearStartState(newYearStart);
    setPage(1);
    setResults([]);
    setIsLoading(true);
    setError(null);
  }, []);

  /**
   * Actualiza el año final y resetea a la página 1.
   */
  const setYearEnd = useCallback((newYearEnd: number | undefined) => {
    setYearEndState(newYearEnd);
    setPage(1);
    setResults([]);
    setIsLoading(true);
    setError(null);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Navegación de páginas
  // ──────────────────────────────────────────────────────────────────────────

  /** Avanza a la siguiente página de resultados */
  const nextPage = useCallback(() => {
    if (pagination.hasNext) {
      setResults([]);
      setIsLoading(true);
      setError(null);
      setPage((p) => p + 1);
    }
  }, [pagination.hasNext]);

  /** Retrocede a la página anterior de resultados */
  const prevPage = useCallback(() => {
    if (pagination.hasPrev) {
      setResults([]);
      setIsLoading(true);
      setError(null);
      setPage((p) => p - 1);
    }
  }, [pagination.hasPrev]);

  /** Navega a una página específica */
  const goToPage = useCallback((targetPage: number) => {
    if (targetPage >= 1 && targetPage <= pagination.pages) {
      setResults([]);
      setIsLoading(true);
      setError(null);
      setPage(targetPage);
    }
  }, [pagination.pages]);

  // ──────────────────────────────────────────────────────────────────────────
  // Buscar en RENACYT (en vivo)
  // ──────────────────────────────────────────────────────────────────────────

  const triggerLiveRenacyt = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setLiveRenacyt(true);
    setLiveCybertesis(false);
    performSearch(query, types, page, sources, statuses, yearStart, yearEnd, true, false);
  }, [query, types, page, sources, statuses, yearStart, yearEnd, performSearch]);

  const triggerLiveCybertesis = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setLiveCybertesis(true);
    setLiveRenacyt(false);
    performSearch(query, types, page, sources, statuses, yearStart, yearEnd, false, true);
  }, [query, types, page, sources, statuses, yearStart, yearEnd, performSearch]);

  // ──────────────────────────────────────────────────────────────────────────
  // Limpiar búsqueda
  // ──────────────────────────────────────────────────────────────────────────

  /** Limpia completamente el estado de búsqueda */
  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current)    clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current)  abortControllerRef.current.abort();

    setQueryState('');
    setTypesState([]);
    setSourcesState([]);
    setStatusesState([]);
    setYearStartState(undefined);
    setYearEndState(undefined);
    setLiveRenacyt(false);
    setLiveCybertesis(false);
    setPage(1);
    setResults([]);
    setCounts(undefined);
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
    types,
    results,
    counts,
    isLoading,
    error,
    pagination,
    isEmpty,
    isBlank,
    liveRenacyt,
    liveCybertesis,

    // Filtros
    sources,
    statuses,
    yearStart,
    yearEnd,

    // Setters
    setQuery,
    setType,
    setTypes,
    setSources,
    setStatuses,
    setYearStart,
    setYearEnd,

    // Navegación
    nextPage,
    prevPage,
    goToPage,
    clearSearch,
    triggerLiveRenacyt,
    triggerLiveCybertesis,
  };
}
