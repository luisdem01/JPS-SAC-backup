-- 0. Habilitar extensión unaccent para búsquedas insensibles a tildes
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. Indexación de claves foráneas no indexadas (Reportado por el Supabase Performance Linter)
CREATE INDEX IF NOT EXISTS idx_publicacion_id_grupo ON public.publicacion(id_grupo);
CREATE INDEX IF NOT EXISTS idx_investigador_proyecto_dni_investigador ON public.investigador_proyecto(dni_investigador);
CREATE INDEX IF NOT EXISTS idx_entregable_codigo_proyecto ON public.entregable(codigo_proyecto);
CREATE INDEX IF NOT EXISTS idx_estudiante_proyecto_codigo_proyecto ON public.estudiante_proyecto(codigo_proyecto);
CREATE INDEX IF NOT EXISTS idx_evidencia_difusion_id_convocatoria ON public.evidencia_difusion(id_convocatoria);
CREATE INDEX IF NOT EXISTS idx_evidencia_difusion_id_usuario_carga ON public.evidencia_difusion(id_usuario_carga);
CREATE INDEX IF NOT EXISTS idx_grupo_investigacion_dni_coordinador ON public.grupo_investigacion(dni_coordinador);
CREATE INDEX IF NOT EXISTS idx_investigador_publicacion_id_publicacion ON public.investigador_publicacion(id_publicacion);
CREATE INDEX IF NOT EXISTS idx_proyecto_estado_historial_codigo_proyecto ON public.proyecto_estado_historial(codigo_proyecto);
CREATE INDEX IF NOT EXISTS idx_proyecto_estado_historial_id_usuario_responsable ON public.proyecto_estado_historial(id_usuario_responsable);
CREATE INDEX IF NOT EXISTS idx_reconciliacion_pendientes_id_usuario_revisor ON public.reconciliacion_pendientes(id_usuario_revisor);
CREATE INDEX IF NOT EXISTS idx_snapshot_poi_id_usuario_emisor ON public.snapshot_poi(id_usuario_emisor);

-- 2. Optimización de RLS (Evitar reevaluación por fila de auth.uid() en tabla usuario)
DROP POLICY IF EXISTS usuario_select ON public.usuario;
CREATE POLICY usuario_select ON public.usuario
FOR SELECT
TO authenticated
USING (
  ((get_auth_role() = ANY (ARRAY['Administrador'::text, 'Secretaria'::text, 'Jefe'::text])) OR (id_usuario = (SELECT auth.uid())))
);
