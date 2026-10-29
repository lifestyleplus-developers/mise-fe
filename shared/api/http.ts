import { clearTokens, getTokens, setTokens, type Tokens } from './session';
import type { ApiErrorBody, Page } from './types';

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
  /** False for login and refresh, which carry no token. Default true. */
  authenticated?: boolean;
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

async function send(
  path: string,
  options: RequestOptions,
  access: string | null,
): Promise<{ response: Response; parsed: unknown }> {
  const { method = 'GET', query, body } = options;
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, parsed: await readBody(response) };
}

/**
 * One refresh at a time: when several calls find the token expired together,
 * they share a single `/auth/refresh`. Refresh rotates the refresh token and
 * blacklists the old one, so a second refresh with it would sign the person out.
 */
let refreshing: Promise<boolean> | null = null;

function refreshTokens(refresh: string): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const { response, parsed } = await send(
        '/auth/refresh',
        { method: 'POST', body: { refresh } },
        null,
      );
      if (!response.ok) {
        await clearTokens();
        return false;
      }
      await setTokens(parsed as Tokens);
      return true;
    } catch {
      // No answer is not a rejection: keep the tokens and let the call fail as
      // unreachable, so a dropped signal does not sign the person out.
      throw new Error('Could not reach the server to refresh the session.');
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * One call to the platform (API Contract §1). Resolves with the parsed JSON, or
 * `undefined` for an empty answer such as a 204. Rejects with an `ApiError` for
 * any non-2xx answer; a call that never reached the server rejects with the
 * network error `fetch` raised, which screens read as "unreachable".
 *
 * Calls carry the saved access token, read when the call is sent, not when it
 * was queued. A 401 on one means the token is missing, expired or ended (§15):
 * the session is refreshed once and the call repeated. If the refresh is
 * refused the tokens are cleared and the 401 reaches the caller, which returns
 * to Login.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set. See .env.');
  }
  const authenticated = options.authenticated ?? true;
  const saved = authenticated ? await getTokens() : null;

  let result = await send(path, options, saved?.access ?? null);
  if (authenticated && result.response.status === 401 && saved) {
    if (await refreshTokens(saved.refresh)) {
      const fresh = await getTokens();
      result = await send(path, options, fresh?.access ?? null);
    }
  }

  const { response, parsed } = result;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      isErrorBody(parsed) ? parsed : fallbackBody(response.status),
    );
  }
  return parsed as T;
}

const MAX_PAGE_SIZE = 100;

/**
 * A list the screens take whole: every page, followed until `next` is null
 * (API Contract §1: 25 a time by default, 100 at most, `next` a page number).
 * Used for the short lists, such as outlets and a checklist's tasks and
 * assignments; a list that can grow large is paged by its screen instead.
 */
export async function requestAll<T>(
  path: string,
  query: RequestOptions['query'] = {},
): Promise<T[]> {
  const items: T[] = [];
  let page: number | null = 1;
  while (page !== null) {
    const result: Page<T> = await request<Page<T>>(path, {
      query: { ...query, page, page_size: MAX_PAGE_SIZE },
    });
    items.push(...result.results);
    page = result.next;
  }
  return items;
}
