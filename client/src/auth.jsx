import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { get, post } from './api.js';
import { FullPageSpinner } from './components/ui/States.jsx';

// Session state comes from /api/auth/me. The client never sees or stores
// the session token: it lives only in the HttpOnly cookie.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', me: null });

  const refresh = useCallback(async () => {
    try {
      const me = await get('/api/auth/me');
      setState({ status: 'authed', me });
      return me;
    } catch {
      setState({ status: 'anon', me: null });
      return null;
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Any 401 from the API (session expired, revoked, account disabled).
  useEffect(() => {
    const onUnauth = () => setState((s) => (s.status === 'authed' ? { status: 'anon', me: null, expired: true } : s));
    window.addEventListener('agastya:unauthorized', onUnauth);
    return () => window.removeEventListener('agastya:unauthorized', onUnauth);
  }, []);

  const signIn = useCallback(async (username, password) => {
    await post('/api/auth/login', { username, password });
    return refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try { await post('/api/auth/logout'); } catch { /* already gone */ }
    setState({ status: 'anon', me: null });
  }, []);

  const value = useMemo(() => ({ ...state, refresh, signIn, signOut }), [state, refresh, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Where a signed-in account must go, given its gates.
export function gateTarget(me) {
  if (!me) return '/signin';
  if (me.gates.onboarding) return '/onboarding';
  if (me.gates.mustChangePassword) return '/change-password';
  return null;
}

// The app proper: signed in, and every account gate closed.
export function RequireAuth({ children }) {
  const { status, me } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status !== 'authed') return <Navigate to="/signin" replace state={{ from: loc.pathname }} />;
  const gate = gateTarget(me);
  if (gate) return <Navigate to={gate} replace />;
  return children;
}

// A gate page: only reachable while that gate is open.
export function RequireGate({ gate, children }) {
  const { status, me } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  if (status !== 'authed') return <Navigate to="/signin" replace />;
  const target = gateTarget(me);
  if (target !== gate) return <Navigate to={target || '/'} replace />;
  return children;
}

// Role-restricted page. The server enforces the same rule; this avoids
// rendering a screen that could only show errors.
export function RequireRole({ roles, children }) {
  const { me } = useAuth();
  if (!roles.includes(me.user.role)) return <Navigate to="/" replace />;
  return children;
}
