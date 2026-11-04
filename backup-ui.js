"use strict";
(() => {
  const status=document.getElementById('backup-status');
  const input=document.getElementById('backup-file');
  document.getElementById('export-backup').addEventListener('click',async()=>{
    status.textContent='Preparing backup…';
    try{
      const backup=await window.entryBrowserBackup('export');
      const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
      const link=document.createElement('a');
      link.href=url;link.download=`ict-entry-desk-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent=`Backup downloaded: ${backup.entries.length} entries. Keep this file private.`;
    }catch(error){status.textContent=`Backup failed: ${error.message}`;}
  });
  document.getElementById('import-backup').addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];input.value='';if(!file)return;
    if(file.size>50*1024*1024){status.textContent='Backup exceeds 50 MB.';return;}
    status.textContent='Checking backup…';
    try{
      const backup=JSON.parse(await file.text());
      const result=await window.entryBrowserBackup('import',backup);
      status.textContent=`Import complete: ${result.added} added, ${result.skipped} already present. Existing entries were kept.`;
      await loadEntries();
    }catch(error){status.textContent=`Import failed: ${error.message}`;}
  });
})();
