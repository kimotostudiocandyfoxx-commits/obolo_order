/** Tiny IndexedDB blob store used by demo mode for recorded voice clips. */
const DB = 'obolo-demo';
const STORE = 'blobs';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function putBlob(id: string, blob: Blob): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBlob(id: string): Promise<Blob | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(id);
    r.onsuccess = () => resolve((r.result as Blob) ?? null);
    r.onerror = () => reject(r.error);
  });
}
