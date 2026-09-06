import { vi } from 'vitest';

export type MockFetch = ReturnType<typeof vi.fn>;

export function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
  };
}

export function stubFetch(impl: (...args: unknown[]) => Promise<unknown>): MockFetch {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function stubFetchSequence(responses: unknown[]): MockFetch {
  let i = 0;
  return stubFetch(async () => responses[i++] ?? jsonResponse(200, null));
}

export function readCall<T = { url: string; init: Record<string, unknown> }>(mock: MockFetch, index = 0): T {
  const call = mock.mock.calls[index];
  return { url: call[0] as string, init: call[1] as Record<string, unknown> } as T;
}