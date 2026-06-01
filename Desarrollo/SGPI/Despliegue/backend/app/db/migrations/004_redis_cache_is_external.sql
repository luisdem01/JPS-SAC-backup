-- ====================================================================================
-- MIGRACIÓN DE BASE DE DATOS: Soporte para Investigadores Externos en Base de Datos (Mejora 4)
-- ====================================================================================

-- 1. Agregar columna is_external en la tabla investigador (si no existe)
ALTER TABLE public.investigador ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT FALSE;
