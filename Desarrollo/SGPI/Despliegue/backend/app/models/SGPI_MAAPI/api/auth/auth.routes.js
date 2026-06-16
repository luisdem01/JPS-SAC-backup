// api/auth/auth.routes.js
// Router de autenticación del SGPI
// Endpoints:
//   POST /api/auth/register  → Registro de nuevo usuario
//   POST /api/auth/login     → Inicio de sesión
//   GET  /api/auth/me        → Perfil del usuario autenticado

import { Router }      from 'express'
import { createClient } from '@supabase/supabase-js'
import { supabase }    from '../../supabase/client.js'
import { supabaseAdmin } from '../../supabase/admin.js'
import { requireAuth }  from '../middleware/auth.middleware.js'

const router = Router()

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Registra un nuevo usuario en Supabase Auth.
// La tabla pública `usuario` se populará automáticamente via Trigger en la BD.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password } = req.body

  // Validación básica de entrada
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Los campos email y password son obligatorios.',
    })
  }

  // Política de seguridad: mínimo 8 caracteres y al menos un número
  const passwordValido = /^(?=.*[0-9]).{8,}$/.test(password)
  if (!passwordValido) {
    return res.status(400).json({
      success: false,
      error: 'La contraseña debe tener al menos 8 caracteres e incluir un número.',
    })
  }

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    // Supabase devuelve este mensaje cuando el email ya está registrado
    const yaExiste = error.message?.toLowerCase().includes('already registered')
    return res.status(yaExiste ? 409 : 400).json({
      success: false,
      error: yaExiste
        ? 'El correo electrónico ya está registrado en el sistema.'
        : error.message,
    })
  }

  // Si la confirmación de email está habilitada, data.session será null
  const confirmacionPendiente = !data.session

  return res.status(201).json({
    success: true,
    message: confirmacionPendiente
      ? 'Registro exitoso. Revisa tu correo electrónico para confirmar tu cuenta.'
      : 'Registro exitoso. Ya puedes iniciar sesión.',
    usuario: {
      id: data.user?.id,
      email: data.user?.email,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Inicia sesión y devuelve el access_token, refresh_token e ID del usuario.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Los campos email y password son obligatorios.',
    })
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const credencialesInvalidas = error.message?.toLowerCase().includes('invalid login')
    return res.status(credencialesInvalidas ? 401 : 400).json({
      success: false,
      error: credencialesInvalidas
        ? 'Credenciales incorrectas. Verifica tu email y contraseña.'
        : error.message,
    })
  }

  // Obtener rol_sistema en el mismo login para evitar llamada extra al frontend
  const { data: perfil } = await supabaseAdmin
    .from('usuario')
    .select('rol_sistema, correo_institucional')
    .eq('id_usuario', data.user.id)
    .maybeSingle()

  const rolSistema = perfil?.rol_sistema ?? 'Consulta'

  // Sincronizar el rol en app_metadata del JWT para que RLS lo lea sin query a BD
  await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { rol_sistema: rolSistema },
  })

  return res.status(200).json({
    success: true,
    message: 'Inicio de sesión exitoso.',
    auth: {
      access_token:  data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in:    data.session.expires_in,
      token_type:    'Bearer',
    },
    usuario: {
      id:                   data.user.id,
      email:                data.user.email,
      rol_sistema:          rolSistema,
      correo_institucional: perfil?.correo_institucional ?? null,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Devuelve los datos del usuario autenticado desde la tabla pública `usuario`.
// Nota: Los investigadores son entidades externas sin cuenta de usuario;
//       la relación id_usuario ↔ investigador fue eliminada del esquema.
// Requiere: Authorization: Bearer <access_token>
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  const { id: userId, email } = req.user

  // Cliente autenticado con el JWT del usuario — respeta RLS sin bypassearla
  // supabaseAdmin se reserva para operaciones que explícitamente requieren service_role
  const supabaseUser = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${req.token}` } } }
  )

  const { data: perfil, error: perfilError } = await supabaseUser
    .from('usuario')
    .select('id_usuario, correo_institucional, rol_sistema, created_at')
    .eq('id_usuario', userId)
    .maybeSingle()

  if (perfilError) {
    return res.status(500).json({
      success: false,
      error: 'Error al consultar el perfil del usuario.',
      detalle: perfilError.message,
    })
  }

  return res.status(200).json({
    success: true,
    usuario: {
      id:                   userId,
      email:                email,
      correo_institucional: perfil?.correo_institucional ?? null,
      rol_sistema:          perfil?.rol_sistema          ?? null,
      created_at:           perfil?.created_at           ?? null,
    },
  })
})

export default router
