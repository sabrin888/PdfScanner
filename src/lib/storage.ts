// IndexedDB wrapper for persisting the working PDF and recent-file history.
// v1: "doc" store (current document)
// v2: "files" store (recently opened files, up to 10)

const DB_NAME = "pdf-editor";
const DOC_STORE = "doc";
const FILES_STORE = "files";
const DOC_KEY = "current";

interface SavedDoc {
  bytes: ArrayBuffer;
  filename: string;
  totalPages: number;
  currentPage: number;
  history: Array<{ operation: string; params: object; time: string }>;
  savedAt: number;
}

export interface RecentFile {
  id: string;        // filename used as key (upserts on same filename)
  bytes: ArrayBuffer;
  filename: string;
  totalPages: number;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      if (oldVersion < 1) {
        db.createObjectStore(DOC_STORE);
      }
      if (oldVersion < 2) {
        db.createObjectStore(FILES_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Current document ────────────────────────────────────────────────────────

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
      bytes: doc.bytes.slice().buffer,
      filename: doc.filename,
      totalPages: doc.totalPages,
      currentPage: doc.currentPage,
      history: doc.history,
      savedAt: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DOC_STORE, "readwrite");
      tx.objectStore(DOC_STORE).put(payload, DOC_KEY);
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
      const tx = db.transaction(DOC_STORE, "readonly");
      const req = tx.objectStore(DOC_STORE).get(DOC_KEY);
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
      const tx = db.transaction(DOC_STORE, "readwrite");
      tx.objectStore(DOC_STORE).delete(DOC_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

// ─── Recent files ─────────────────────────────────────────────────────────────

const MAX_RECENT = 10;

/** Save/update a file in the recent-files list (upsert by filename). */
export async function saveToRecent(doc: {
  bytes: Uint8Array;
  filename: string;
  totalPages: number;
}): Promise<void> {
  try {
    const db = await openDb();
    const entry: RecentFile = {
      id: doc.filename,
      bytes: doc.bytes.slice().buffer,
      filename: doc.filename,
      totalPages: doc.totalPages,
      savedAt: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, "readwrite");
      tx.objectStore(FILES_STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Trim to MAX_RECENT entries (keep the newest)
    const all = await new Promise<RecentFile[]>((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, "readonly");
      const req = tx.objectStore(FILES_STORE).getAll();
      req.onsuccess = () => resolve(req.result as RecentFile[]);
      req.onerror = () => reject(req.error);
    });

    if (all.length > MAX_RECENT) {
      all.sort((a, b) => b.savedAt - a.savedAt);
      const toDelete = all.slice(MAX_RECENT).map((f) => f.id);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(FILES_STORE, "readwrite");
        const store = tx.objectStore(FILES_STORE);
        for (const id of toDelete) store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
  } catch {
    // silent
  }
}

/** Load all recent files, newest first. */
export async function loadRecent(): Promise<RecentFile[]> {
  try {
    const db = await openDb();
    const all = await new Promise<RecentFile[]>((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, "readonly");
      const req = tx.objectStore(FILES_STORE).getAll();
      req.onsuccess = () => resolve((req.result as RecentFile[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return all.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/** Remove a single recent-file entry by id (filename). */
export async function deleteRecent(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, "readwrite");
      tx.objectStore(FILES_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // silent
  }
}
