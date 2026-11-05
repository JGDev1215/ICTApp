"use strict";
// Browser-only counterpart of the local entry API. Transactions retain original
// entry snapshots and request identities; outcome edits affect neither.
(() => {
  const DB_NAME = 'ictapp-pages-test-v1'; // Keep the original name to preserve history.
  const DB_VERSION = 2;
  const REQUIRED_CHECKS = {
    ote:['ote-context','ote-break','ote-anchors','ote-convention','ote-zone','ote-swing','ote-entry'],
    turtle:['ts-level','ts-context','ts-variant','ts-run','ts-failure','ts-entry'],
    drill_fvg:['io-reference','io-sweep','io-shift','io-gap','io-drill','io-price','io-return'],
    drill_wick:['wick-delivery','wick-reference','wick-ce','wick-return','wick-entry'],
    silver:['sb-draw','sb-window','sb-gap','sb-entry','sb-price'],
    ifvg:['ifvg-gap','ifvg-fail','ifvg-scenario','ifvg-return','ifvg-proof','ifvg-entry']
  };
  // Frozen ruleset: changing the UI's current version must not erase this one.
  const RULESETS = {'2026-11-03.2':REQUIRED_CHECKS,'2026-11-03.3':{ifvg:REQUIRED_CHECKS.ifvg}};
  const TYPES = ['previous_day_high','previous_day_low','previous_week_high','previous_week_low','session_high','session_low','equal_highs','equal_lows','swing_high','swing_low','other'];
  const LABEL_REQUIRED = ['session_high','session_low','swing_high','swing_low','other'];
  const SWEEP_STATES = ['no_sweep','not_sure'];
  const OUTCOMES = ['not_recorded','not_taken','open','win','loss','break_even'];
  const DRAW_TYPES={buy:['previous_day_high','previous_week_high','session_high','equal_highs','swing_high'],sell:['previous_day_low','previous_week_low','session_low','equal_lows','swing_low']};
  const INSTRUMENT_IDS=['NQ_continuous_provisional','ES_unavailable','CL_unavailable'];
  const DRAW_PRICE=/^-?(?:0|[1-9][0-9]{0,17})(?:\.[0-9]{1,12})?$/;
  const REQUEST_KEY=/^[A-Za-z0-9_-]{16,128}$/;
  const SYNTHETIC_KEY=/^legacy_[a-f0-9]{64}$/;
  const fail = (message,status=400) => Object.assign(new Error(message),{status});
  const object = value => value!==null && typeof value==='object' && !Array.isArray(value);
  const exact = (value,keys) => object(value) && Object.keys(value).sort().join(',')===[...keys].sort().join(',');
  const stable = value => JSON.stringify(value,(_key,item)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  function bounded(value,max,empty=false){
    if(typeof value!=='string'||value.length>max||(!empty&&!value.trim())||/[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value)) throw fail('Invalid text value');
    return value.trim();
  }
  function dealingRange(value){
    if(!object(value)||!['skipped','not_sure','confirmed'].includes(value.status))throw fail('Invalid dealing range');
    if(value.status!=='confirmed'){
      if(!exact(value,['status']))throw fail('Invalid dealing range fields');
      return {status:value.status};
    }
    if(!exact(value,['status','kind','session','label','timeframe','high','low'])||
       !['session','custom'].includes(value.kind)||!['5-minute','15-minute','1-hour'].includes(value.timeframe))throw fail('Invalid dealing range context');
    const label=bounded(value.label,60,value.kind==='session');
    if(value.kind==='session' ? !['asia','london','new_york'].includes(value.session)||label!=='' : value.session!==null)throw fail('Invalid dealing range label or session');
    if(typeof value.high!=='number'||!Number.isFinite(value.high)||typeof value.low!=='number'||!Number.isFinite(value.low)||value.high<=value.low)throw fail('Range high must exceed a finite low');
    return {status:'confirmed',kind:value.kind,session:value.session,label,timeframe:value.timeframe,high:value.high,low:value.low};
  }
  function decimalValue(price){
    const negative=price.startsWith('-'),unsigned=negative?price.slice(1):price;
    const [whole,fraction='']=unsigned.split('.');
    const amount=BigInt(whole)*1000000000000n+BigInt(fraction.padEnd(12,'0'));
    return negative?-amount:amount;
  }
  function comparableDrawPair(draws){
    const buy=draws.buy,sell=draws.sell;
    if(buy.type==='previous_day_high' && sell.type==='previous_day_low') return true;
    if(buy.type==='previous_week_high' && sell.type==='previous_week_low') return true;
    return buy.type==='session_high' && sell.type==='session_low' && buy.detail===sell.detail;
  }
  function liquidityDraws(value,strict=false){
    if(!exact(value,['buy','sell']))throw fail('Select both manual draws');
    const result={};
    for(const side of ['buy','sell']){
      const row=value[side];
      if(!exact(row,['type','detail','price'])||!DRAW_TYPES[side].includes(row.type)||
         typeof row.detail!=='string'||typeof row.price!=='string'||!DRAW_PRICE.test(row.price))throw fail('Invalid manual draw');
      const detail=row.type.startsWith('session_')?['asia','london','new_york'].includes(row.detail):
        row.type.startsWith('equal_')||row.type.startsWith('swing_')?['5-minute','15-minute','1-hour'].includes(row.detail):row.detail==='';
      if(!detail)throw fail('Invalid draw session or timeframe');
      result[side]={type:row.type,detail:row.detail,price:row.price};
    }
    if(strict && comparableDrawPair(result) && decimalValue(result.buy.price)<=decimalValue(result.sell.price))
      throw fail('Same-range high draw must exceed low draw');
    return result;
  }
  function envelope(payload){
    if(!object(payload)||!['checklist_id','entry_time_utc','checklist_met'].every(k=>Object.hasOwn(payload,k))||Object.keys(payload).some(k=>!['checklist_id','entry_time_utc','checklist_met','checklist_version','entry_snapshot'].includes(k)))throw fail('Invalid entry fields');
    if(!Object.hasOwn(REQUIRED_CHECKS,payload.checklist_id)||typeof payload.checklist_met!=='boolean')throw fail('Invalid checklist');
    const value=payload.entry_time_utc;
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value))throw fail('Entry time must be UTC');
    const time=new Date(value);
    if(!Number.isFinite(time.getTime())||time.getUTCFullYear()<1||time.toISOString().slice(0,19)!==value.slice(0,19))throw fail('Invalid entry time');
    const version=payload.checklist_version??'legacy';
    if(typeof version!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version))throw fail('Invalid checklist version');
    const result={checklist_id:payload.checklist_id,checklist_version:version,entry_time_utc:new Date(Math.floor(time.getTime()/1000)*1000).toISOString(),checklist_met:payload.checklist_met};
    if(Object.hasOwn(payload,'entry_snapshot'))result.entry_snapshot=payload.entry_snapshot;
    return result;
  }
  function snapshot(value,entry,strictDraws=false){
    const rules=Object.hasOwn(RULESETS,entry.checklist_version)?RULESETS[entry.checklist_version]:null;
    if(!rules)throw fail('Unsupported snapshot checklist version');
    if(![1,2,4,5].includes(value?.schema_version)||!exact(value,value.schema_version===1?['schema_version','direction','checks','liquidity']:value.schema_version===2?['schema_version','direction','checks','liquidity','dealing_range']:value.schema_version===4?['schema_version','direction','checks','liquidity','dealing_range','liquidity_draws']:['schema_version','direction','checks','liquidity','dealing_range','liquidity_draws','instrument_id'])||!['long','short'].includes(value.direction))throw fail('Invalid snapshot');
    if(value.schema_version===5&&!INSTRUMENT_IDS.includes(value.instrument_id))throw fail('Invalid instrument');
    if(entry.checklist_id==='drill_wick'&&value.direction!=='short')throw fail('Long wick is not supported');
    const expected=rules[entry.checklist_id];
    if(!expected||!Array.isArray(value.checks)||value.checks.length!==expected.length)throw fail('Snapshot must include every required check');
    const found=new Map();
    for(const check of value.checks){
      if(!exact(check,['id','title','answer','automatic'])||!expected.includes(check.id)||found.has(check.id)||!['yes','no'].includes(check.answer)||typeof check.automatic!=='boolean'||check.automatic!==(check.id==='sb-window'))throw fail('Invalid required answer');
      if(check.id==='sb-window'){
        const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(entry.entry_time_utc));
        const part=t=>parts.find(x=>x.type===t).value;
        const answer=!['Sat','Sun'].includes(part('weekday'))&&[3,10,14].includes(Number(part('hour')))?'yes':'no';
        if(answer!==check.answer)throw fail('Automatic time answer disagrees with entry time');
      }
      found.set(check.id,{id:check.id,title:bounded(check.title,300),answer:check.answer,automatic:check.automatic});
    }
    const checks=expected.map(id=>found.get(id));
    if(checks.every(c=>c.answer==='yes')!==entry.checklist_met)throw fail('Checklist result disagrees with answers');
    const liq=value.liquidity;
    if(!exact(liq,['skipped','swept','target'])||typeof liq.skipped!=='boolean'||!Array.isArray(liq.swept)||liq.swept.length>13)throw fail('Invalid liquidity');
    function reference(ref,target=false){
      if(!exact(ref,['type','label'])||![...TYPES,...(target?['not_decided']:SWEEP_STATES)].includes(ref.type))throw fail('Invalid liquidity reference');
      const label=bounded(ref.label,160,!LABEL_REQUIRED.includes(ref.type));
      const display=ref.type==='no_sweep'?'No sweep observed':ref.type==='not_sure'?'Not sure':ref.type.split('_').map((word,i)=>i===0?word[0].toUpperCase()+word.slice(1):word).join(' ');
      return {type:ref.type,label:label||display};
    }
    const swept=liq.swept.map(ref=>reference(ref));
    if(new Set(swept.map(ref=>ref.type)).size!==swept.length||swept.length>1&&swept.some(ref=>SWEEP_STATES.includes(ref.type)))throw fail('Conflicting swept references');
    const target=liq.target===null?null:reference(liq.target,true);
    if(!liq.skipped&&(!swept.length||!target))throw fail('Select liquidity or skip');
    const normalized={schema_version:value.schema_version,direction:value.direction,checks,liquidity:{skipped:liq.skipped,swept:liq.skipped?[]:swept,target:liq.skipped?null:target}};
    if(value.schema_version>=2)normalized.dealing_range=dealingRange(value.dealing_range);
    if(value.schema_version>=4)normalized.liquidity_draws=liquidityDraws(value.liquidity_draws,strictDraws);
    if(value.schema_version===5){
      if(strictDraws&&value.instrument_id!=='CL_unavailable'&&['buy','sell'].some(side=>decimalValue(normalized.liquidity_draws[side].price)<=0n))throw fail('NQ and ES draw prices must be greater than zero');
      normalized.instrument_id=value.instrument_id;
    }
    return normalized;
  }
  function validate(entry,strictDraws=false){
    if(entry.checklist_version!=='legacy'&&!Object.hasOwn(RULESETS,entry.checklist_version))throw fail('Unsupported checklist version');
    if(entry.checklist_version==='2026-11-03.3'&&entry.checklist_id!=='ifvg')throw fail('Checklist is not supported by this version');
    return Object.hasOwn(entry,'entry_snapshot')?{...entry,entry_snapshot:snapshot(entry.entry_snapshot,entry,strictDraws)}:entry;
  }
  function opaqueSnapshot(value){
    if(!object(value))throw fail('Invalid backup snapshot');
    const stack=[{value,depth:0}];let nodes=0;
    while(stack.length){
      const item=stack.pop();
      if(++nodes>2048||item.depth>24)throw fail('Invalid backup snapshot');
      if(item.value&&typeof item.value==='object'){
        for(const child of Object.values(item.value))stack.push({value:child,depth:item.depth+1});
      }
    }
    let serialized;
    try{serialized=JSON.stringify(value);}catch{throw fail('Invalid backup snapshot');}
    if(typeof serialized!=='string'||new TextEncoder().encode(serialized).byteLength>16384)throw fail('Backup snapshot exceeds size limit');
    return JSON.parse(serialized);
  }
  function validateBackupEntry(source){
    const entry=envelope(source);
    if(Object.hasOwn(RULESETS,entry.checklist_version)||entry.checklist_version==='legacy'&&!Object.hasOwn(entry,'entry_snapshot'))return validate(entry,entry.entry_snapshot?.schema_version===5);
    if(Object.hasOwn(entry,'entry_snapshot'))entry.entry_snapshot=opaqueSnapshot(entry.entry_snapshot);
    return entry;
  }
  // Pure validators shared by the cloud adapter. These do not open or write
  // IndexedDB; the browser journal behavior below remains unchanged.
  window.entryValidateNewReview = payload => {
    const entry=validate(envelope(payload),true);
    if(!Object.hasOwn(RULESETS,entry.checklist_version)||!Object.hasOwn(entry,'entry_snapshot'))
      throw fail('A current review requires a versioned snapshot');
    return entry;
  };
  window.entryValidateBackupReview = validateBackupEntry;
  const publicEntry = row => ({id:row.id,checklist_id:row.checklist_id,checklist_version:row.checklist_version||'legacy',entry_time_utc:row.entry_time_utc,checklist_met:row.checklist_met,entry_snapshot:Object.hasOwn(RULESETS,row.checklist_version)?row.entry_snapshot??null:null,outcome:OUTCOMES.includes(row.outcome)?row.outcome:'not_recorded',outcome_updated_at:row.outcome_updated_at??null});
  const backupEntry = row => ({...publicEntry(row),entry_snapshot:row.entry_snapshot??null});
  function sameImmutable(a,b){
    const left=backupEntry(a),right=backupEntry(b);
    return ['checklist_id','checklist_version','entry_time_utc','checklist_met','entry_snapshot'].every(field=>stable(left[field])===stable(right[field]));
  }
  async function syntheticKey(entry){
    const identity={id:entry.id,checklist_id:entry.checklist_id,checklist_version:entry.checklist_version,entry_time_utc:entry.entry_time_utc,checklist_met:entry.checklist_met,entry_snapshot:entry.entry_snapshot};
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(identity)));
    return 'legacy_'+[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  function scoreboard(rows){
    let scored=0,quality=0,full=0,wins=0,losses=0,breakEven=0;
    for(const row of rows){
      if(row.outcome==='win')wins++;if(row.outcome==='loss')losses++;if(row.outcome==='break_even')breakEven++;
      const required=Object.hasOwn(RULESETS,row.checklist_version)?RULESETS[row.checklist_version][row.checklist_id]:null;
      const checks=required?row.entry_snapshot?.checks:null;
      if(Array.isArray(checks)&&checks.length===required.length&&checks.every(c=>c&&['yes','no'].includes(c.answer))){const yes=checks.filter(c=>c.answer==='yes').length;scored++;quality+=100*yes/checks.length;if(yes===checks.length)full++;}
    }
    const closed=wins+losses+breakEven;
    return {total_reviews:rows.length,scored_reviews:scored,unavailable_reviews:rows.length-scored,win_points:wins,wins,losses,break_even:breakEven,closed_trades:closed,win_rate:closed?100*wins/closed:null,average_checklist_quality:scored?quality/scored:null,full_checklist_rate:scored?100*full/scored:null,full_checklist_reviews:full};
  }
  window.entryPublishedPublicRow = publicEntry;
  window.entryPublishedScoreboard = scoreboard;
  async function open(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);let blocked=false;
      request.onupgradeneeded=()=>{
        const db=request.result;
        const entries=db.objectStoreNames.contains('entries')?request.transaction.objectStore('entries'):db.createObjectStore('entries',{keyPath:'id',autoIncrement:true});
        if(!entries.indexNames.contains('requestKey'))entries.createIndex('requestKey','requestKey',{unique:true});
      };
      request.onsuccess=()=>{if(blocked){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>{blocked=true;reject(new Error('Close other ICTApp tabs and retry.'));};
    });
  }
  window.entryBrowserLog=async function(options={},url='/api/entries'){
    const method=options.method||'GET',match=/^\/api\/entries\/([1-9][0-9]*)\/outcome$/.exec(url);
    if((url!=='/api/entries'&&!match)||!['GET','POST'].includes(method)||(match&&method!=='POST'))throw fail('Unknown browser log route',404);
    let incoming,key,payload;
    if(method==='POST'){
      if(typeof options.body!=='string'||new TextEncoder().encode(options.body).byteLength>16384)throw fail('Request too large',413);
      try{payload=JSON.parse(options.body);}catch{throw fail('Invalid JSON');}
      if(match){if(!exact(payload,['outcome'])||!OUTCOMES.includes(payload.outcome)||!Number.isSafeInteger(Number(match[1])))throw fail('Invalid trade outcome');}
      else{key=options.headers?.['Idempotency-Key'];if(typeof key!=='string'||!REQUEST_KEY.test(key))throw fail('Invalid request key');incoming=envelope(payload);}
    }
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction('entries',method==='POST'?'readwrite':'readonly'),store=tx.objectStore('entries');let result,failure;
      const abort=error=>{failure=error;tx.abort();};
      tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(failure||tx.error||new Error('Browser log unavailable'));tx.onerror=()=>{};
      if(method==='GET'){store.getAll().onsuccess=event=>{const rows=event.target.result;result={entries:rows.map(publicEntry).sort((a,b)=>b.entry_time_utc.localeCompare(a.entry_time_utc)||b.id-a.id).slice(0,50),scoreboard:scoreboard(rows)};};return;}
      if(match){store.get(Number(match[1])).onsuccess=event=>{const row=event.target.result;if(!row){abort(fail('Entry not found',404));return;}row.outcome=payload.outcome;row.outcome_updated_at=new Date().toISOString();store.put(row);result=publicEntry(row);};return;}
      store.index('requestKey').get(key).onsuccess=event=>{
        try{
          const existing=event.target.result;
          if(existing){
            let submitted=incoming;
            if(Object.hasOwn(incoming,'entry_snapshot')&&Object.hasOwn(RULESETS,incoming.checklist_version))submitted=validate(incoming);
            let previous;try{previous=envelope(JSON.parse(existing.fingerprint));}catch{previous=envelope(existing);}
            const core=x=>({checklist_id:x.checklist_id,checklist_version:x.checklist_version,entry_time_utc:x.entry_time_utc,checklist_met:x.checklist_met});
            const sameCore=stable(core(submitted))===stable(core(previous));
            const sameSnapshot=!Object.hasOwn(submitted,'entry_snapshot')||stable(submitted.entry_snapshot)===stable(previous.entry_snapshot);
            if(!sameCore||!sameSnapshot)throw fail('Request key already used with different contents',409);
            result=publicEntry(existing);return;
          }
          const entry=validate(incoming,true),row={...entry,requestKey:key,fingerprint:JSON.stringify(entry),outcome:'not_recorded',outcome_updated_at:null};
          store.add(row).onsuccess=added=>{result=publicEntry({...row,id:added.target.result});};
        }catch(error){abort(error);}
      };
    });}finally{db.close();}
  };
  // Backups merge by original request identity. Import never clears or updates
  // an existing entry, including its outcome.
  window.entryBrowserBackup=async function(action,backup){
    if(action==='export'){
      const db=await open();
      try{const rows=await new Promise((resolve,reject)=>{
        const tx=db.transaction('entries','readonly');let rows=[];
        tx.objectStore('entries').getAll().onsuccess=event=>{rows=event.target.result;};
        tx.oncomplete=()=>resolve(rows);
        tx.onabort=()=>reject(tx.error||new Error('Backup export failed'));
      });
      const entries=await Promise.all(rows.map(async row=>{
        const entry=backupEntry(row);
        return {request_key:typeof row.requestKey==='string'&&REQUEST_KEY.test(row.requestKey)?row.requestKey:await syntheticKey(entry),entry};
      }));
      return {format:'ict-entry-desk-browser-backup-v1',exported_at:new Date().toISOString(),entries};
      }finally{db.close();}
    }
    if(action!=='import'||!exact(backup,['format','exported_at','entries'])||backup.format!=='ict-entry-desk-browser-backup-v1'||
       typeof backup.exported_at!=='string'||!Array.isArray(backup.entries)||backup.entries.length>100000)throw fail('Invalid backup file');
    const prepared=await Promise.all(backup.entries.map(async item=>{
      if(!exact(item,['request_key','entry'])&&!exact(item,['entry']))throw fail('Invalid backup request key');
      const row=item.entry;
      if(!exact(row,['id','checklist_id','checklist_version','entry_time_utc','checklist_met','entry_snapshot','outcome','outcome_updated_at'])||
         !Number.isSafeInteger(row.id)||row.id<1||!OUTCOMES.includes(row.outcome)||
         !(row.outcome_updated_at===null||typeof row.outcome_updated_at==='string'&&Number.isFinite(Date.parse(row.outcome_updated_at))))throw fail('Invalid backup entry');
      const source={checklist_id:row.checklist_id,checklist_version:row.checklist_version,entry_time_utc:row.entry_time_utc,checklist_met:row.checklist_met};
      if(row.entry_snapshot!==null)source.entry_snapshot=row.entry_snapshot;
      const entry=validateBackupEntry(source);
      const key=Object.hasOwn(item,'request_key')?item.request_key:await syntheticKey(row);
      if(typeof key!=='string'||!REQUEST_KEY.test(key))throw fail('Invalid backup request key');
      const synthetic=SYNTHETIC_KEY.test(key)&&key===await syntheticKey(row);
      return {sourceId:row.id,synthetic,record:{requestKey:key,fingerprint:JSON.stringify(entry),...entry,outcome:row.outcome,outcome_updated_at:row.outcome_updated_at}};
    }));
    if(new Set(prepared.map(item=>item.record.requestKey)).size!==prepared.length)throw fail('Duplicate backup request key');
    const db=await open();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction('entries','readwrite'),store=tx.objectStore('entries'),index=store.index('requestKey');let added=0,skipped=0,failure;
      const abort=error=>{failure=error;tx.abort();};
      tx.oncomplete=()=>resolve({added,skipped});
      tx.onabort=()=>reject(failure||tx.error||new Error('Backup import failed'));
      for(const item of prepared)index.get(item.record.requestKey).onsuccess=event=>{
        const old=event.target.result;
        if(old){
          if(!sameImmutable(old,item.record)){abort(fail('Backup conflicts with an existing entry'));return;}
          skipped++;
        }else if(item.synthetic){
          store.get(item.sourceId).onsuccess=found=>{
            const source=found.target.result;
            if(source&&(!source.requestKey||!REQUEST_KEY.test(source.requestKey))&&sameImmutable(source,item.record)){skipped++;return;}
            store.add(item.record);added++;
          };
        }else{store.add(item.record);added++;}
      };
    });}finally{db.close();}
  };
})();
