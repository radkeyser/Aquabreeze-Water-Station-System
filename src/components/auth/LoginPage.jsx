import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import './auth.css';

export default function LoginPage() {
  const { session, authorized, loading, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session && authorized) {
    return <Navigate to="/" replace />;
  }

  const showDenied = !loading && !!session && !authorized;

  async function handleGoogleLogin() {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="material-icons-outlined" style={{ fontSize: 40 }}>opacity</span>
        </div>
        <h1 className="auth-title">Aqua Breeze</h1>
        <p className="auth-sub">Water Station Management System</p>

        {showDenied && (
          <div className="auth-denied">
            <span className="material-icons-outlined">block</span>
            This Google account isn't authorized to access this system. Contact your administrator if this is a mistake.
          </div>
        )}

        <button type="button" className="auth-google-btn" disabled={submitting || loading} onClick={handleGoogleLogin}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.5 6 29.5 4 24 4c-7.7 0-14.3 4.3-17.7 10.7z"/>
            <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.4l-6.3-5.3C29.4 35 26.8 36 24 36c-5.3 0-9.6-3.1-11.3-7.5l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.8l6.3 5.3C41 35.6 44 30.3 44 24c0-1.3-.1-2.7-.4-3.5z"/>
          </svg>
          {submitting ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <p className="auth-footnote">Only pre-approved accounts can access this system.</p>
      </div>
    </div>
  );
}