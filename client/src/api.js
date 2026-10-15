// Tiny fetch wrapper: sends cookies, handles JSON or FormData, throws readable errors.
export class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields || {}; }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, credentials: 'include', headers: {} };
  if (form) opts.body = form;
  else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }

  let res;
  try { res = await fetch(`/api${path}`, opts); }
  catch { throw new ApiError('Cannot reach the server. Check your connection and try again.', 0); }

  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(data?.error || 'Something went wrong.', res.status, data?.fields);
  return data;
}

// Set by the language provider so dates follow the chosen language
let locale;
export const setLocale = (l) => { locale = l; };
export const fmtDate = (iso) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDateTime = (iso) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const fmtHours = (h) => (h == null ? '-' : h < 48 ? `${Math.round(h * 10) / 10} h` : `${Math.round((h / 24) * 10) / 10} d`);

export const STATUS_LABEL = { pending: 'Pending', in_progress: 'In progress', resolved: 'Resolved' };
export const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
