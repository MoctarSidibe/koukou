import { beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadPdf, savePdfOnWeb } from './pdf';
import { clearSession, saveSession } from './token';
import { stubFetch } from './test-utils';
import type { PublicUser } from './types';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: '10.0.0.5:8081' } },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

const user: PublicUser = { id: 'u-1', fullName: 'M. Test', phone: '+241 00 00 00 00', role: 'PROPRIETAIRE' };

function pdfResponse(status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/pdf' : null) },
    arrayBuffer: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
    blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
    text: async () => 'Unauthorized',
  };
}

function stubDocument() {
  const click = vi.fn();
  const remove = vi.fn();
  const createObjectURL = vi.fn(() => 'blob:http://localhost/fake');
  const revokeObjectURL = vi.fn();
  const anchor = {
    click,
    remove,
    href: '',
    download: '',
  };
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
  vi.stubGlobal('document', {
    createElement: vi.fn(() => anchor),
    body: { appendChild: vi.fn() },
  });
  return { anchor, createObjectURL, revokeObjectURL };
}

describe('downloadPdf', () => {
  beforeEach(() => {
    clearSession();
  });

  it('télécharge le PDF sur le web avec le token', async () => {
    const fetchMock = stubFetch(async () => pdfResponse(200));
    const { anchor, createObjectURL, revokeObjectURL } = stubDocument();
    saveSession({ token: 'jwt', user, farms: [] });

    await downloadPdf('/farms/f-1/slaughter-orders/o-1/bordereau', 'ABT-20260829-000001.pdf');

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('http://10.0.0.5:3000/farms/f-1/slaughter-orders/o-1/bordereau');
    expect((call[1] as Record<string, unknown>).headers).toEqual({ Accept: 'application/pdf', Authorization: 'Bearer jwt' });
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.download).toBe('ABT-20260829-000001.pdf');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake');
  });

  it('sans session, pas de header Authorization', async () => {
    const fetchMock = stubFetch(async () => pdfResponse(200));
    stubDocument();

    await downloadPdf('/farms/f-1/batches/b-2/passeport', 'passeport-b-2.pdf');

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe('http://10.0.0.5:3000/farms/f-1/batches/b-2/passeport');
    expect((call[1] as Record<string, unknown>).headers).toEqual({ Accept: 'application/pdf' });
  });

  it('remonte une ApiError avec le message serveur', async () => {
    stubFetch(async () => pdfResponse(401));
    stubDocument();

    await expect(downloadPdf('/farms/f-1/slaughter-orders/o-1/bordereau', 'o.pdf')).rejects.toThrow('Unauthorized');
  });
});

describe('savePdfOnWeb', () => {
  it('déclenche le téléchargement navigateur sans popup supplémentaire', () => {
    const { anchor } = stubDocument();
    savePdfOnWeb(new Blob(['%PDF'], { type: 'application/pdf' }), 'bordereau.pdf');
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.download).toBe('bordereau.pdf');
  });
});