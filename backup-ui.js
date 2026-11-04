"use strict";
(() => {
  const status=document.getElementById('backup-status');
  const input=document.getElementById('backup-file');
  const MAX_IMPORT_BYTES=50*1024*1024;
  const MAX_PART_BYTES=48*1024*1024;
  const encoder=new TextEncoder();
  let exportParts=null,exportIndex=0,exportCount=0,exportBusy=false;
  function splitBackup(backup){
    const headerBytes=encoder.encode(JSON.stringify({...backup,entries:[]})).byteLength;
    const parts=[];let entries=[],bytes=headerBytes;
    for(const entry of backup.entries){
      const entryBytes=encoder.encode(JSON.stringify(entry)).byteLength;
      if(headerBytes+entryBytes>MAX_PART_BYTES)throw new Error('One entry exceeds the backup part limit.');
      if(entries.length && bytes+1+entryBytes>MAX_PART_BYTES){parts.push({...backup,entries});entries=[];bytes=headerBytes;}
      bytes+=entryBytes+(entries.length?1:0);
      entries.push(entry);
    }
    parts.push({...backup,entries});
    return parts;
  }
  document.getElementById('export-backup').addEventListener('click',async()=>{
    if(exportBusy)return;
    exportBusy=true;
    try{
      if(!exportParts){
        status.textContent='Preparing backup…';
        const backup=await window.entryBrowserBackup('export');
        exportParts=splitBackup(backup);exportIndex=0;exportCount=backup.entries.length;
      }
      const part=exportParts[exportIndex],total=exportParts.length;
      const blob=new Blob([JSON.stringify(part)],{type:'application/json'});
      if(blob.size>MAX_IMPORT_BYTES)throw new Error('Backup part exceeds the import limit.');
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      const date=part.exported_at.slice(0,10);
      const suffix=total===1?'':`-part-${String(exportIndex+1).padStart(String(total).length,'0')}-of-${total}`;
      link.href=url;link.download=`ict-entry-desk-backup-${date}${suffix}.json`;
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      exportIndex++;
      const entryCount=`${exportCount} entr${exportCount===1?'y':'ies'}`;
      if(exportIndex<total)status.textContent=`Part ${exportIndex} of ${total} download requested. Click Export backup again for the next part. Verify every file and import every part to restore all ${entryCount}.`;
      else{status.textContent=`Backup download requested: ${entryCount} in ${total} part${total===1?'':'s'}. Verify every file before relying on it. JSON backups are readable and unencrypted; keep them private.`;exportParts=null;exportIndex=0;}
    }catch(error){status.textContent=`Backup failed: ${error.message}`;}
    finally{exportBusy=false;}
  });
  document.getElementById('import-backup').addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];input.value='';if(!file)return;
    if(file.size>MAX_IMPORT_BYTES){status.textContent='Backup exceeds 50 MiB. Import each numbered part separately.';return;}
    status.textContent='Checking backup…';
    try{
      const backup=JSON.parse(await file.text());
      const result=await window.entryBrowserBackup('import',backup);
      status.textContent=`Import complete: ${result.added} added, ${result.skipped} already present. Existing entries were kept.`;
      await loadEntries();
    }catch(error){status.textContent=`Import failed: ${error.message}`;}
  });
})();
