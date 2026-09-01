import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        })
        : null;

export function hasSupabaseConfig() {
    return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function getSupabaseAccessToken() {
    if (!supabase) return null;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    } catch {
        return null;
    }
}

export async function getSupabaseAuthHeaders() {
    const token = await getSupabaseAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
