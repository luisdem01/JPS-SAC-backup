import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options) => {
      const headers = new Headers(options?.headers);
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('sgpi_access_token');
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
      return fetch(url, {
        ...options,
        headers,
      });
    },
  },
});
