"use strict";
// Reuse the released browser-log.js backup review validator without writing
// to the original IndexedDB archive.
(() => {
  const OUTCOMES = ["not_recorded","not_taken","open","win","loss","break_even"];
  const REQUEST_KEY = /^[A-Za-z0-9_-]{16,128}$/;
  const fail = (message,status=400) => Object.assign(new Error(message),{status});
  const object = value => value!==null && typeof value==="object" && !Array.isArray(value);
  const exact = (value,keys) => object(value) && Object.keys(value).sort().join(",")===[...keys].sort().join(",");
  const stable = value => JSON.stringify(value,(_key,item)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  function preciseTime(value){
    if(typeof value!=='string')return value;
    const match=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    if(!match)return value; // Different noncanonical forms are conflicts, not guesses.
    const parsed=Date.parse(value);
    if(!Number.isFinite(parsed))return value;
    const second=new Date(Math.floor(parsed/1000)*1000).toISOString().slice(0,19);
    return `${second}.${(match[1]||'').padEnd(6,'0')}Z`;
  }
  const validateBackupEntry = source => {
    if(typeof window.entryValidateBackupReview!=="function")throw fail("Backup validator unavailable");
    return window.entryValidateBackupReview(source);
  };
  function preparedItem(item){
    if(!exact(item,['request_key','entry'])&&!exact(item,['entry']))throw fail('Invalid backup request key');
    const row=item.entry;
    if(!exact(row,['id','checklist_id','checklist_version','entry_time_utc','checklist_met','entry_snapshot','outcome','outcome_updated_at'])||
       !Number.isSafeInteger(row.id)||row.id<1||!OUTCOMES.includes(row.outcome)||
       !(row.outcome_updated_at===null||typeof row.outcome_updated_at==='string'&&Number.isFinite(Date.parse(row.outcome_updated_at))))throw fail('Invalid backup entry');
    const source={checklist_id:row.checklist_id,checklist_version:row.checklist_version,entry_time_utc:row.entry_time_utc,checklist_met:row.checklist_met};
    if(row.entry_snapshot!==null)source.entry_snapshot=row.entry_snapshot;
    const normalized=validateBackupEntry(source);
    return {row,normalized};
  }
  async function prepare(item){
    const {row,normalized}=preparedItem(item);
    const key=Object.hasOwn(item,'request_key')?item.request_key:await syntheticKey(row);
    if(typeof key!=='string'||!REQUEST_KEY.test(key))throw fail('Invalid backup request key');
    return {request_key:key,entry:{id:row.id,...normalized,entry_snapshot:normalized.entry_snapshot??null,outcome:row.outcome,outcome_updated_at:row.outcome_updated_at}};
  }
  function sameEntry(a,b){
    const fields=['checklist_id','checklist_version','entry_time_utc','checklist_met','entry_snapshot','outcome','outcome_updated_at'];
    return fields.every(field=>{
      if(field==='entry_time_utc'||field==='outcome_updated_at'){
        if(a[field]==null||b[field]==null)return a[field]==null&&b[field]==null;
        return preciseTime(a[field])===preciseTime(b[field]);
      }
      return stable(a[field]??null)===stable(b[field]??null);
    });
  }
  async function syntheticKey(entry){
    const identity={id:entry.id,checklist_id:entry.checklist_id,checklist_version:entry.checklist_version,entry_time_utc:entry.entry_time_utc,checklist_met:entry.checklist_met,entry_snapshot:entry.entry_snapshot};
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(identity)));
    return 'legacy_'+[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  async function preflight(documents){
    if(!Array.isArray(documents)||documents.length<1)throw fail('Select every backup part before import');
    const rows=[];
    let exportedAt,base,total;
    for(let i=0;i<documents.length;i++){
      const {name,backup}=documents[i];
      if(typeof name!=='string'||!exact(backup,['format','exported_at','entries'])||backup.format!=='ict-entry-desk-browser-backup-v1'||
         typeof backup.exported_at!=='string'||!Number.isFinite(Date.parse(backup.exported_at))||
         !Array.isArray(backup.entries)||backup.entries.length>100000)throw fail('Invalid backup file');
      if(exportedAt===undefined)exportedAt=backup.exported_at;
      if(backup.exported_at!==exportedAt)throw fail('Backup parts have different export times');
      const match=/^(.*)-part-(\d+)-of-(\d+)\.json$/i.exec(name);
      if(documents.length>1||match){
        if(!match)throw fail('Every numbered backup part must be selected together');
        const part=Number(match[2]),count=Number(match[3]);
        if(!Number.isSafeInteger(part)||!Number.isSafeInteger(count)||part<1||count<1||part>count)throw fail('Invalid backup part number');
        if(base===undefined){base=match[1];total=count;}
        if(base!==match[1]||total!==count||part!==i+1)throw fail('Missing, duplicate or mixed backup part');
      }
      rows.push(...backup.entries);
    }
    if(total!==undefined&&total!==documents.length)throw fail('Select every numbered backup part');
    if(rows.length>100000)throw fail('Backup exceeds entry limit');
    const prepared=await Promise.all(rows.map(prepare));
    const keys=prepared.map(item=>item.request_key);
    if(new Set(keys).size!==keys.length)throw fail('Duplicate backup request key');
    return {format:'ict-entry-desk-browser-backup-v1',exported_at:exportedAt,entries:prepared};
  }
  function exportedRow(row){
    const id=Number(row.id);
    if(!Number.isSafeInteger(id)||id<1)throw fail('Cloud entry ID is not a safe integer');
    const entry={id,checklist_id:row.checklist_id,checklist_version:row.checklist_version,entry_time_utc:new Date(row.entry_time_utc).toISOString(),checklist_met:row.checklist_met,
      entry_snapshot:row.entry_snapshot??null,outcome:row.outcome,outcome_updated_at:row.outcome_updated_at??null};
    preparedItem({entry});
    if(typeof row.request_key!=='string'||!REQUEST_KEY.test(row.request_key))throw fail('Invalid cloud request key');
    return {request_key:row.request_key,entry};
  }
  window.entryCloudBackup=async function(action,payload){
    const store=window.entryCloudStore;
    if(!store)throw fail('Cloud journal is unavailable');
    if(action==='export'){
      const rows=await store.listAll();
      const entries=rows.map(exportedRow);
      return {format:'ict-entry-desk-browser-backup-v1',exported_at:new Date().toISOString(),entries};
    }
    if(action!=='import')throw fail('Unknown cloud backup action');
    const backup=await preflight(payload);
    const counts={added:0,skipped:0,conflicted:0,total:backup.entries.length};
    for(const item of backup.entries){
      try{
        let existing=await store.getByKey(item.request_key);
        if(!existing){
          try{await store.insertImported(item.request_key,item.entry);counts.added++;continue;}
          catch(error){if(error.status!==409)throw error;existing=await store.getByKey(item.request_key);}
        }
        if(!existing||!sameEntry(existing,item.entry)){
          counts.conflicted++;
          throw fail('Cloud backup conflicts with an existing request key',409);
        }
        counts.skipped++;
      }catch(error){error.progress={...counts};throw error;}
    }
    return counts;
  };
  window.entryCloudBackupPreflight=preflight;
  // A read-only rollback aid. IDs differ between stores; never choose an
  // outcome by timestamp or write either journal from this comparison.
  window.entryCloudBackupCompare=async function(localDocuments,cloudDocuments){
    const local=await preflight(localDocuments),cloud=await preflight(cloudDocuments);
    const byKey=new Map(local.entries.map(item=>[item.request_key,item.entry]));
    const differences=[];
    for(const item of cloud.entries){
      const old=byKey.get(item.request_key);
      if(!old){differences.push({request_key:item.request_key,kind:'cloud_only'});continue;}
      byKey.delete(item.request_key);
      const fields=['checklist_id','checklist_version','entry_time_utc','checklist_met','entry_snapshot'];
      if(fields.some(field=>field==='entry_time_utc'?preciseTime(old[field])!==preciseTime(item.entry[field]):stable(old[field]??null)!==stable(item.entry[field]??null)))
        differences.push({request_key:item.request_key,kind:'immutable_conflict'});
      if(old.outcome!==item.entry.outcome||
              (old.outcome_updated_at===null)!==(item.entry.outcome_updated_at===null)||
              old.outcome_updated_at!==null&&preciseTime(old.outcome_updated_at)!==preciseTime(item.entry.outcome_updated_at))
        differences.push({request_key:item.request_key,kind:'outcome_conflict'});
    }
    for(const request_key of byKey.keys())differences.push({request_key,kind:'local_only'});
    return {local_count:local.entries.length,cloud_count:cloud.entries.length,differences};
  };
})();
