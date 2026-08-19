export function setApiToken(token: string | null): void;
export function getApiToken(): string | null;
export function getApiBaseUrl(): string;
export function apiGet(path: string, options?: any): Promise<any>;
export function apiPost(path: string, body?: any, options?: any): Promise<any>;
export function apiPut(path: string, body?: any, options?: any): Promise<any>;
export function apiPatch(path: string, body?: any, options?: any): Promise<any>;
export function apiDelete(path: string, options?: any): Promise<any>;
export function edgePost(functionName: string, body?: any, options?: any): Promise<any>;
