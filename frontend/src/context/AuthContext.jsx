import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return undefined;
        }

        let isMounted = true;

        const syncSession = async () => {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (!isMounted) return;
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            setLoading(false);
        };

        syncSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            if (!isMounted) return;
            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            setLoading(false);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const value = useMemo(
        () => ({
            user,
            session,
            loading,
            signIn: async (email, password) => {
                if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            },
            signUp: async (email, password) => {
                if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
            },
            signInWithGoogle: async () => {
                if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin,
                    },
                });
                if (error) throw error;
            },
            signOut: async () => {
                if (!supabase) return;
                await supabase.auth.signOut();
            },
        }),
        [loading, session, user]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
