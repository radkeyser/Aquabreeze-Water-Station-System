import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = not checked yet
  const [authorized, setAuthorized] = useState(null); // null = unknown
  const [checking, setChecking] = useState(false);
  const [deniedEmail, setDeniedEmail] = useState(null);

  const checkAuthorized = useCallback(async (currentSession) => {
    if (!currentSession?.user?.email) {
      setAuthorized(false);
      return;
    }
    setChecking(true);
    try {
      const { data, error } = await supabase
        .from('authorized_users')
        .select('email')
        .ilike('email', currentSession.user.email)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setDeniedEmail(null);
        setAuthorized(true);
      } else {
        setAuthorized(false);
        setDeniedEmail(currentSession.user.email);
        await supabase.auth.signOut();
      }
    } catch {
      setAuthorized(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) checkAuthorized(data.session);
      else setAuthorized(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) checkAuthorized(newSession);
      else setAuthorized(false);
    });

    return () => listener.subscription.unsubscribe();
  }, [checkAuthorized]);

  const signInWithGoogle = useCallback(async () => {
    setDeniedEmail(null);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const loading = session === undefined || (!!session && authorized === null) || checking;

  const value = {
    session,
    user: session?.user || null,
    authorized: !!authorized,
    loading,
    deniedEmail,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}