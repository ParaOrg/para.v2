const PRODUCTION_URL = import.meta.env.VITE_API_URL || "https://para-ph-api.onrender.com";
let authToken = null;

export function setApiToken(token) { authToken = token || null; }
export function getApiToken() { return authToken; }

export function getApiBaseUrl() {
  if (import.meta.env.PROD) return PRODUCTION_URL;
  return "";
}

async function request(method, path, body = null, options = {}) {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const headers = { ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData) headers["Content-Type"] = headers["Content-Type"] || "application/json";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 20000);
  try {
    const response = await fetch(url, { method, headers, body: body ? (isFormData ? body : JSON.stringify(body)) : undefined, signal: controller.signal });
    const text = await response.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }
    if (!response.ok) { const message = data?.message || data?.detail || data?.error || `HTTP ${response.status}`; const error = new Error(message); error.status = response.status; error.data = data; throw error; }
    return data;
  } finally { clearTimeout(timeout); }
}

export function apiGet(path, options) { return request("GET", path, null, options); }
export function apiPost(path, body, options) { return request("POST", path, body, options); }
export function apiPut(path, body, options) { return request("PUT", path, body, options); }
export function apiPatch(path, body, options) { return request("PATCH", path, body, options); }
export function apiDelete(path, options) { return request("DELETE", path, null, options); }

// Supabase Edge Functions for migrated CRUD
export async function edgePost(functionName, body, options = {}) {
  const SUPABASE_EDGE = "https://tcvomrkytxnetzijwqad.supabase.co/functions/v1";
  const url = `${SUPABASE_EDGE}/${functionName}`;
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 20000);
  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}
