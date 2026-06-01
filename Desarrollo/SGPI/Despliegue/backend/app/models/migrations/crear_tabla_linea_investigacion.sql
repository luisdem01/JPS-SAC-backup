-- Migración: Crear tabla de líneas de investigación e incorporar columna de estado a departamentos académicos

-- 1. Crear tabla linea_investigacion
CREATE TABLE IF NOT EXISTS linea_investigacion (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'Aprobado', -- 'Aprobado' o 'Pendiente'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Insertar valores semilla en linea_investigacion (desde configuracion_global)
INSERT INTO linea_investigacion (nombre, estado) VALUES
('L1. Inteligencia Artificial y Aprendizaje Automático', 'Aprobado'),
('L2. Ciberseguridad y Criptografía Aplicada', 'Aprobado'),
('L3. Sistemas Distribuidos y Computación en la Nube', 'Aprobado'),
('L4. Ingeniería de Software y Metodologías Ágiles', 'Aprobado'),
('L5. Procesamiento de Lenguaje Natural', 'Aprobado'),
('L6. Ciencia de Datos y Big Data', 'Aprobado'),
('L7. Internet de las Cosas y Redes de Sensores', 'Aprobado'),
('L8. Computación Gráfica y Realidad Virtual', 'Aprobado')
ON CONFLICT (nombre) DO NOTHING;

-- 3. Incorporar columna 'estado' a departamento_academico si no existe
ALTER TABLE departamento_academico ADD COLUMN IF NOT EXISTS estado VARCHAR(30) NOT NULL DEFAULT 'Aprobado';
