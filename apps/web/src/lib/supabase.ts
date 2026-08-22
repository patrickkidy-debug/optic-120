import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Nom du bucket Supabase Storage par défaut pour les images (montures, ordonnances, logos). */
export const SUPABASE_STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'OCL 4';

/** Vérifie si Supabase est correctement configuré via les variables d'environnement. */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};
