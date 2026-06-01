-- ====================================================================================
-- MIGRACIÓN DE BASE DE DATOS: Optimización de Búsqueda Local en Base de Datos (Mejora 3)
-- ====================================================================================

-- 1. Habilitar la extensión pg_trgm para soporte de índices de trigramas
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Crear índice GIN en la columna nombres de la tabla investigador
CREATE INDEX IF NOT EXISTS idx_investigador_nombres_trgm 
ON public.investigador USING gin (nombres gin_trgm_ops);

-- 3. Crear índice GIN en la columna apellidos de la tabla investigador
CREATE INDEX IF NOT EXISTS idx_investigador_apellidos_trgm 
ON public.investigador USING gin (apellidos gin_trgm_ops);
