"use strict";
// Cloud-only journal adapter. The pinned supabase-js bundle and project settings
// are release gates; missing either one fails closed. No IndexedDB fallback.
(() => {
  const TABLE = "entry_reviews";
  const PAGE = 500;
  const KEY = /^[A-Za-z0-9_-]{16,128}$/;
  const IDS = new Set(["ote", "turtle", "drill_fvg", "drill_wick", "silver", "ifvg"]);
  const OUTCOMES = new Set(["not_recorded", "not_taken", "open", "win", "loss", "break_even"]);
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const stable = value => JSON.stringify(value,(_key,item) =>
    object(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
  const fail = (message,status=400,code="invalid") => Object.assign(new Error(message),{status,code});
  const fromError = error => {
    if(error?.code === "23505") return fail("Request key already used",409,"key_conflict");
    if(error?.status === 401 || error?.status === 403) return fail("Sign in again",401,"signed_out");
    return Object.assign(new Error(error?.message || "Cloud request failed"),{
      status:error?.status || 503,code:error?.code || "cloud_unavailable"
    });
  };
  let client;
  function ready(){
    if(client) return client;
    if(!window.supabase || typeof window.supabase.createClient !== "function")
      throw fail("Pinned Supabase SDK is not bundled",503,"sdk_missing");
    const config=window.ICT_CLOUD_CONFIG;
    if(!object(config) || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url || "") ||
       typeof config.publishableKey !== "string" || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey))
      throw fail("Supabase project settings are not configured",503,"config_missing");
    client=window.supabase.createClient(config.url,config.publishableKey);
    return client;
  }
  function allowedUser(current){
    if(current && window.ICT_CLOUD_CONFIG?.ownerId && current.id!==window.ICT_CLOUD_CONFIG.ownerId)
      throw fail("This account is not the journal owner",403,"owner_required");
    return current || null;
  }
  async function user(){
    const {data,error}=await ready().auth.getUser();
    // supabase-js returns AuthSessionMissingError for a normal signed-out tab.
    if(error?.name==="AuthSessionMissingError" || error?.code==="session_not_found")
      return null;
    if(error) throw fromError(error);
    return allowedUser(data?.user);
  }
  async function owner(){
    const current=await user();
    if(!current) throw fail("Sign in to access the cloud journal",401,"signed_out");
    return current;
  }
  async function currentUserId(){ return (await owner()).id; }
  async function listAll(){
    await owner();
    const rows=[];
    for(let offset=0;;offset+=PAGE){
      const {data,error}=await ready().from(TABLE).select("*")
        .order("id",{ascending:true}).range(offset,offset+PAGE-1);
      if(error) throw fromError(error);
      if(!Array.isArray(data)) throw fail("Unexpected cloud response",502,"bad_response");
      rows.push(...data);
      if(data.length<PAGE) return rows;
    }
  }
  async function getByKey(requestKey){
    await owner();
    if(!KEY.test(requestKey)) throw fail("Invalid request key");
    const {data,error}=await ready().from(TABLE).select("*")
      .eq("request_key",requestKey).maybeSingle();
    if(error) throw fromError(error);
    return data || null;
  }
  async function getById(id){
    await owner();
    const {data,error}=await ready().from(TABLE).select("*")
      .eq("id",id).maybeSingle();
    if(error) throw fromError(error);
    return data || null;
  }
  function publicRow(row){
    if(typeof window.entryPublishedPublicRow!=="function")
      throw fail("Published journal formatter is unavailable",503,"validator_missing");
    return {...window.entryPublishedPublicRow(row),id:Number(row.id),revision:row.revision};
  }
  function sameImmutable(row,entry){
    return row.checklist_id===entry.checklist_id &&
      row.checklist_version===(entry.checklist_version || "legacy") &&
      Date.parse(row.entry_time_utc)===Date.parse(entry.entry_time_utc) &&
      row.checklist_met===entry.checklist_met &&
      stable(row.entry_snapshot ?? null)===stable(entry.entry_snapshot ?? null);
  }
  function parseBody(options){
    if(typeof options.body!=="string" || new TextEncoder().encode(options.body).byteLength>16384)
      throw fail("Request too large",413,"too_large");
    let payload;
    try{payload=JSON.parse(options.body);}catch{throw fail("Invalid JSON");}
    if(!object(payload)) throw fail("Invalid request body");
    return payload;
  }
  async function insertImported(requestKey,entry){
    await owner();
    if(!KEY.test(requestKey) || !object(entry) || !IDS.has(entry.checklist_id) ||
       !OUTCOMES.has(entry.outcome) || !Number.isSafeInteger(entry.id) || entry.id<1)
      throw fail("Invalid backup entry");
    if(typeof window.entryValidateBackupReview!=="function")
      throw fail("Published backup validator is unavailable",503,"validator_missing");
    const source={checklist_id:entry.checklist_id,checklist_version:entry.checklist_version,
      entry_time_utc:entry.entry_time_utc,checklist_met:entry.checklist_met};
    if(entry.entry_snapshot!==null) source.entry_snapshot=entry.entry_snapshot;
    const checked=window.entryValidateBackupReview(source);
    const row={request_key:requestKey,checklist_id:checked.checklist_id,
      checklist_version:checked.checklist_version,entry_time_utc:checked.entry_time_utc,
      checklist_met:checked.checklist_met,entry_snapshot:checked.entry_snapshot ?? null,
      outcome:entry.outcome,outcome_updated_at:entry.outcome_updated_at ?? null,
      legacy_local_id:entry.id};
    const {data,error}=await ready().from(TABLE).insert(row).select("*").single();
    if(error) throw fromError(error);
    return data;
  }
  async function createEntry(options){
    await owner();
    const key=options.headers?.["Idempotency-Key"];
    if(typeof key!=="string" || !KEY.test(key)) throw fail("Invalid request key");
    if(typeof window.entryValidateNewReview!=="function")
      throw fail("Published review validator is unavailable",503,"validator_missing");
    const entry=window.entryValidateNewReview(parseBody(options));
    const prior=await getByKey(key);
    if(prior){
      if(!sameImmutable(prior,entry)) throw fail("Request key already used with different contents",409,"key_conflict");
      return publicRow(prior);
    }
    const row={request_key:key,checklist_id:entry.checklist_id,
      checklist_version:entry.checklist_version,entry_time_utc:entry.entry_time_utc,
      checklist_met:entry.checklist_met,entry_snapshot:entry.entry_snapshot};
    let result=await ready().from(TABLE).insert(row).select("*").single();
    if(result.error?.code==="23505"){
      const afterRace=await getByKey(key);
      if(afterRace && sameImmutable(afterRace,entry)) return publicRow(afterRace);
    }
    if(result.error) throw fromError(result.error);
    if(!result.data) throw fail("Save response missing; retry the same request key",503,"save_uncertain");
    return publicRow(result.data);
  }
  async function setOutcome(id,options){
    await owner();
    const payload=parseBody(options);
    if(!OUTCOMES.has(payload.outcome) || !Number.isSafeInteger(payload.expected_revision) ||
       payload.expected_revision<1 || !Number.isSafeInteger(id) || id<1)
      throw fail("Invalid outcome request");
    const {data,error}=await ready().from(TABLE).update({
      outcome:payload.outcome,outcome_updated_at:new Date().toISOString(),
      revision:payload.expected_revision+1
    }).eq("id",id).eq("revision",payload.expected_revision).select("*").maybeSingle();
    if(error) throw fromError(error);
    if(!data) throw fail("Outcome changed elsewhere; refresh it",409,"stale_outcome");
    return publicRow(data);
  }
  window.entryCloudLog=async (options={},url="/api/entries") => {
    const method=options.method || "GET";
    if(url==="/api/entries" && method==="GET"){
      const rows=await listAll();
      if(typeof window.entryPublishedScoreboard!=="function")
        throw fail("Published scoreboard is unavailable",503,"validator_missing");
      return {entries:rows.map(publicRow).sort((a,b) =>
        b.entry_time_utc.localeCompare(a.entry_time_utc) || b.id-a.id).slice(0,50),
        scoreboard:window.entryPublishedScoreboard(rows)};
    }
    if(url==="/api/entries" && method==="POST") return createEntry(options);
    const read=/^\/api\/entries\/([1-9][0-9]*)$/.exec(url);
    if(read && method==="GET"){
      const row=await getById(Number(read[1]));
      if(!row) throw fail("Entry not found",404,"not_found");
      return publicRow(row);
    }
    const match=/^\/api\/entries\/([1-9][0-9]*)\/outcome$/.exec(url);
    if(match && method==="POST") return setOutcome(Number(match[1]),options);
    throw fail("Unknown cloud log route",404,"unknown_route");
  };
  window.entryCloudAuth={
    getUser:user,
    async signIn(email,password){
      const {data,error}=await ready().auth.signInWithPassword({email,password});
      if(error) throw fromError(error);
      return allowedUser(data?.user);
    },
    async resetPassword(email){
      const {error}=await ready().auth.resetPasswordForEmail(email,{
        redirectTo:"https://jgdev1215.github.io/ICTApp/"
      });
      if(error) throw fromError(error);
    },
    async updatePassword(password){
      const {error}=await ready().auth.updateUser({password});
      if(error) throw fromError(error);
    },
    async signOut(){
      const {error}=await ready().auth.signOut({scope:"local"});
      if(error) throw fromError(error);
    },
    onAuthStateChange(callback){
      return ready().auth.onAuthStateChange((event,session) => {
        const next=session?.user || null;
        const ownerId=window.ICT_CLOUD_CONFIG?.ownerId;
        callback(event,next && ownerId && next.id!==ownerId ? null : next);
      });
    }
  };
  window.entryCloudStore={listAll,getByKey,getById,currentUserId,insertImported,publicRow,sameImmutable};
})();
