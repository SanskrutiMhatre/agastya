// The one place the client talks to the server. Same-origin requests, the
// session travels only in the HttpOnly cookie (never in storage), and every
// failure becomes an ApiError carrying the server's status and code.

export class ApiError extends Error {
  constructor(status, code, message, body) {
    super(message || 'Request failed.');
    this.status = status;
    this.code = code || null;
    this.body = body || null;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' }, signal };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, init);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'Cannot reach the Agastya server. Check your connection and try again.');
  }
  let data = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = null; } }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/login')) {
      window.dispatchEvent(new CustomEvent('agastya:unauthorized'));
    }
    const fallback = res.status === 429 ? 'Too many attempts. Try again later.' : `Request failed (${res.status}).`;
    throw new ApiError(res.status, data && data.code, (data && data.error) || fallback, data);
  }
  return data;
}

async function failure(res) {
  let data = null;
  try { data = JSON.parse(await res.text()); } catch { data = null; }
  if (res.status === 401) window.dispatchEvent(new CustomEvent('agastya:unauthorized'));
  return new ApiError(res.status, data && data.code, (data && data.error) || `Request failed (${res.status}).`, data);
}

// Multipart upload (one file under "file" plus text fields). The browser sets the boundary.
export async function postForm(path, fields = {}, file = null) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') form.append(k, v);
  if (file) form.append('file', file, file.name);
  let res;
  try { res = await fetch(path, { method: 'POST', body: form, credentials: 'same-origin' }); } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the Agastya server. Check your connection and try again.');
  }
  if (!res.ok) throw await failure(res);
  return res.json();
}

// A binary response (PDF, spreadsheet) as a Blob.
export async function fetchBlob(path, { method = 'GET' } = {}) {
  let res;
  try { res = await fetch(path, { method, credentials: 'same-origin' }); } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the Agastya server. Check your connection and try again.');
  }
  if (!res.ok) throw await failure(res);
  return res.blob();
}

export const get = (p, opts) => api(p, opts);
export const put = (p, body) => api(p, { method: 'PUT', body });
export const post = (p, body = {}) => api(p, { method: 'POST', body });
export const patch = (p, body) => api(p, { method: 'PATCH', body });
export const del = (p) => api(p, { method: 'DELETE' });
