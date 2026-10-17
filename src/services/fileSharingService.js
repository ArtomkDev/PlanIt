import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { generateId } from "../utils/idGenerator";

const SHARED_FILE_TTL_MS = 24 * 60 * 60 * 1000;
export const SHARED_FILE_CACHE_DIR = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}file-shares/` : null;

export const downloadWebFile = (content, name, type) => {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export const clearSharedFileCache = async () => {
  if (SHARED_FILE_CACHE_DIR) await FileSystem.deleteAsync(SHARED_FILE_CACHE_DIR, { idempotent: true });
};

export const shareLocalFile = async ({ uri, name, mimeType, uti }) => {
  if (!(await Sharing.isAvailableAsync())) throw new Error("sharing_unavailable");
  if (!SHARED_FILE_CACHE_DIR) throw new Error("cache_unavailable");
  const root = SHARED_FILE_CACHE_DIR;
  if ((await FileSystem.getInfoAsync(root)).exists) {
    for (const entry of await FileSystem.readDirectoryAsync(root)) {
      const timestamp = entry.match(/^(\d{13})-/)?.[1];
      if (timestamp && Date.now() - Number(timestamp) > SHARED_FILE_TTL_MS) {
        await FileSystem.deleteAsync(root + entry, { idempotent: true });
      }
    }
  }
  const directory = `${root}${Date.now()}-${generateId()}/`;
  const fileName = String(name || "attachment").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/^\.+/, "_");
  let shared = false;
  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const shareUri = directory + fileName;
    await FileSystem.copyAsync({ from: uri, to: shareUri });
    await Sharing.shareAsync(shareUri, { mimeType, UTI: uti, dialogTitle: name });
    shared = true;
  } finally {
    // Android can return before the receiving app finishes reading the shared URI.
    if (!shared) await FileSystem.deleteAsync(directory, { idempotent: true });
  }
};
