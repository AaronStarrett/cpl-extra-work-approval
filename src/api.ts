export class ApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json', ...(method !== 'GET' ? { 'Content-Type': 'application/json', 'X-CPL-Request': '1' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null) as { error?: string; code?: string } | null;
  if (!response.ok) throw new ApiError(data?.error || 'The request could not be completed. Please try again.', response.status, data?.code || 'request_failed');
  return data as T;
}

export const messageOf = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Your entries are still here. Please try again.';
export const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const dateTime = (date: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) + ' (' + Intl.DateTimeFormat().resolvedOptions().timeZone + ')';
export const dateOnly = (date: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date));

export function downloadText(content: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadExport(path: string, filename: string) {
  const data = await api<unknown>(path);
  downloadText(JSON.stringify(data, null, 2), filename);
}
