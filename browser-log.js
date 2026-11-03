"use strict";
// Test-site storage. The request and entry commit in one IndexedDB transaction.
window.entryBrowserLog = async function(options = {}) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('ictapp-pages-test-v1', 1);
    request.onupgradeneeded = () => {
      const entries = request.result.createObjectStore('entries', {keyPath:'id', autoIncrement:true});
      entries.createIndex('requestKey', 'requestKey', {unique:true});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other ICTApp tabs and retry.'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const writing = options.method === 'POST';
      const tx = db.transaction('entries', writing ? 'readwrite' : 'readonly');
      const store = tx.objectStore('entries');
      let result, failure;
      const publicEntry = row => ({id:row.id, checklist_id:row.checklist_id,
        checklist_version:row.checklist_version, entry_time_utc:row.entry_time_utc,
        checklist_met:row.checklist_met});
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new Error('Browser log unavailable'));
      tx.onerror = () => {};
      if (!writing) {
        store.getAll().onsuccess = event => {
          result = {entries:event.target.result.map(publicEntry).sort((a,b) => b.entry_time_utc.localeCompare(a.entry_time_utc) || b.id-a.id)};
        };
        return;
      }
      try {
        const payload = JSON.parse(options.body);
        const requestKey = options.headers['Idempotency-Key'];
        if (!/^[A-Za-z0-9_-]{16,128}$/.test(requestKey || '') ||
            !['ote','turtle','drill_fvg','drill_wick','silver','ifvg'].includes(payload.checklist_id) ||
            typeof payload.checklist_met !== 'boolean' || !Number.isFinite(Date.parse(payload.entry_time_utc))) {
          throw Object.assign(new Error('Invalid entry'), {status:400});
        }
        const normalized = {checklist_id:payload.checklist_id, checklist_version:payload.checklist_version || 'legacy',
          entry_time_utc:new Date(Math.floor(Date.parse(payload.entry_time_utc)/1000)*1000).toISOString(),
          checklist_met:payload.checklist_met};
        const fingerprint = JSON.stringify(normalized);
        store.index('requestKey').get(requestKey).onsuccess = event => {
          const existing = event.target.result;
          if (existing) {
            if (existing.fingerprint !== fingerprint) {
              failure = Object.assign(new Error('Request key already used'), {status:409});
              tx.abort();
            } else result = publicEntry(existing);
          } else {
            store.add({...normalized, requestKey, fingerprint}).onsuccess = added => {
              result = {id:added.target.result, ...normalized};
            };
          }
        };
      } catch(error) {failure = error; tx.abort();}
    });
  } finally {db.close();}
};
