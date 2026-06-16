// supabase/client.js
// Inicialización única del cliente Supabase
// Se reutiliza en todo el proyecto (patrón singleton)

import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno.\n' +
    'Asegúrate de tener SUPABASE_URL y SUPABASE_ANON_KEY en tu archivo .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // En entorno de servidor/scripts, sin sesiones persistentes
  },
})

if (process.env.NODE_ENV !== 'production') {
  console.log('Cliente Supabase inicializado correctamente.')
  console.log(`   → URL: ${supabaseUrl}`)
}
