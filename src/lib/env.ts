export type DataMode = 'demo' | 'remote';

const raw = import.meta.env as Record<string, string | undefined>;

export const env = {
  dataMode: (raw.VITE_DATA_MODE === 'remote' ? 'remote' : 'demo') as DataMode,
  supabaseUrl: raw.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: raw.VITE_SUPABASE_ANON_KEY ?? '',
  appUrl: raw.VITE_APP_URL ?? (typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin),
  academyWhatsApp: raw.VITE_ACADEMY_WHATSAPP ?? '919000000000',
};

export const supabaseConfigured =
  env.supabaseUrl.startsWith('https://') && env.supabaseAnonKey.length > 20;
