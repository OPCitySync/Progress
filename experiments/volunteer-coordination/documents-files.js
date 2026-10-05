const DATABASE = 'mycity-document-files-v1';
const STORE = 'files';

function openDocumentDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(Error('This browser cannot save uploaded files locally.'));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('The browser could not open local file storage.'));
  });
}

async function fileTransaction(mode, action) {
  const database = await openDocumentDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    transaction.oncomplete = () => { database.close(); resolve(request.result); };
    transaction.onabort = () => { database.close(); reject(Error('The browser could not save the uploaded file.')); };
    transaction.onerror = () => database.close();
  });
}

export const saveDocumentFile = (id, file) => fileTransaction('readwrite', store => store.put(file, id));
export const loadDocumentFile = id => fileTransaction('readonly', store => store.get(id));
export const removeDocumentFile = id => fileTransaction('readwrite', store => store.delete(id));
