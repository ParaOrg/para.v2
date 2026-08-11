const PRODUCTION_URL =
  import.meta.env.VITE_API_URL || "https://para-ph-api.onrender.com";

let authToken = null;

export function setApiToken(token) {
  authToken = token || null;
}

export function getApiToken() {
  return authToken;
}

/**
 * In development, Vite proxy handles API paths.
 * In production, use the deployed API URL.
 */
export function getApiBaseUrl() {
  if (import.meta.env.PROD) {
    return PRODUCTION_URL;
  }
  return "";
}

let authToken = null;

export function setApiToken(token) {
  authToken = token;
}

export function getApiToken() {
  return authToken;
}

async function request(method, path, body = null) {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;

  const headers = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers,
    signal: AbortSignal.timeout(20000), // 20s timeout
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`HTTP ${response.status}: ${errorText}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export function apiGet(path, options) {
  return request("GET", path, null, options);
}

export function apiPost(path, body, options) {
  return request("POST", path, body, options);
}

export function apiPut(path, body, options) {
  return request("PUT", path, body, options);
}

export function apiPatch(path, body, options) {
  return request("PATCH", path, body, options);
}

export function apiDelete(path, options) {
  return request("DELETE", path, null, options);
}
