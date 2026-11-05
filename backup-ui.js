"use strict";
(() => {
  const status=document.getElementById('backup-status');
  const MAX_IMPORT_BYTES=50*1024*1024;
  const MAX_PART_BYTES=48*1024*1024;
  const encoder=new TextEncoder();
  const exports={local:null,cloud:null};
  let busy=false;
  function splitBackup(backup){
    const headerBytes=encoder.encode(JSON.stringify({...backup,entries:[]})).byteLength;
    const parts=[];let entries=[],bytes=headerBytes;
    for(const entry of backup.entries){
      const entryBytes=encoder.encode(JSON.stringify(entry)).byteLength;
      if(headerBytes+entryBytes>MAX_PART_BYTES)throw new Error('One entry exceeds the backup part limit.');
      if(entries.length&&bytes+1+entryBytes>MAX_PART_BYTES){parts.push({...backup,entries});entries=[];bytes=headerBytes;}
      bytes+=entryBytes+(entries.length?1:0);entries.push(entry);
    }
    parts.push({...backup,entries});
    return parts;
  }
  async function exportBackup(source){
    if(busy)return;
    busy=true;
    try{
      // Both exports contain private journal data. Bind the whole download to
      // the authenticated account that requested it, including local archives.
      const owner=await window.entryCloudStore.currentUserId();
      if(!owner)throw new Error('Sign in again before exporting a backup.');
      if(!exports[source]||exports[source].owner!==owner){
        status.textContent=source==='cloud'?'Preparing cloud backup…':'Preparing old local archive…';
        const backup=source==='cloud'?await window.entryCloudBackup('export'):await window.entryBrowserBackup('export');
        // Sign-out or account switch can happen while a large export is read.
        // Check again before creating a readable JSON download.
        if(await window.entryCloudStore.currentUserId()!==owner)
          throw new Error('Account changed during export. Start a new backup after signing in.');
        exports[source]={parts:splitBackup(backup),index:0,count:backup.entries.length,owner};
      }
      const state=exports[source],part=state.parts[state.index],total=state.parts.length;
      const blob=new Blob([JSON.stringify(part)],{type:'application/json'});
      if(blob.size>MAX_IMPORT_BYTES)throw new Error('Backup part exceeds the import limit.');
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      const date=part.exported_at.slice(0,10);
      const suffix=total===1?'':`-part-${String(state.index+1).padStart(String(total).length,'0')}-of-${total}`;
      link.href=url;
      link.download=`ict-entry-desk-${source==='cloud'?'cloud-backup':'local-archive'}-${date}${suffix}.json`;
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      state.index++;
      const itemCount=`${state.count} entr${state.count===1?'y':'ies'}`;
      if(state.index<total)status.textContent=`Part ${state.index} of ${total} download requested. Click the same export button for the next part. Keep every part of ${itemCount}.`;
      else{
        status.textContent=`${source==='cloud'?'Cloud backup':'Old local archive'} download requested: ${itemCount} in ${total} part${total===1?'':'s'}. Verify every file. JSON backups are readable and unencrypted; keep them private.`;
        exports[source]=null;
      }
    }catch(error){status.textContent=`Backup failed: ${error.message}`;exports[source]=null;}
    finally{busy=false;}
  }
  document.getElementById('export-backup').addEventListener('click',()=>exportBackup('local'));
  document.getElementById('export-cloud-backup').addEventListener('click',()=>exportBackup('cloud'));
  const input=document.getElementById('cloud-backup-files');
  document.getElementById('import-cloud-backup').addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const files=[...input.files];input.value='';if(!files.length)return;
    if(busy)return;
    busy=true;
    try{
      if(files.some(file=>file.size>MAX_IMPORT_BYTES))throw new Error('A backup part exceeds 50 MiB. Select smaller numbered parts.');
      status.textContent='Checking every backup part before import…';
      const documents=await Promise.all(files.map(async file=>({name:file.name,backup:JSON.parse(await file.text())})));
      documents.sort((a,b)=>{
        const number=name=>Number(/-part-(\d+)-of-\d+\.json$/i.exec(name)?.[1]||0);
        return number(a.name)-number(b.name);
      });
      const result=await window.entryCloudBackup('import',documents);
      status.textContent=`Cloud import complete: ${result.added} added, ${result.skipped} already present, ${result.conflicted} conflicts. Keep the source files until reconciliation is complete.`;
      if(typeof window.loadEntries==='function'){
        try{await window.loadEntries();}
        catch{status.textContent+=' History refresh failed; reload after reconnecting to verify the imported rows.';}
      }
    }catch(error){
      const progress=error.progress;
      const advice=error.status===409?'Resolve the conflicting row before retrying.':'A network error may have saved another row without confirmation; retry the same files after reconnecting to reconcile by request key.';
      status.textContent=`Cloud import stopped: ${error.message}${progress?` (${progress.added} confirmed added, ${progress.skipped} already present before stop)` : ''}. Keep all files. ${advice}`;
    }finally{busy=false;}
  });
})();
