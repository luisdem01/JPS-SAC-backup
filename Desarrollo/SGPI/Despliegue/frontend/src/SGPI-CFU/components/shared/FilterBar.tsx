import React from 'react';
import { Input, Select, Button } from '../ui';

/**
 * @file FilterBar.tsx
 * @description Componente estándar para la barra de filtros del SGPI.
 * Recrea el cuadro de búsqueda y filtros para listas o tablas tipo CRUD.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cada filtro tipo Select necesita sus opciones.
 */
export interface FilterSelectOption {
  label: string;
  value: string;
}

export interface FilterSelectDef {
  /** Nombre del campo (name/id) */
  name:    string;
  /** Etiqueta superior (ej. "TIPO DE PRODUCCIÓN") */
  label:   string;
  /** Opciones disponibles */
  options: FilterSelectOption[];
  /** Valor actual seleccionado */
  value?:  string;
  /** Callback al cambiar el select */
  onChange?: (val: string) => void;
}

export interface FilterBarProps {
  /** Valor de búsqueda en texto libre */
  searchValue?: string;
  /** Callback al cambiar la búsqueda de texto */
  onSearchChange?: (val: string) => void;
  /** Placeholder para el input de búsqueda */
  searchPlaceholder?: string;

  /** Configuración de los selects que se muestran */
  selectFilters?: FilterSelectDef[];

  /** Callback al presionar "Filtrar" */
  onFilterSubmit?: () => void;

  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────

export function FilterBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'DOI, Título o Autor...',
  selectFilters = [],
  onFilterSubmit,
  className = '',
}: FilterBarProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterSubmit?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`
        flex items-end gap-3
        p-4 bg-white
        border border-[#e2e8f0] rounded
        ${className}
      `}
    >
      {/* ── 1. Buscador (Ocupa el espacio restante) ───────────────────────── */}
      <div className="flex-1 min-w-[200px]">
        <Input
          id="global-search"
          label="BUSCAR"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          iconLeft={<SearchIcon />}
        />
      </div>

      {/* ── 2. Filtros Select (Si los hay) ───────────────────────────────── */}
      {selectFilters.map((filter) => (
        <div key={filter.name} className="w-[180px] flex-shrink-0">
          <Select
            id={`filter-${filter.name}`}
            label={filter.label}
            value={filter.value}
            onChange={(e) => filter.onChange?.(e.target.value)}
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      ))}

      {/* ── 3. Botón de Acción ───────────────────────────────────────────── */}
      <div className="flex-shrink-0">
        <Button
          type="submit"
          variant="primary"
          iconLeft={<SearchIcon />}
        >
          Buscar
        </Button>
      </div>
    </form>
  );
}

export default FilterBar;
