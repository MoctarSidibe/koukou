import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_BASE_URL, ApiError, apiFetch, resolveApiBaseUrl } from './client';
import { clearSession, saveSession } from './token';
import { jsonResponse, readCall, stubFetch } from './test-utils';
import type { PublicUser } from './types';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: '192.168.1.10:8081' } },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

const user: PublicUser = { id: 'u-1', fullName: 'M. Test', phone: '+241 00 00 00 00', role: 'PROPRIETAIRE' };

beforeEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});

describe('resolveApiBaseUrl', () => {
  it('dérive le port 3000 du hostUri d’Expo', () => {
    expect(resolveApiBaseUrl('192.168.1.10:8081', 'ios')).toBe('http://192.168.1.10:3000');
  });

  it('repli Android sur 10.0.2.2 quand pas de hostUri', () => {
    expect(resolveApiBaseUrl(null, 'android')).toBe('http://10.0.2.2:3000');
  });

  it('repli localhost sinon', () => {
    expect(resolveApiBaseUrl(undefined, 'ios')).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl('', 'web')).toBe('http://localhost:3000');
  });

  it('API_BASE_URL est construit depuis le hostUri mock', () => {
    expect(API_BASE_URL).toBe('http://192.168.1.10:3000');
  });
});

describe('apiFetch', () => {
  it('envoie GET + Bearer et parse le JSON', async () => {
    saveSession({ token: 'jwt', user, farms: [] });
    const fetchMock = stubFetch(async () => jsonResponse(200, { ok: true }));
    const out = await apiFetch<{ ok: boolean }>('/farms/f-1/dashboard');
    expect(out).toEqual({ ok: true });
    const call = readCall(fetchMock);
    expect(call.url).toBe('http://192.168.1.10:3000/farms/f-1/dashboard');
    const headers = call.init.headers as Record<string, string>;
    expect(call.init.method).toBe('GET');
    expect(headers.Authorization).toBe('Bearer jwt');
  });

  it('poste un body JSON sans token hors session', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(201, { id: 'e-1' }));
    const out = await apiFetch<{ id: string }>('/farms/f-1/batches/b-2/daily-entries', {
      method: 'POST',
      body: { deaths: 2 },
    });
    expect(out).toEqual({ id: 'e-1' });
    const call = readCall(fetchMock);
    expect(JSON.parse(call.init.body as string)).toEqual({ deaths: 2 });
    expect((call.init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(call.init.method).toBe('POST');
  });

  it('lève ApiError avec le message FR (string et tableau)', async () => {
    stubFetch(async () => jsonResponse(400, { message: 'Lot inconnu.' }));
    await expect(apiFetch('/farms/x/daily-entries')).rejects.toMatchObject({ status: 400, message: 'Lot inconnu.' });

    stubFetch(async () => jsonResponse(422, { message: ['Quantité invalide'] }));
    await expect(apiFetch('/farms/x/sales')).rejects.toMatchObject({ status: 422, message: 'Quantité invalide' });
  });

  it('lève ApiError status sans body exploitable', async () => {
    stubFetch(async () => jsonResponse(500, null));
    await expect(apiFetch('/farms/x')).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch('/farms/x')).rejects.toThrow('Erreur serveur (500)');
  });

  it('timeout : erreur FR quand le serveur ne répond pas', async () => {
    vi.useFakeTimers();
    try {
      stubFetch((...args: unknown[]) => {
        const init = args[1] as { signal?: AbortSignal } | undefined;
        return new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
          );
        });
      });
      const p = apiFetch('/farms/x/dashboard');
      vi.advanceTimersByTime(15_000);
      await expect(p).rejects.toThrow('Le serveur ne répond pas. Vérifiez votre connexion et réessayez.');
    } finally {
      vi.useRealTimers();
    }
  });
});