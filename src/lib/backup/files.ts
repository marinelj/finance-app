import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Moving the backup file in and out of the app. On a phone the file is written to the cache and
 * handed to the share sheet (Files, AirDrop, a chat with yourself…); on the web preview it is
 * downloaded. Nothing is ever uploaded by the app.
 */

export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `finance-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export async function shareBackupFile(
  name: string,
  content: string,
  dialogTitle: string
): Promise<void> {
  if (process.env.EXPO_OS === 'web') {
    const link = document.createElement('a');
    link.href = `data:application/json;charset=utf-8,${encodeURIComponent(content)}`;
    link.download = name;
    link.click();
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    dialogTitle,
    mimeType: 'application/json',
    UTI: 'public.json',
  });
}

export type PickedFile = { name: string; content: string };

/** Lets the user pick a backup file; null when they cancel. */
export async function pickBackupFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const content = asset.file ? await asset.file.text() : await new File(asset.uri).text();
  return { name: asset.name, content };
}
