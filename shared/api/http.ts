import type { ApiErrorBody } from './types';

/**
 * The server's address, ending in `/api/v1`. Set `EXPO_PUBLIC_API_BASE_URL` in
 * `.env`; Expo builds it into the app, so it must never hold a secret.
 */
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(
  /\/+$/,
  '',
);

/**
 * An error answer from the platform, or from the mock standing in for it.
 * Screens switch on `body.error.code` and `status`, never on the message.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.code);
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Query string entries; undefined and null are left out. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Sent as JSON. */
  body?: unknown;
};

function buildUrl(path: string, query: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null)
      params.append(key, String(value));
  }
  const queryString = params.toString();
  return `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ''}`;
}

/** What an error answer is turned into when the server sent no usable body. */
function fallbackBody(status: number): ApiErrorBody {
  return {
    error: {
      code: `http_${status}`,
      message: 'Unexpected response.',
      field: null,
    },
  };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  const error = (value as ApiErrorBody | undefined)?.error;
  return typeof error === 'object' && error !== null && 'code' in error;
}

/**
 * One call to the platform (API Contract §1). Resolves with the parsed JSON, or
 * `undefined` for an empty answer such as a 204. Rejects with an `ApiError` for
 * any non-2xx answer; a call that never reached the server rejects with the
 * network error `fetch` raised, which screens read as "unreachable".
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set. See .env.');
  }
  const { method = 'GET', query, body } = options;
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const parsed = await readBody(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      isErrorBody(parsed) ? parsed : fallbackBody(response.status),
    );
  }
  return parsed as T;
}
