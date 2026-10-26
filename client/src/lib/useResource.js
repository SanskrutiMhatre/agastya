import { useCallback, useEffect, useRef, useState } from 'react';
import { get } from '../api.js';

// Fetch a JSON resource with loading / error / reload, aborting on unmount.
export default function useResource(path) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const ctl = useRef(null);
  const load = useCallback(async () => {
    if (!path) return;
    if (ctl.current) ctl.current.abort();
    const c = new AbortController();
    ctl.current = c;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await get(path, { signal: c.signal });
      if (!c.signal.aborted) setState({ loading: false, error: null, data });
    } catch (e) {
      if (e.name !== 'AbortError') setState({ loading: false, error: e, data: null });
    }
  }, [path]);
  useEffect(() => { load(); return () => ctl.current && ctl.current.abort(); }, [load]);
  return { ...state, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}
