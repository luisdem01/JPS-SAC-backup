// supabase/admin.js
// Cliente Supabase con Service Role (bypasa RLS — solo para uso en backend)
// ⚠️ NUNCA exponer este cliente al frontend

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
