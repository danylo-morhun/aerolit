/**
 * The app talks to a same-origin `/api` prefix, which the Vite dev server
 * forwards to the mock API (see vite.config.ts). That keeps CORS out of the
 * picture and means the deployment target is a proxy rule, not a rebuild.
 */
export const API_BASE = '/api';

/** A failed request, carrying enough context for the UI to explain itself. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly params?: Readonly<Record<string, string | number | undefined>>;
}

function buildUrl(path: string, params: RequestOptions['params']): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) search.set(key, String(value));
  }
  const query = search.toString();
  return `${API_BASE}${path}${query ? `?${query}` : ''}`;
}

/**
 * Single entry point for every request.
 *
 * Non-2xx responses become `ApiError` rather than resolving, so callers never
 * have to remember to check `res.ok` — the one mistake that turns a 404 into a
 * confusing render of an error payload.
 */
export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.params);

  let response: Response;
  try {
    const init: RequestInit = { headers: { Accept: 'application/json' } };
    if (options.signal) init.signal = options.signal;
    response = await fetch(url, init);
  } catch (cause) {
    // Network-level failure: the mock API almost certainly isn't running.
    throw new ApiError(
      cause instanceof Error && cause.name === 'AbortError'
        ? 'Request cancelled'
        : 'Cannot reach the sensor API. Is the mock server running on port 8787?',
      null,
      url,
    );
  }

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status, url);
  }

  return (await response.json()) as T;
}
