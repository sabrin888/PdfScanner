// Minimal IndexedDB wrapper for persisting the working PDF across refreshes.
// PDFs can be several MB, which exceeds localStorage limits, so we use IndexedDB.

const DB_NAME = "pdf-editor";
const STORE = "doc";
const KEY = "current";

interface SavedDoc {
  bytes: ArrayBuffer;
  filename: string;
  totalPages: number;
  currentPage: number;
  history: Array<{ operation: string; params: object; time: string }>;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDoc(doc: {
  bytes: Uint8Array;
  filename: string;
  totalPages: number;
  currentPage: number;
  history: Array<{ operation: string; params: object; time: string }>;
}): Promise<void> {
  try {
    const db = await openDb();
    const payload: SavedDoc = {
      // copy into a fresh ArrayBuffer so a detached/transferred buffer never sneaks in
      bytes: doc.bytes.slice().buffer,
      filename: doc.filename,
      totalPages: doc.totalPages,
      currentPage: doc.currentPage,
      history: doc.history,
      savedAt: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(payload, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // storage unavailable (private mode, quota) — silently skip
  }
}

export async function loadDoc(): Promise<{
  bytes: Uint8Array;
  filename: string;
  totalPages: number;
  currentPage: number;
  history: Array<{ operation: string; params: object; time: string }>;
} | null> {
  try {
    const db = await openDb();
    const result = await new Promise<SavedDoc | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as SavedDoc | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!result) return null;
    return {
      bytes: new Uint8Array(result.bytes),
      filename: result.filename,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      history: result.history ?? [],
    };
  } catch {
    return null;
  }
}

export async function clearDoc(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
