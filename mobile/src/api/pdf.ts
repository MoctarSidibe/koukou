import { Platform } from 'react-native';

import { API_BASE_URL, ApiError } from './client';
import { loadSession } from './token';

export async function downloadPdf(path: string, filename: string): Promise<void> {
  const session = loadSession();
  const headers: Record<string, string> = { Accept: 'application/pdf' };
  if (session) headers.Authorization = `Bearer ${session.token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const message = text.trim() ? text.trim().slice(0, 200) : `Erreur serveur (${res.status})`;
    throw new ApiError(res.status, message);
  }

  if (Platform.OS === 'web') {
    await savePdfOnWeb(await res.blob(), filename);
    return;
  }

  const { savePdfOnDevice } = await import('./pdf-native');
  await savePdfOnDevice(new Uint8Array(await res.arrayBuffer()), filename);
}

export function savePdfOnWeb(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}