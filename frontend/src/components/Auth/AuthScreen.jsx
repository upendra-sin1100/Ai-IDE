import { useState } from 'react';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export function AuthScreen() {
    const { signIn, signUp, signInWithGoogle } = useAuth();
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isConfigured = hasSupabaseConfig();

    const resetState = () => {
        setError('');
        setInfo('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        resetState();

        if (!email.trim() || !password.trim()) {
            setError('Email and password are required.');
            return;
        }

        if (mode === 'signup') {
            if (password !== confirmPassword) {
                setError('Passwords do not match.');
                return;
            }
            if (password.length < 6) {
                setError('Password should be at least 6 characters long.');
                return;
            }
        }

        setSubmitting(true);

        try {
            if (mode === 'login') {
                await signIn(email.trim(), password);
            } else {
                await signUp(email.trim(), password);
                setInfo('Check your inbox for a confirmation email before continuing.');
            }
        } catch (err) {
            setError(err.message || 'Authentication failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogle = async () => {
        resetState();
        setSubmitting(true);

        try {
            await signInWithGoogle();
        } catch (err) {
            setError(err.message || 'Google sign-in failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleForgotPassword = async () => {
        resetState();

        if (!email.trim()) {
            setError('Enter your email to receive a reset link.');
            return;
        }

        try {
            if (!supabase) {
                throw new Error('Supabase is not configured.');
            }

            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: window.location.origin,
            });

            if (resetError) throw resetError;
            setInfo('Password reset email sent.');
        } catch (err) {
            setError(err.message || 'Unable to send reset email.');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at top, rgba(124,58,237,0.28), rgba(2,6,23,1) 45%)',
            color: '#e2e8f0',
            padding: 20,
            fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        }}>
            <div style={{
                width: '100%',
                maxWidth: 420,
                background: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 16,
                boxShadow: '0 20px 50px rgba(15, 23, 42, 0.7)',
                padding: 28,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>AI IDE Pro</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>Python · Java · C · C++ · JavaScript · PHP</div>
                    </div>
                </div>

                {!isConfigured && (
                    <div style={{ marginBottom: 18, padding: '10px 12px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#fecaca', fontSize: 12 }}>
                        Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your frontend environment to enable sign-in.
                    </div>
                )}

                <div style={{ display: 'flex', marginBottom: 18, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(15, 118, 110, 0.08)' }}>
                    <button
                        onClick={() => setMode('login')}
                        style={{
                            flex: 1,
                            border: 'none',
                            background: mode === 'login' ? 'rgba(124,58,237,0.18)' : 'transparent',
                            color: mode === 'login' ? '#e2e8f0' : '#94a3b8',
                            padding: '10px 12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontFamily: 'inherit',
                        }}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => setMode('signup')}
                        style={{
                            flex: 1,
                            border: 'none',
                            background: mode === 'signup' ? 'rgba(124,58,237,0.18)' : 'transparent',
                            color: mode === 'signup' ? '#e2e8f0' : '#94a3b8',
                            padding: '10px 12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontFamily: 'inherit',
                        }}
                    >
                        Sign Up
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            style={{
                                background: 'rgba(15, 23, 42, 0.7)',
                                border: '1px solid rgba(148,163,184,0.2)',
                                borderRadius: 10,
                                padding: '10px 12px',
                                color: '#e2e8f0',
                                fontSize: 14,
                                fontFamily: 'inherit',
                                outline: 'none',
                            }}
                        />
                    </label>

                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={mode === 'login' ? '********' : 'Create a password'}
                            style={{
                                background: 'rgba(15, 23, 42, 0.7)',
                                border: '1px solid rgba(148,163,184,0.2)',
                                borderRadius: 10,
                                padding: '10px 12px',
                                color: '#e2e8f0',
                                fontSize: 14,
                                fontFamily: 'inherit',
                                outline: 'none',
                            }}
                        />
                    </label>

                    {mode === 'signup' && (
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#cbd5e1' }}>
                            Confirm Password
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm password"
                                style={{
                                    background: 'rgba(15, 23, 42, 0.7)',
                                    border: '1px solid rgba(148,163,184,0.2)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    color: '#e2e8f0',
                                    fontSize: 14,
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                }}
                            />
                        </label>
                    )}

                    {error && (
                        <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#fecaca', fontSize: 12 }}>
                            {error}
                        </div>
                    )}

                    {info && (
                        <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, color: '#bbf7d0', fontSize: 12 }}>
                            {info}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || !isConfigured}
                        style={{
                            border: 'none',
                            borderRadius: 10,
                            padding: '12px 16px',
                            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: submitting || !isConfigured ? 'not-allowed' : 'pointer',
                            opacity: submitting || !isConfigured ? 0.7 : 1,
                            fontFamily: 'inherit',
                        }}
                    >
                        {submitting ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Create Account')}
                    </button>

                    <button
                        type="button"
                        onClick={handleGoogle}
                        disabled={submitting || !isConfigured}
                        style={{
                            border: '1px solid rgba(148,163,184,0.2)',
                            borderRadius: 10,
                            padding: '12px 16px',
                            background: 'rgba(15, 23, 42, 0.7)',
                            color: '#e2e8f0',
                            fontWeight: 600,
                            fontSize: 14,
                            cursor: submitting || !isConfigured ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit',
                        }}
                    >
                        Continue with Google
                    </button>

                    <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                        {mode === 'login' ? (
                            <>
                                Don&apos;t have an account?{' '}
                                <button type="button" onClick={() => setMode('signup')} style={{ color: '#c4b5fd', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}>
                                    Sign Up
                                </button>
                            </>
                        ) : (
                            <>
                                Already have an account?{' '}
                                <button type="button" onClick={() => setMode('login')} style={{ color: '#c4b5fd', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontWeight: 600 }}>
                                    Sign In
                                </button>
                            </>
                        )}
                    </div>

                    <button type="button" onClick={handleForgotPassword} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a5b4fc', fontSize: 12, fontFamily: 'inherit' }}>
                        Forgot Password
                    </button>
                </form>
            </div>
        </div>
    );
}
