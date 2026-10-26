import { useEffect, useRef, useState } from 'react';

/*
  Live updates for one project over the authenticated, project-scoped
  WebSocket (/ws?project=<id>). The server only pushes: build progress and
  "someone saved" events. One socket per project per page, shared by every
  component that listens, opened on first use and closed when the last
  listener goes. Reconnects with a back-off; the session cookie travels with
  the upgrade, and nothing but the project id is in the URL.
*/

const channels = new Map(); // projectId -> { socket, listeners:Set, retry, delay, connected }

function open(projectId, ch) {
  const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws?project=${encodeURIComponent(projectId)}`;
  const socket = new WebSocket(url);
  ch.socket = socket;
  socket.onopen = () => { ch.delay = 1000; ch.connected = true; ch.listeners.forEach((l) => l.onStatus && l.onStatus(true)); };
  socket.onmessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    ch.listeners.forEach((l) => l.onMessage(data));
  };
  socket.onclose = (ev) => {
    ch.connected = false;
    ch.listeners.forEach((l) => l.onStatus && l.onStatus(false));
    // 4401: the server ended the stream (signed out, access removed): stop.
    if (ch.listeners.size && ev.code !== 4401) {
      ch.retry = setTimeout(() => open(projectId, ch), ch.delay);
      ch.delay = Math.min(ch.delay * 2, 15000);
    }
  };
  socket.onerror = () => { try { socket.close(); } catch { /* closing */ } };
}

function subscribe(projectId, listener) {
  let ch = channels.get(projectId);
  if (!ch) {
    ch = { socket: null, listeners: new Set(), retry: null, delay: 1000, connected: false };
    channels.set(projectId, ch);
    ch.listeners.add(listener);
    open(projectId, ch);
  } else {
    ch.listeners.add(listener);
    if (listener.onStatus) listener.onStatus(ch.connected);
  }
  return () => {
    ch.listeners.delete(listener);
    if (!ch.listeners.size) {
      clearTimeout(ch.retry);
      try { ch.socket && ch.socket.close(); } catch { /* closing */ }
      channels.delete(projectId);
    }
  };
}

export default function useLive(projectId, { onBuild, onContent } = {}) {
  const handlers = useRef({ onBuild, onContent });
  handlers.current = { onBuild, onContent };
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!projectId || typeof WebSocket === 'undefined') return undefined;
    return subscribe(projectId, {
      onStatus: setConnected,
      onMessage: (data) => {
        if (data.type === 'build' && handlers.current.onBuild) handlers.current.onBuild(data);
        if (data.type === 'content' && handlers.current.onContent) handlers.current.onContent(data);
      },
    });
  }, [projectId]);
  return connected;
}

// Collects one build's progress lines from the live stream (kind: 'full' | 'preview' | 'snapshot').
export function useBuildLog(projectId, filter) {
  const [log, setLog] = useState(null);
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const connected = useLive(projectId, {
    onBuild: (e) => {
      if (filterRef.current && !filterRef.current(e)) return;
      setLog((cur) => {
        if (e.phase === 'start') return { kind: e.kind, target: e.target, by: e.by, phase: 'running', lines: [e.message] };
        const base = cur || { kind: e.kind, target: e.target, by: e.by, phase: 'running', lines: [] };
        return { ...base, phase: e.phase === 'progress' ? base.phase : e.phase, lines: [...base.lines, e.message].slice(-200) };
      });
    },
  });
  return { log, setLog, connected };
}
