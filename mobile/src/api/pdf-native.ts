import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function savePdfOnDevice(bytes: Uint8Array, filename: string): Promise<void> {
  const dest = new File(Paths.cache, filename);
  dest.create({ overwrite: true });
  dest.write(bytes);
  await Sharing.shareAsync(dest.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Bordereau PDF',
    UTI: 'com.adobe.pdf',
  });
}