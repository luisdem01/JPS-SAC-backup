// api/middleware/auth.middleware.js
// Middleware que extrae y valida el Bearer Token de la cabecera Authorization

import { supabase } from '../../supabase/client.js'

/**
 * Extrae el JWT del header `Authorization: Bearer <token>`,
 * lo valida con Supabase Auth e inyecta `req.user` con los datos del usuario autenticado.
 *
 * Si el token es inválido o está ausente, responde con 401.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization']

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No autorizado. Se requiere un Bearer Token en el header Authorization.',
    })
  }

  const token = authHeader.split(' ')[1]

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado.',
    })
  }

  req.user = user       // { id, email, ... }
  req.token = token
  next()
}
