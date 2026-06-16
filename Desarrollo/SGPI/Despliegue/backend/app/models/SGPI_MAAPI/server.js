// server.js
// Servidor Express principal del SGPI
// Ejecutar con: node server.js

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './api/auth/auth.routes.js'

const app = express()
const PORT = process.env.PORT ?? 3000

// ── Middlewares globales ──────────────────────────────────────
app.use(cors({
  origin:       process.env.FRONTEND_URL ?? 'http://localhost:3001',
  methods:      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json())

// ── Health check ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    sistema: 'SGPI — Sistema de Gestión de Proyectos de Investigación',
    version: '1.0.0',
    estado: 'operativo',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET  /api/auth/me  (requiere Bearer Token)',
      },
    },
  })
})

// ── Rutas de la API ───────────────────────────────────────────
app.use('/api/auth', authRoutes)

// ── Manejo de rutas no encontradas ────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.method} ${req.path}`,
  })
})

// ── Manejo global de errores ──────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Error no controlado:', err)
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor.',
  })
})

// ── Inicio del servidor ───────────────────────────────────────
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   SGPI — API de Autenticación                        ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`\nServidor corriendo en  http://localhost:${PORT}`)
  console.log(`\nEndpoints disponibles:`)
  console.log(`   POST http://localhost:${PORT}/api/auth/register`)
  console.log(`   POST http://localhost:${PORT}/api/auth/login`)
  console.log(`   GET  http://localhost:${PORT}/api/auth/me`)
  console.log('\n─────────────────────────────────────────────────────')
})
