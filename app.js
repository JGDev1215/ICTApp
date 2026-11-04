// Local UI SHA-256: 8af8eb7640879f3ceb770951967128fc30da5f9175c958010988a35ef1515fa4
"use strict";
const fetch=()=>Promise.reject(new Error("Network access disabled in static app"));


const models = [
  {id:"ote", number:"01", short:"OTE", title:"OTE Entry Model", subtitle:"Retracement into an impulse", summary:"Review the 2016/17 body-anchored 62–79% OTE variant, including structure and protective swing.", sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]},
  {id:"turtle", number:"02", short:"TS", title:"Turtle Soup", subtitle:"False break of an old level", summary:"Review a run beyond a preidentified high or low, its context, and observable evidence that the break failed.", sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]},
  {id:"drill", number:"03", short:"IO", title:"Institutional Order Flow Entry Drill", subtitle:"FVG or wick retest", summary:"Choose one documented drill variant. The FVG and wick examples are separate observations, not a single automatic combined setup.", sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]},
  {id:"silver", number:"04", short:"SB", title:"Silver Bullet", subtitle:"Time-windowed FVG reprice", summary:"A qualifying FVG reprice must fit the selected New York local-time entry window and an already stated draw on liquidity.", sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]},
  {id:"ifvg", number:"05", short:"iFVG", title:"Inversion FVG · illustrative", subtitle:"Illustrative Scenario B review", summary:"Review a Scenario B CE-close example as a self-reported exercise. Its result does not certify a source-validated ICT setup.", sources:[{label:"Illustrative iFVG scope · v2026-11-03.3",href:"SOURCE_MAP_IFVG_2026-11-03.3.md"},{label:"Earlier source map · v2026-11-03.2",href:"SOURCE_MAP.md"}]}
];

const CHECKLIST_VERSION = "2026-11-03.2";
const IFVG_ILLUSTRATIVE_VERSION = "2026-11-03.3";
function checklistVersionFor(model){return model==='ifvg'?IFVG_ILLUSTRATIVE_VERSION:CHECKLIST_VERSION;}
const state = {exampleMode:"valid",screen:"entry", returnScreen:"entry", draftActive:true, marketInstrument:"", marketDateNY:"", marketCutoffUTC:"", marketMessage:"", marketContextIds:[],marketTargetId:null,manualTargetDraft:null,marketRangeIds:null,marketContextError:"", hiddenContextReviewed:false, legacyRecovery:false, liquidity:{skipped:false,swept:[],target:null}, liquidityDraws:{buy:{type:'',detail:'',price:''},sell:{type:'',detail:'',price:''}}, dealingRange:{status:"skipped"}, rangeError:"", liquidityError:"", liquidityReturn:"home", liquidityOpen:null, entryTimeUtc:null, inputTimeZone:null, scoreboard:null, selectedEntry:null, outcomeSelection:"not_recorded", outcomeMessage:null, outcomeSaved:false, model:null, direction:"long", variant:"fvg", answers:{}, timeValue:"", dateValue:"", clockValue:"", questionIndex:0, entries:[], apiStatus:"loading", saving:false, saveMessage:null, savedEntry:null, undoDraft:null, storageAvailable:true};
state.rejectedSave=null;
const HistoricalSnapshotClientType=typeof window!=='undefined' ? window.HistoricalSnapshotClient : null;
let phase2Client=typeof HistoricalSnapshotClientType==='function' ? new HistoricalSnapshotClientType((...args)=>fetch(...args)) : null;
let entryMarketLoadSequence=0;
let phase2PreviewEnabled=false;
let phase2PersistentLocal=true;
let yahooRefreshEnabled=false;
let yahoo15mRefreshEnabled=false;
let githubSnapshotEnabled=false;
let yahooLatestEnabled=false;
const yahooLatestPanel={symbol:'',observation:null,status:'idle',request:0,refreshing:false,message:''};
const githubPanel={result:null,status:'idle',message:''};
const yahooPanel={symbol:'NQ=F',status:'idle',result:null,message:'',requestId:0,refreshId:0,refreshing:false,refreshMessage:''};
const yahoo15mPanel={symbol:'',refreshId:0,refreshing:false,message:''};
const historicalChart={response:null,status:'idle',windowId:'',request:0};
async function loadPhase2Capability(){ /* Static manual mode. */ }
function validFallbackAvailability(value){
  if(!value || value.schema_version!=='phase2-fallback-availability-v1' ||
     value.mode!=='historical_fallback_unverified' ||
     value.source_qualification!=='user_csv_export_provisional' ||
     value.source_id!=='user_fallback_csv' || value.instrument_id!=='NQ_continuous_provisional' ||
     typeof value.series_id!=='string' || !value.series_id ||
     value.price_basis!=='ohlc_export_unverified' ||
     !/^[0-9a-f]{64}$/.test(value.source_revision_sha256||'') ||
     value.captured_at_entry!==false || value.verified_market_snapshot!==false ||
     value.received_at_utc!==null ||
     !/^\d{4}-\d{2}-\d{2}$/.test(value.suggested_display_date_ny||'')) return false;
  const stamps=['first_observed_bar_start_at_utc','last_observed_bar_start_at_utc','assumed_completed_through_utc'];
  if(stamps.some(key=>!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value[key]||'') || !Number.isFinite(Date.parse(value[key])))) return false;
  const [first,last,cutoff]=stamps.map(key=>Date.parse(value[key]));
  if(first>cutoff || cutoff>last) return false;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(cutoff)).map(item=>[item.type,item.value]));
  return `${parts.year}-${parts.month}-${parts.day}`===value.suggested_display_date_ny;
}
async function useDeclaredFallbackCutoff(){
  if(state.screen!=='entry') return;
  const request=++entryMarketLoadSequence;
  state.marketMessage='Checking the local historical fallback declaration…';renderEntry();
  try{
    const response=await fetch('/api/market/availability',{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok) throw new Error('Fallback unavailable');
    const availability=await response.json();
    if(request!==entryMarketLoadSequence || state.screen!=='entry') return;
    if(!validFallbackAvailability(availability)) throw new Error('Invalid fallback declaration');
    restoreManualTarget();restoreManualRange();resetPhase2Client();state.marketContextIds=[];state.marketContextError='';
    state.marketInstrument=availability.instrument_id;
    state.marketDateNY=availability.suggested_display_date_ny;
    state.marketCutoffUTC=availability.assumed_completed_through_utc;
    state.marketMessage='Declared historical cutoff selected. Check the date and press Load historical snapshot; this is not a current quote or complete-coverage claim.';
    persistDraft();renderEntry();
  }catch{
    if(request!==entryMarketLoadSequence || state.screen!=='entry') return;
    state.marketMessage='Declared fallback cutoff unavailable. Keep your own date/cutoff or continue manually.';
    renderEntry();
  }
}
function resetPhase2Client(){entryMarketLoadSequence++;historicalChart.request++;historicalChart.response=null;historicalChart.status='idle';phase2Client=typeof HistoricalSnapshotClientType==='function' ? new HistoricalSnapshotClientType((...args)=>fetch(...args)) : null;}
// Read-only local fallback view. This is deliberately outside draftSnapshot and saved entries.
const historicalPanel={date:"",cutoff:"",open:false,status:"idle",message:"",response:null,request:0};
const liquidityTypes = {
  previous_day_high:'Previous day high',previous_day_low:'Previous day low',
  previous_week_high:'Previous week high',previous_week_low:'Previous week low',
  session_high:'Session high',session_low:'Session low',equal_highs:'Equal highs',equal_lows:'Equal lows',
  swing_high:'Swing high',swing_low:'Swing low',other:'Other',no_sweep:'No sweep observed',not_sure:'Not sure',not_decided:'Not decided'
};
const describedLiquidity=new Set(['session_high','session_low','swing_high','swing_low','other']);
const exclusiveSweeps=new Set(['no_sweep','not_sure']);
const buySideSweeps=['previous_day_high','previous_week_high','session_high','equal_highs','swing_high'];
const sellSideSweeps=['previous_day_low','previous_week_low','session_low','equal_lows','swing_low'];
const neutralSweeps=['other','no_sweep','not_sure'];
const drawPricePattern=/^-?(?:0|[1-9][0-9]{0,17})(?:\.[0-9]{1,12})?$/;
function emptyDraws(){return {buy:{type:'',detail:'',price:''},sell:{type:'',detail:'',price:''}};}
function validDraws(value){
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).sort().join(',')!=='buy,sell') return false;
  return ['buy','sell'].every(side=>{
    const row=value[side],types=side==='buy'?buySideSweeps:sellSideSweeps;
    if(!row || typeof row!=='object' || Array.isArray(row) || Object.keys(row).sort().join(',')!=='detail,price,type' || !types.includes(row.type) || typeof row.price!=='string' || !drawPricePattern.test(row.price)) return false;
    if(row.type.startsWith('session_')) return rangeSessions.includes(row.detail);
    if(row.type.startsWith('equal_') || row.type.startsWith('swing_')) return rangeTimeframes.includes(row.detail);
    return row.detail==='';
  });
}
function comparableDrawPair(draws){
  const buy=draws.buy,sell=draws.sell;
  if(buy.type==='previous_day_high' && sell.type==='previous_day_low') return true;
  if(buy.type==='previous_week_high' && sell.type==='previous_week_low') return true;
  return buy.type==='session_high' && sell.type==='session_low' && buy.detail===sell.detail;
}
function decimalValue(price){
  const negative=price.startsWith('-'),unsigned=negative?price.slice(1):price;
  const [whole,fraction='']=unsigned.split('.');
  const amount=BigInt(whole)*1000000000000n+BigInt(fraction.padEnd(12,'0'));
  return negative?-amount:amount;
}
function drawInputProblem(draws,instrument=state.marketInstrument){
  if(!['NQ_continuous_provisional','ES_unavailable','CL_unavailable'].includes(instrument)) return 'Choose NQ, ES, or CL before continuing.';
  if(!validDraws(draws)) return 'Select both draw types, their required detail, and valid numeric prices.';
  if(['NQ_continuous_provisional','ES_unavailable'].includes(instrument) &&
     ['buy','sell'].some(side=>decimalValue(draws[side].price)<=0n))
    return 'NQ and ES draw prices must be greater than zero.';
  if(comparableDrawPair(draws) && decimalValue(draws.buy.price)<=decimalValue(draws.sell.price))
    return 'For the same day, week, or session, the high draw price must exceed the low draw price.';
  return '';
}
function validCurrentDraws(){return !drawInputProblem(state.liquidityDraws);}
const outcomes={not_recorded:'Not recorded',not_taken:'Not taken',open:'Open',win:'Win',loss:'Loss',break_even:'Break-even'};
function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));}
function currentNYDate(instant=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant).map(item=>[item.type,item.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
const invalidFreeText=/[\u0000-\u001f\u007f\ud800-\udfff]/u;
function invalidLiquidityLabel(value){return [...value.swept,value.target].some(item=>item && invalidFreeText.test(item.label));}
function validLiquidity(value,draft=false){
  if(!value || typeof value!=='object' || typeof value.skipped!=='boolean' || !Array.isArray(value.swept) || value.swept.length>13) return false;
  const reference=(item,target)=>item && typeof item==='object' && Object.hasOwn(liquidityTypes,item.type) &&
    (target?!exclusiveSweeps.has(item.type):item.type!=='not_decided') && typeof item.label==='string' && item.label.length<=160 &&
    (draft || (item.label.trim().length>0 && !invalidFreeText.test(item.label)));
  if(!value.swept.every(item=>reference(item,false)) || new Set(value.swept.map(item=>item.type)).size!==value.swept.length ||
     (value.swept.some(item=>exclusiveSweeps.has(item.type)) && value.swept.length!==1) ||
     !(value.target===null || reference(value.target,true))) return false;
  return draft || (value.skipped ? value.swept.length===0 && value.target===null : value.swept.length>0 && value.target!==null);
}
const rangeSessions=['asia','london','new_york'];
const rangeTimeframes=['5-minute','15-minute','1-hour'];
function validRange(value,allowSource=false){
  if(!value || typeof value!=='object' || Array.isArray(value)) return false;
  const keys=Object.keys(value).sort().join(',');
  if(['skipped','not_sure'].includes(value.status)) return keys==='status';
  if(value.status==='source_selected') return allowSource && keys==='status';
  if(value.status!=='confirmed' || keys!=='high,kind,label,low,session,status,timeframe') return false;
  if(!['session','custom'].includes(value.kind) || !rangeTimeframes.includes(value.timeframe) ||
     typeof value.label!=='string' || value.label.length>60 || /[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value.label) ||
     typeof value.high!=='number' || !Number.isFinite(value.high) ||
     typeof value.low!=='number' || !Number.isFinite(value.low) || value.high<=value.low) return false;
  return value.kind==='session' ? rangeSessions.includes(value.session) && value.label==='' : value.session===null && value.label.trim().length>0;
}
function rangeText(value){
  if(!value) return 'Not recorded';
  if(value.status==='skipped') return 'Skipped';
  if(value.status==='not_sure') return 'Not sure yet';
  if(value.status==='source_selected') return 'Explicitly selected historical session range · provisional; see frozen source evidence below';
  if(!validRange(value)) return 'Not recorded';
  const name=value.kind==='session'?value.session.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase()):value.label;
  const fmt=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:10});
  return `${name} · ${value.timeframe} · High ${fmt(value.high)} · Low ${fmt(value.low)} · 50% equilibrium ${fmt(rangeMidpoint(value.high,value.low))}`;
}
function rangeMidpoint(high,low){return high/2+low/2;}
function rangeSummary(value){return `<div class="range-summary"><strong>Dealing range</strong><p>${escapeHTML(rangeText(value))}</p>${value?.status==='confirmed'?'<p class="helper">Premium is above this midpoint; discount is below it. Relative to your selected range, not an entry signal.</p>':''}</div>`;}
function visibleRangeSummary(){return phase2PersistentLocal && state.dealingRange.status==='skipped'?'':rangeSummary(validRange(state.dealingRange,Boolean(state.marketRangeIds))?state.dealingRange:null);}
function checkRangeDisclosure(){
  if(phase2PersistentLocal && !hiddenContextActive()) return '';
  return `<details class="range-disclosure"><summary>Dealing range context</summary>${rangeSummary(validRange(state.dealingRange,Boolean(state.marketRangeIds))?state.dealingRange:null)}${state.model==='ote'?'<p class="helper">The OTE impulse body anchors are separate from this wider range.</p>':''}</details>`;
}
function rangeHistoryText(snapshot){
  const range=snapshot?.market_context?.selected_range,source=snapshot?.market_context?.source_snapshot;
  if(snapshot?.dealing_range?.status!=='source_selected' || !range || !source) return rangeText(snapshot?.dealing_range);
  return `${range.window_name} · H ${range.high} / 50% ${range.midpoint} / L ${range.low} · ${range.occurrence_start_at_utc} to ${range.occurrence_end_at_utc} · cutoff ${source.requested_cutoff_at_utc} · revision ${source.source_revision_sha256} · ${range.coverage_status} · retrospective, provisional/unverified`;
}
function rangeChart(value){
  if(!validRange(value) || value.status!=='confirmed') return '';
  return `<figure class="range-chart"><figcaption>Selected range · ${escapeHTML(value.timeframe)} · Illustrative candles</figcaption><svg viewBox="0 0 320 190" role="img" aria-label="Illustrative candlestick chart with user-confirmed range high, low and 50 percent equilibrium. Shading is context only, not an automatic session boundary."><rect x="38" y="18" width="158" height="154" fill="#eaf4eb"/><path d="M16 25H246 M16 95H246 M16 165H246" stroke="#93aa9a" stroke-dasharray="4 4"/><text x="252" y="28">High</text><text x="252" y="98">50% EQ</text><text x="252" y="168">Low</text><text x="20" y="44">Premium</text><text x="20" y="148">Discount</text><g stroke="#276a48" fill="#69a77d"><path d="M68 112V158 M102 84V135 M136 98V145 M170 58V118 M204 74V126"/><rect x="63" y="126" width="10" height="20"/><rect x="97" y="98" width="10" height="23"/><rect x="131" y="111" width="10" height="20"/><rect x="165" y="76" width="10" height="26"/><rect x="199" y="88" width="10" height="24"/></g></svg><p>Example price action only. Confirm boundaries on your own chart.</p></figure>`;
}
function rangeForm(){
  const value=state.dealingRange,editing=value.status==='editing',confirmed=value.status==='confirmed';
  const kind=editing||confirmed?value.kind:null;
  const pick=(label,choice,active)=>`<button type="button" class="range-choice" data-range-choice="${choice}" aria-pressed="${active}">${label}</button>`;
  const options=kind==='session'?`<div class="range-options" role="group" aria-label="Session context">${rangeSessions.map(s=>`<button type="button" class="range-choice" data-range-session="${s}" aria-pressed="${value.session===s}">${s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</button>`).join('')}</div><details class="range-disclosure"><summary>Killzones and macro windows · New York time</summary><p class="helper">Exact times are not specified here. A session label does not set the range boundaries.</p></details>`:kind==='custom'?`<label class="range-field">Range label<input data-range-field="label" maxlength="60" value="${escapeHTML(value.label||'')}" placeholder="Name this chart range"></label>`:'';
  const fields=kind?`${options}<div class="range-fields"><label class="range-field">Chart timeframe<select data-range-field="timeframe">${rangeTimeframes.map(t=>`<option ${value.timeframe===t?'selected':''}>${t}</option>`).join('')}</select></label><label class="range-field">Range high<input type="number" inputmode="decimal" step="any" data-range-field="high" value="${escapeHTML(value.high??'')}"></label><label class="range-field">Range low<input type="number" inputmode="decimal" step="any" data-range-field="low" value="${escapeHTML(value.low??'')}"></label></div><p class="helper">Enter and confirm your own chart boundaries. No price is filled from the session label.</p><button type="button" class="secondary-button" data-action="range-confirm">${confirmed?'Reconfirm range':'Confirm high and low'}</button>`:'';
  return `<section class="range-section"><h2>Dealing range <small>· Optional</small></h2><p class="helper">Add context for your review; the existing model checks still apply.</p><div class="range-options" role="group" aria-label="Dealing range choice">${pick('Session range','session',kind==='session')}${pick('Custom range','custom',kind==='custom')}${pick('Not sure yet','not_sure',value.status==='not_sure')}${pick('Skip range','skipped',value.status==='skipped')}</div>${value.status==='source_selected'?'<p class="historical-warning">Historical session range active · provisional. Use a manual choice above to restore your earlier manual draft.</p>':''}${fields}${rangeChart(value)}${rangeSummary(confirmed?value:value.status==='not_sure'||value.status==='skipped'||value.status==='source_selected'?value:null)}<p class="feedback error" role="alert">${escapeHTML(state.rangeError)}</p></section>`;
}
function validStoredMarketContext(value){
  if(!value || typeof value!=='object' || !['phase2-market-context-v1','phase2-market-context-v2'].includes(value.contract_version)) return false;
  const withRange=value.contract_version==='phase2-market-context-v2';
  const range=value.selected_range;
  if(withRange && (!range || range.range_contract_version!=='phase2-session-range-v1' ||
     !Array.isArray(range.reference_ids) || range.reference_ids.length!==3 ||
     new Set(range.reference_ids).size!==3 ||
     range.reference_ids.some(id=>typeof id!=='string' || !id || id.length>100) ||
     !['high','midpoint','low'].every(key=>typeof range[key]==='string' && /^-?\d+(?:\.\d+)?$/.test(range[key])) ||
     !/^session-range-[0-9a-f]{32}$/.test(range.range_id||'') ||
     !range.window_id || !range.window_name || !range.schedule_version ||
     range.window_status!=='observed_ended_unverified' ||
     typeof range.coverage_status!=='string' ||
     range.source_qualification!=='user_csv_export_provisional' ||
     range.confirmed_by_user!==true || range.captured_at_entry!==false ||
     range.verified_market_range!==false ||
     !Number.isFinite(Date.parse(range.confirmation_recorded_at_utc)) ||
     !Number.isFinite(Date.parse(range.occurrence_start_at_utc)) ||
     !Number.isFinite(Date.parse(range.occurrence_end_at_utc)) ||
     !Array.isArray(range.source_candle_intervals?.high) ||
     !Array.isArray(range.source_candle_intervals?.low) ||
     !range.source_candle_intervals.high.length ||
     !range.source_candle_intervals.low.length)) return false;
  if(!withRange && Object.hasOwn(value,'selected_range')) return false;
  if(['skipped','manual_only','not_sure'].includes(value.state)) return Object.keys(value).length===2;
  return value.state==='historical_reconstruction_unverified' &&
    value.source_snapshot?.source_qualification==='user_csv_export_provisional' &&
    value.source_snapshot?.verified_market_snapshot===false && value.source_snapshot?.captured_at_entry===false &&
    Array.isArray(value.selected_references) && value.selected_references.length<=14 &&
    (withRange || value.selected_references.length>0) &&
    Array.isArray(value.selection?.context_ids) &&
    value.selected_references.length===value.selection.context_ids.length &&
    value.selected_references.every((row,index)=>row && typeof row==='object' &&
      row.reference_id===value.selection.context_ids[index]) &&
    Array.isArray(value.selection?.swept_ids) &&
    (value.selection.target_id===null || value.selected_references.some(row=>
      row.reference_id===value.selection.target_id && ['high','low'].includes(row.kind) &&
      row.price!==null && row.window_status==='observed_ended_unverified'));
}
function validSnapshot(snapshot){
  return snapshot && [1,2,3,4,5].includes(snapshot.schema_version) && ['long','short'].includes(snapshot.direction) &&
    (snapshot.schema_version===5 ? ['NQ_continuous_provisional','ES_unavailable','CL_unavailable'].includes(snapshot.instrument_id) : !Object.hasOwn(snapshot,'instrument_id')) &&
    Array.isArray(snapshot.checks) && snapshot.checks.length>0 && snapshot.checks.length<=50 &&
    snapshot.checks.every(check=>check && typeof check.id==='string' && check.id.length>0 && check.id.length<=100 &&
      typeof check.title==='string' && check.title.length>0 && check.title.length<=300 && ['yes','no'].includes(check.answer) && typeof check.automatic==='boolean') &&
    new Set(snapshot.checks.map(check=>check.id)).size===snapshot.checks.length && validLiquidity(snapshot.liquidity) &&
    (snapshot.schema_version===5 ? !drawInputProblem(snapshot.liquidity_draws,snapshot.instrument_id) :
      snapshot.schema_version===4 ? validDraws(snapshot.liquidity_draws) : !Object.hasOwn(snapshot,'liquidity_draws')) &&
    (snapshot.schema_version===1 ? !Object.hasOwn(snapshot,'dealing_range') :
      validRange(snapshot.dealing_range,snapshot.schema_version===3)) &&
    (snapshot.schema_version!==3 ||
      (Object.hasOwn(snapshot,'market_context_request') !== Object.hasOwn(snapshot,'market_context') &&
       (Object.hasOwn(snapshot,'market_context_request') ?
         (snapshot.dealing_range.status==='source_selected' ?
          window.validSourceRangeRequest?.(snapshot.market_context_request)===true :
          window.validContextOnlyRequest?.(snapshot.market_context_request)===true) :
         (validStoredMarketContext(snapshot.market_context) &&
          (snapshot.dealing_range.status==='source_selected')===
          (snapshot.market_context.contract_version==='phase2-market-context-v2')))));
}
function canonicalLiquidity(){
  return state.liquidity.skipped?{skipped:true,swept:[],target:null}:{skipped:false,swept:state.liquidity.swept.map(item=>({...item,label:item.label.trim()})),target:state.liquidity.target?{...state.liquidity.target,label:state.liquidity.target.label.trim()}:null};
}
function matchingSnapshot(expected,actual){
  if(!validSnapshot(expected) || !validSnapshot(actual) || expected.direction!==actual.direction || expected.checks.length!==actual.checks.length) return false;
  if(!expected.checks.every(check=>actual.checks.some(other=>['id','title','answer','automatic'].every(key=>other[key]===check[key])))) return false;
  const a=expected.liquidity,b=actual.liquidity;
  const sameReference=(one,two)=>one===null?two===null:two && one.type===two.type && one.label===two.label;
  const sameRange=expected.schema_version===1 || (expected.dealing_range.status===actual.dealing_range.status &&
    (expected.dealing_range.status!=='confirmed' || ['kind','session','label','timeframe','high','low'].every(key=>expected.dealing_range[key]===actual.dealing_range[key])));
  const marketMatches=expected.schema_version!==3 || (()=>{
    const request=expected.market_context_request,stored=actual.market_context;
    if(!request || !stored || request.state!==stored.state) return false;
    if(request.state!=='historical_reconstruction_unverified') return true;
    const source=stored.source_snapshot,selection=stored.selection;
    return ['snapshot_id','content_sha256','source_revision_sha256','instrument_id','series_id','price_basis',
      'display_date_ny','requested_cutoff_at_utc'].every(key=>source[key]===request[key]) &&
      JSON.stringify(selection.context_ids)===JSON.stringify(request.selected_ids) &&
      JSON.stringify(selection.swept_ids)===JSON.stringify(request.swept_ids) &&
      selection.target_id===request.target_id &&
      (request.request_version==='phase2-market-selection-v2' ?
       stored.contract_version==='phase2-market-context-v2' &&
       JSON.stringify(stored.selected_range?.reference_ids)===JSON.stringify(request.range_reference_ids) :
       stored.contract_version==='phase2-market-context-v1');
  })();
  const sameDraws=![4,5].includes(expected.schema_version) || ['buy','sell'].every(side=>['type','detail','price'].every(key=>expected.liquidity_draws[side][key]===actual.liquidity_draws[side][key]));
  return expected.schema_version===actual.schema_version && sameRange && marketMatches && sameDraws &&
    (expected.schema_version!==5 || expected.instrument_id===actual.instrument_id) &&
    a.skipped===b.skipped && a.swept.length===b.swept.length && a.swept.every((item,index)=>sameReference(item,b.swept[index])) && sameReference(a.target,b.target);
}
function marketSelectionRequest(){
  try{return state.marketRangeIds ?
    window.buildSourceRangeRequest?.(phase2Client?.getSnapshot(),state.marketContextIds,state.marketTargetId,state.marketRangeIds)||null :
    window.buildContextOnlyRequest?.(phase2Client?.getSnapshot(),state.marketContextIds,state.marketTargetId)||null;}
  catch{return null;}
}
function historicalTargetTimingProblem(entryIso){
  if(!state.marketTargetId && !state.marketRangeIds) return '';
  const snapshot=phase2Client?.getSnapshot();
  const target=snapshot?.session_references?.find(row=>row.reference_id===(state.marketRangeIds?.[0]||state.marketTargetId));
  const entry=Date.parse(entryIso),cutoff=Date.parse(snapshot?.effective_cutoff_at_utc),formed=Date.parse(target?.occurrence_end_at_utc);
  if(!Number.isFinite(entry) || !Number.isFinite(cutoff) || !Number.isFinite(formed))
    return 'Reload the historical snapshot before saving this selected draw or range.';
  if(cutoff>entry || formed>entry)
    return state.marketRangeIds ? 'This historical range formed after the entry or uses a later research cutoff. Choose a later entry time or return to a manual range.' :
      'This historical draw formed after the entry or uses a later research cutoff. Choose a later entry time or return to a manual target.';
  return '';
}
function restoreManualTarget(){
  if(!state.marketTargetId) return;
  state.marketTargetId=null;
  state.liquidity.target=state.manualTargetDraft?{...state.manualTargetDraft}:null;
  state.manualTargetDraft=null;
}
function restoreManualRange(){
  if(!state.marketRangeIds) return;
  state.marketRangeIds=null;
  state.dealingRange=state.manualRangeDraft?JSON.parse(JSON.stringify(state.manualRangeDraft)):{status:'skipped'};
  state.manualRangeDraft=null;
}
function snapshotForReview(includeMarket=true){
  const base={schema_version:phase2PersistentLocal&&!state.legacyRecovery?(phase2PreviewEnabled?4:5):2,direction:state.direction,checks:requiredChecks().map(entry=>({id:entry.id,title:entry.title,answer:answerFor(entry),automatic:Boolean(entry.auto)})),liquidity:canonicalLiquidity(),dealing_range:state.dealingRange};
  if([4,5].includes(base.schema_version))base.liquidity_draws=JSON.parse(JSON.stringify(state.liquidityDraws));
  if(base.schema_version===5)base.instrument_id=state.marketInstrument;
  if(!includeMarket || !phase2PreviewEnabled || (!state.marketContextIds.length && !state.marketRangeIds)) return base;
  const request=marketSelectionRequest();
  if(!request) throw new Error('Reload and reselect historical context before saving.');
  const {liquidity_draws,instrument_id,...legacyBase}=base;
  return {...legacyBase,schema_version:3,market_context_request:request};
}
function liquidityProblem(value){
  if(!value.swept.length) return requiresDraws()?'Select swept liquidity, No sweep observed, or Not sure.':'Select swept liquidity, No sweep observed, or Not sure. You can also skip this page.';
  if(!value.target) return requiresDraws()?'Select one target, or Not decided.':'Select one target, or Not decided. You can also skip this page.';
  if([...value.swept,value.target].some(item=>!item.label.trim())) return 'Add an identifying label for every selected session, swing, or Other reference.';
  if(invalidLiquidityLabel(value)) return 'Remove control characters from liquidity labels before continuing.';
  return '';
}
function liquiditySummary(value){
  if(!value || value.skipped) return '<p>Liquidity skipped</p>';
  const reference=item=>`${escapeHTML(liquidityTypes[item.type]||item.type)}${describedLiquidity.has(item.type)?` · ${escapeHTML(item.label)}`:''}`;
  return `<p><span>Swept</span> ${value.swept.length?value.swept.map(reference).join(', '):'Not selected'}</p><p><span>Target</span> ${value.target?reference(value.target):'Not selected'}</p>`;
}
function marketSummary(snapshot){
  const market=snapshot?.market_context;
  if(!market) return '';
  if(market.state!=='historical_reconstruction_unverified')
    return `<div class="market-saved-summary"><strong>Historical market context</strong><p>${escapeHTML(market.state||'Unavailable')}</p></div>`;
  if(!validStoredMarketContext(market)) return '<div class="market-saved-summary"><strong>Historical context unavailable</strong><p>Saved evidence could not be displayed consistently.</p></div>';
  const source=market.source_snapshot||{},rows=Array.isArray(market.selected_references)?market.selected_references:[];
  const close=market.reference_price?.price;
  const target=rows.find(row=>row.reference_id===market.selection?.target_id);
  const range=market.selected_range;
  const rangeMarkup=range?`<p>Confirmed historical session range · provisional ${escapeHTML(range.window_name)} · High ${escapeHTML(range.high)} · 50% ${escapeHTML(range.midpoint)} · Low ${escapeHTML(range.low)}</p><p class="helper">Range ${escapeHTML(range.range_id)} · IDs ${range.reference_ids.map(escapeHTML).join(', ')} · ${escapeHTML(range.occurrence_start_at_utc)} to ${escapeHTML(range.occurrence_end_at_utc)} · ${escapeHTML(range.coverage_status)} · ${escapeHTML(range.window_status)} · schedule ${escapeHTML(range.schedule_version)} · source tied candles H ${range.source_candle_intervals.high.length}, L ${range.source_candle_intervals.low.length}. Retrospective only; not captured or verified at entry.</p>`:'';
  return `<div class="market-saved-summary"><strong>Historical context · unverified</strong><p>${escapeHTML(source.instrument_id||'Unknown instrument')} · ${escapeHTML(source.series_id||'Unknown series')} · NY ${escapeHTML(source.display_date_ny||'')} · cutoff ${escapeHTML(source.requested_cutoff_at_utc||'')} · ${rows.length} selected reference${rows.length===1?'':'s'}</p><p class="helper">Source revision ${escapeHTML(source.source_revision_sha256||'Unavailable')}</p><p>Historical close at cutoff: ${close===null?'Unavailable':escapeHTML(close??'Unavailable')}</p>${rangeMarkup}${target?`<p>Retrospective selected draw · provisional ${escapeHTML(target.kind)} ${escapeHTML(target.price)} · ID ${escapeHTML(target.reference_id)} · window ${escapeHTML(target.occurrence_start_at_utc||'unavailable')} to ${escapeHTML(target.occurrence_end_at_utc||'unavailable')}</p>`:''}<p class="helper">Retrospective fallback only. Contract, calendar and entry-time receipt unverified; selected context does not certify a sweep, target or checklist answer.</p><ul>${rows.map(row=>historicalSelectedRow(row,row.comparison,row.window_id)).join('')}</ul></div>`;
}
function historicalSelectedRow(row,comparison,windowName){
  const position={above:'Above',below:'Below',at:'At level'}[comparison?.position]||'Unavailable';
  const compared=comparison?.status==='historical_provisional_comparison' ?
    `Cutoff close vs level: ${escapeHTML(comparison.percent_display)} · ${position}` :
    `Cutoff close vs level: unavailable${comparison?.reason?` · ${escapeHTML(comparison.reason)}`:''}`;
  return `<li><strong>${escapeHTML(windowName||'Window')} · ${escapeHTML(row.kind||'reference')}</strong><small>ID ${escapeHTML(row.reference_id||'Unavailable')}</small><span>Level ${row.price===null?'Unavailable':escapeHTML(row.price??'Unavailable')} · ${escapeHTML(row.status||'unavailable')}</span><small>${compared}</small><small>Comparison status ${escapeHTML(comparison?.status||'unavailable')}${comparison?.reason?` · ${escapeHTML(comparison.reason)}`:''}</small></li>`;
}
function marketSelectionReview(){
  if(!phase2PreviewEnabled || (!state.marketContextIds.length && !state.marketRangeIds)) return '';
  const snapshot=phase2Client?.getSnapshot();
  const byId=new Map(snapshot?.session_references?.map((row,index)=>[row.reference_id,{row,comparison:snapshot.session_comparisons[index]}])||[]);
  const rows=state.marketContextIds.map(id=>byId.get(id));
  if(rows.some(item=>!item)) return '<div class="market-saved-summary"><strong>Historical context unavailable</strong><p>Reload the snapshot and reselect references before saving.</p></div>';
  const target=rows.find(item=>item.row.reference_id===state.marketTargetId)?.row;
  const range=state.marketRangeIds?.map(id=>snapshot.session_references.find(row=>row.reference_id===id));
  const rangeMarkup=range&&range.every(Boolean)?`<p>Explicit historical session range · provisional ${escapeHTML(range[0].window_name)} · High ${escapeHTML(range[0].price)} · 50% ${escapeHTML(range[1].price)} · Low ${escapeHTML(range[2].price)}</p><p class="helper">Window ${escapeHTML(range[0].occurrence_start_at_utc)} to ${escapeHTML(range[0].occurrence_end_at_utc)} · ${escapeHTML(range[0].coverage_status)} · retrospective, not verified at entry. IDs ${state.marketRangeIds.map(escapeHTML).join(', ')}</p>`:'';
  return `<div class="market-saved-summary"><strong>Historical context · ${phase2PersistentLocal?'private Mac':'temporary preview'}</strong><p>${escapeHTML(snapshot.instrument_id)} · ${escapeHTML(snapshot.series_id)} · NY ${escapeHTML(snapshot.display_date_ny)} · cutoff ${escapeHTML(snapshot.requested_cutoff_at_utc)}</p><p class="helper">Source revision ${escapeHTML(snapshot.source_revision_sha256)}</p><p>${rows.length} explicitly selected reference${rows.length===1?'':'s'} will be stored as retrospective, unverified context. A context selection alone is not a target or sweep.</p>${rangeMarkup}${target?`<p>Retrospective selected draw · provisional ${escapeHTML(target.window_name)} ${escapeHTML(target.kind)} ${escapeHTML(target.price)} · ID ${escapeHTML(target.reference_id)} · window ${escapeHTML(target.occurrence_start_at_utc||'unavailable')} to ${escapeHTML(target.occurrence_end_at_utc||'unavailable')}</p>`:''}<ul>${rows.map(({row,comparison})=>historicalSelectedRow(row,comparison,row.window_name)).join('')}</ul></div>`;
}
function yahooCacheMarkup(){
  const item=yahooPanel.result;
  const age=item?Math.floor((Date.now()-Date.parse(item.fetched_at_utc))/60000):null;
  const freshness=age===null?'':age<0?'device clock differs from cache fetch time':`${age} minutes ago`;
  return `<section class="entry-market-card"><strong>Private Yahoo cache · provider observation only</strong><label>Provider series<select data-yahoo-symbol><option value="NQ=F" ${yahooPanel.symbol==='NQ=F'?'selected':''}>NQ=F</option><option value="ES=F" ${yahooPanel.symbol==='ES=F'?'selected':''}>ES=F</option></select></label><button type="button" class="secondary-button" data-action="yahoo-cache-read" ${yahooPanel.status==='loading'?'disabled':''}>Read cached price</button><p class="helper">Reads a private local cache only. Refresh is a separate explicit operator command; opening this page makes no Yahoo request.</p><p role="status">${escapeHTML(yahooPanel.message)}</p>${item?`<p><strong>Last cached provider-labelled close ${escapeHTML(item.close)}</strong> · label ${escapeHTML(item.provider_label_utc)} · fetched ${escapeHTML(item.fetched_at_utc)} (${escapeHTML(freshness)})</p><p class="helper">${escapeHTML(item.symbol)} · revision ${escapeHTML(item.revision)} · ${escapeHTML(item.row_count)} rows · yfinance ${escapeHTML(item.library_version)}. ${escapeHTML(item.timestamp_semantics)}; ${escapeHTML(item.coverage_status)}. Dated contract, bar completion, entry-time capture and redistribution rights unverified. Not live, executable, or saved in this review.</p>`:''}</section>`;
}
async function readYahooCache(){
  if(state.screen!=='entry') return;
  const symbol=yahooPanel.symbol;
  const requestId=++yahooPanel.requestId;
  yahooPanel.status='loading';yahooPanel.result=null;yahooPanel.message='Reading private cache…';renderEntry();
  try{
    const response=await fetch(`/api/market/yahoo-cache?symbol=${encodeURIComponent(symbol)}`,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok) throw new Error('Private cache unavailable. Manual review remains available.');
    const item=await response.json();
    if(item?.schema_version!=='phase2-yahoo-cache-close-v1' || item.source_qualification!=='yahoo_provider_series_unverified' ||
       item.symbol!==symbol || !/^[0-9a-f]{64}$/.test(item.revision||'') || !/^-?\d+(?:\.\d+)?$/.test(item.close||'') ||
       !Number.isFinite(Date.parse(item.fetched_at_utc)) || !Number.isFinite(Date.parse(item.provider_label_utc)) ||
       item.contract_id!==null || item.captured_at_entry!==false || item.verified_market_price!==false)
      throw new Error('Cached source identity is invalid.');
    if(requestId!==yahooPanel.requestId || symbol!==yahooPanel.symbol || (phase2PersistentLocal && symbol!==selectedSymbol())) return;
    yahooPanel.result=item;yahooPanel.status='ready';yahooPanel.message='Cached provider observation loaded; freshness and contract are unverified.';
  }catch(error){
    if(requestId!==yahooPanel.requestId || symbol!==yahooPanel.symbol || (phase2PersistentLocal && symbol!==selectedSymbol())) return;
    yahooPanel.result=null;yahooPanel.status='unavailable';yahooPanel.message=error.message||'Private cache unavailable.';
  }
  if(state.screen==='entry') renderEntry();
}
function selectedSymbol(){return {NQ_continuous_provisional:'NQ=F',ES_unavailable:'ES=F',CL_unavailable:'CL=F'}[state.marketInstrument]||'';}
async function readYahooLatest(){
  if(!yahooLatestEnabled)return;
  const symbol=selectedSymbol(),request=++yahooLatestPanel.request;
  yahooLatestPanel.symbol=symbol;yahooLatestPanel.observation=null;yahooLatestPanel.status='loading';
  try{
    const response=await fetch(`/api/market/yahoo-latest?symbol=${encodeURIComponent(symbol)}`,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok)throw new Error('Selected Yahoo observation unavailable.');
    const data=await response.json(),observation=data?.observation;
    if(observation && (observation.symbol!==symbol || observation.bar_interval!=='1m' || observation.feed_delay_status!=='unverified'))throw new Error('Invalid Yahoo observation.');
    if(request!==yahooLatestPanel.request||symbol!==selectedSymbol())return;
    yahooLatestPanel.observation=observation||null;yahooLatestPanel.status=observation?'ready':'unavailable';
    yahooLatestPanel.message=observation?'':'No short-window Yahoo observation cached yet.';
  }catch(error){if(request!==yahooLatestPanel.request)return;yahooLatestPanel.observation=null;yahooLatestPanel.status='unavailable';yahooLatestPanel.message=error.message;}
  if(state.screen==='entry')renderEntry();
}
async function refreshYahooLatest(){
  if(!yahooLatestEnabled||yahooLatestPanel.refreshing)return;
  const symbol=selectedSymbol();
  yahooLatestPanel.refreshing=true;yahooLatestPanel.message='Requesting selected Yahoo price…';renderEntry();
  try{
    const response=await fetch('/api/market/yahoo-latest',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({symbol}),cache:'no-store'});
    if(!response.ok)throw new Error('Yahoo price request unavailable.');
    const result=await response.json();
    if(result?.status==='refreshed')yahooLatestPanel.message='Selected Yahoo price updated; provider label and feed delay remain unverified.';
    else if(result?.status==='rate_limited')yahooLatestPanel.message='One-hour request limit active; previous observation retained.';
    else yahooLatestPanel.message=`Yahoo price request failed (${result?.error_type||'provider unavailable'}); previous observation retained. One-hour limit applies.`;
  }catch(error){yahooLatestPanel.message=error.message||'Yahoo price request unavailable.';}
  yahooLatestPanel.refreshing=false;
  const message=yahooLatestPanel.message;
  if(symbol===selectedSymbol()){await readYahooLatest();yahooLatestPanel.message=message;if(state.screen==='entry')renderEntry();}
}
function yahooLatestMarkup(){
  if(!yahooLatestEnabled)return '';
  const item=yahooLatestPanel.symbol===selectedSymbol()?yahooLatestPanel.observation:null;
  const age=item?Math.max(0,Math.floor((Date.now()-Date.parse(item.provider_label_utc))/60000)):null;
  return `<section class="entry-market-card"><strong>Selected Yahoo price · ${escapeHTML(selectedSymbol())}</strong><span>${item?escapeHTML(item.price):'— / Unavailable'}</span><small>${item?`Provider one-minute bar label ${escapeHTML(item.provider_label_utc)} · ${age}m old · fetched ${escapeHTML(item.fetched_at_utc)}.`:escapeHTML(yahooLatestPanel.message||'No observation cached.')} Yahoo provider series; feed delay and dated contract unverified. This is not a live or executable quote.</small><button type="button" class="secondary-button" data-action="refresh-yahoo-latest" ${yahooLatestPanel.refreshing?'disabled':''}>${yahooLatestPanel.refreshing?'Requesting…':'Request selected Yahoo price'}</button><p class="helper" role="status">${escapeHTML(yahooLatestPanel.message)}</p></section>`;
}
function selectedGithubInstrument(){return {NQ_continuous_provisional:'NQ',ES_unavailable:'ES',CL_unavailable:'CL'}[state.marketInstrument]||'';}
async function readGithubSnapshot(){
  if(!githubSnapshotEnabled)return;
  githubPanel.status='loading';githubPanel.message='Reading published GitHub snapshot…';
  if(state.screen==='entry')renderEntry();
  try{
    const response=await fetch('/api/market/github-snapshot',{headers:{Accept:'application/json'},cache:'no-store'});
    const data=await response.json();
    if(!response.ok || !['stale','recent_unverified'].includes(data?.status) ||
       data.snapshot?.schema_version!=='ict-market-data-v2' ||
       !data.snapshot?.instruments?.NQ || !data.snapshot?.instruments?.ES || !data.snapshot?.instruments?.CL ||
       !/^[0-9a-f]{64}$/.test(data.snapshot_sha256||''))throw new Error('No accepted GitHub snapshot.');
    githubPanel.result=data;githubPanel.status='ready';githubPanel.message='';
  }catch(error){githubPanel.result=null;githubPanel.status='unavailable';githubPanel.message=error.message||'GitHub snapshot unavailable.';}
  if(state.screen==='entry')renderEntry();
}
function midpointDecimal(a,b){
  if(typeof a!=='string'||typeof b!=='string')return '—';
  const places=Math.max((a.split('.')[1]||'').length,(b.split('.')[1]||'').length)+1;
  const scale=10n**BigInt(places);
  const integer=s=>{const [whole,part='']=s.split('.');return BigInt(whole)*scale+BigInt(part.padEnd(places,'0'));};
  const value=(integer(a)+integer(b))/2n;
  const fraction=(value%scale).toString().padStart(places,'0').replace(/0+$/,'');
  return `${value/scale}${fraction?'.'+fraction:''}`;
}
function githubSnapshotMarkup(){
  if(!githubSnapshotEnabled)return '';
  const result=githubPanel.result,code=selectedGithubInstrument(),snapshot=result?.snapshot,item=snapshot?.instruments?.[code];
  if(!item)return `<section class="entry-market-card"><strong>GitHub market snapshot</strong><p role="status">${escapeHTML(githubPanel.message||'No accepted snapshot is available.')}</p><small>Published data unavailable; journal and separate Yahoo cache remain usable.</small></section>`;
  const generated=snapshot.generated_at_utc,age=Math.max(0,Math.floor((Date.now()-Date.parse(generated))/60000));
  const stale=result.status==='stale'||age>45;
  const latest=item.latest_price,refs=item.references;
  const reference=(key,label)=>`<div class="entry-market-card"><strong>${label}</strong><span>${refs[key].price===null?'— / Definition required':escapeHTML(refs[key].price)}</span><small>${refs[key].price===null?'Unavailable':'Reported · provisional'}</small></div>`;
  const dayMid=midpointDecimal(refs.previous_day_high.price,refs.previous_day_low.price);
  const weekMid=midpointDecimal(refs.previous_week_high.price,refs.previous_week_low.price);
  const link=`https://github.com/JGDev1215/PROJECTS123/blob/main/ict-entry-desk/market-data/v2/${result.snapshot_path}`;
  return `<section class="github-market-panel"><div class="entry-market-card"><strong>GitHub snapshot · ${escapeHTML(code)} · ${stale?'Stale':'Recent, unverified'}</strong><span>${escapeHTML(latest.price)}</span><small>TradingView ${escapeHTML(item.provider_symbol)} · ${latest.forming?'forming five-minute bar':'five-minute bar observation'} starting ${escapeHTML(latest.bar_start_at_utc)}. Generated ${escapeHTML(generated)} · ${age}m old.</small></div><p class="helper" role="status">${result.sync_error?escapeHTML(result.sync_error)+' · Showing last accepted snapshot. ':''}Published snapshot fetched ${escapeHTML(result.fetched_at_utc)}. Feed delay, dated contract, roll and raw-bar coverage unverified.</p><div class="entry-market-opens">${reference('midnight_open','New York midnight open')}${reference('week_open','Week Open')}${reference('previous_day_high','Previous futures day high')}${reference('previous_day_low','Previous futures day low')}${reference('previous_week_high','Previous futures week high')}${reference('previous_week_low','Previous futures week low')}</div><p class="helper">Derived midpoints from this same ${escapeHTML(code)} revision: previous day ${escapeHTML(dayMid)} · previous week ${escapeHTML(weekMid)}. These are arithmetic context, not independently verified levels or liquidity signals.</p><details class="source-details"><summary>GitHub source &amp; periods</summary><p><a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">Published snapshot</a> · SHA-256 ${escapeHTML(result.snapshot_sha256)} · ID ${escapeHTML(snapshot.snapshot_id)}</p><p>Previous futures day: ${escapeHTML(snapshot.periods.previous_day.start_at_utc)} to ${escapeHTML(snapshot.periods.previous_day.end_at_utc)}. Previous futures week: ${escapeHTML(snapshot.periods.previous_week.start_at_utc)} to ${escapeHTML(snapshot.periods.previous_week.end_at_utc)}. Reported highs/lows are unverified without raw bars. Week Open has no source definition. No current quote or saved entry evidence.</p></details></section>`;
}
function decimalDifference(price,level){
  const places=Math.max((price.split('.')[1]||'').length,(level.split('.')[1]||'').length);
  const scale=10n**BigInt(places);
  const scaled=s=>{const [whole,fraction='']=s.split('.');return BigInt(whole)*scale+BigInt(fraction.padEnd(places,'0')||'0');};
  const difference=scaled(price)-scaled(level),absolute=difference<0n?-difference:difference;
  const decimals=places?(absolute%scale).toString().padStart(places,'0').replace(/0+$/,''):'';
  return `${difference>0n?'Above':difference<0n?'Below':'At'}${difference===0n?'':` by ${absolute/scale}${decimals?'.'+decimals:''}`}`;
}
function crossSourceComparisonMarkup(){
  if(!githubSnapshotEnabled)return '';
  const code=selectedGithubInstrument(),market=githubPanel.result?.snapshot,reference=market?.instruments?.[code];
  const yahoo=yahooLatestEnabled?(yahooLatestPanel.symbol===selectedSymbol()?yahooLatestPanel.observation:null):
    (yahooPanel.result?.symbol===selectedSymbol()?yahooPanel.result:null);
  const context=yahooLatestEnabled?null:selectedYahooContext();
  const price=context?.last_completed_observation?.price??yahoo?.price??yahoo?.close;
  const priceTime=context?.last_completed_observation?.end_at_utc??yahoo?.provider_label_utc;
  const tickFactor=code==='CL'?100:4;
  const onGrid=Number.isFinite(Number(price))&&Math.abs(Number(price)*tickFactor-Math.round(Number(price)*tickFactor))<0.000001;
  const qualified=typeof price==='string'&&/^\d+(?:\.\d+)?$/.test(price)&&onGrid&&Number.isFinite(Date.parse(priceTime))&&
    Number.isFinite(Date.parse(market?.generated_at_utc))&&Date.parse(priceTime)>=Date.parse(market.generated_at_utc)&&
    Date.parse(priceTime)<=Date.now()+300000;
  if(!reference||!yahoo||!qualified){
    const reason=!reference?'GitHub levels unavailable.':!yahoo?'Selected Yahoo cached price unavailable.':'Yahoo price label precedes the snapshot, is invalid, or is in the future.';
    return `<section class="entry-market-card"><strong>Yahoo price vs GitHub levels · unavailable</strong><small>${escapeHTML(reason)} No cross-source conclusion or sweep is inferred.</small></section>`;
  }
  const names={previous_day_high:'Previous futures day high',previous_day_low:'Previous futures day low',
    previous_week_high:'Previous futures week high',previous_week_low:'Previous futures week low',midnight_open:'New York midnight open'};
  const rows=Object.entries(names).map(([key,label])=>{
    const level=reference.references[key]?.price;
    return `<li>${escapeHTML(label)} ${escapeHTML(level??'—')}: ${level?escapeHTML(decimalDifference(price,level)):'Unavailable'}</li>`;
  }).join('');
  return `<section class="entry-market-card"><strong>Yahoo price vs GitHub levels · arithmetic only</strong><small>Yahoo ${escapeHTML(yahoo.symbol)} ${escapeHTML(price)} at ${escapeHTML(priceTime)}; GitHub ${escapeHTML(reference.provider_symbol)} snapshot generated ${escapeHTML(market.generated_at_utc)}. Dated contracts, roll rules and feed delay are unverified; these series may differ. A position or difference does not establish a sweep, draw, or trade signal.</small><ul>${rows}</ul></section>`;
}
function selectedYahooContext(){
  const item=yahooPanel.result,c=item?.context;
  if(!phase2PersistentLocal || item?.symbol!==selectedSymbol() || yahooPanel.symbol!==selectedSymbol() ||
     c?.schema_version!=='phase2-yahoo-display-context-v1' || c.series_id!==item.symbol ||
     c.source_revision_sha256!==item.revision || c.fetched_at_utc!==item.fetched_at_utc ||
     c.display_date_ny!==currentNYDate() || c.contract_id!==null ||
     c.verified_market_levels!==false || c.captured_at_entry!==false ||
     !Number.isFinite(Date.parse(c.requested_cutoff_at_utc)) ||
     !Array.isArray(c.opening_references) || c.opening_references.length!==2 ||
     new Set(c.opening_references.map(x=>x.kind)).size!==2 ||
     c.opening_references.some(x=>!['midnight_open','week_open'].includes(x.kind) ||
       (x.price!==null && (!/^-?\d+(?:\.\d+)?$/.test(x.price)||x.status!=='observed_unverified'))) ||
     !Array.isArray(c.windows) || c.windows.length!==20) return null;
  return c;
}
function sourceStateLabel(status){
  return {not_started:'Not started',forming:'Forming',source_pending:'Awaiting source update',
    unavailable:'Unavailable · coverage unresolved',observed_unverified:'Observed · unverified',
    provisional_full_wall_window_observed:'Complete window · unverified'}[status]||'Unavailable';
}
function openingCard(kind,title,context){
  const ref=context?.opening_references.find(x=>x.kind===kind);
  const convention=kind==='midnight_open'?'00:00 NY':'Sunday 18:00 NY';
  return `<div class="entry-market-card"><strong>${title}</strong><span>Price ${escapeHTML(ref?.price??'—')} · ${escapeHTML(ref?.comparison?.display??'—')}</span><small>${convention}${ref?.source_interval?' · '+escapeHTML(ref.source_interval):''} · ${escapeHTML(sourceStateLabel(ref?.status))} · <a href="#data-notes">Details</a></small></div>`;
}
function automaticPreviousMarkup(){
  if(!phase2PersistentLocal) return '';
  const item=yahooPanel.result,coverage=item?.previous_level_coverage;
  if(item?.symbol!==selectedSymbol() || coverage?.symbol!==item.symbol ||
     coverage.source_revision!==item.revision || coverage.schema_version!=='four-level-minute-status-v1')
    return '<details class="source-details"><summary>Previous day/week coverage</summary><p>Unavailable for the selected series.</p></details>';
  const names={previous_day_high:'Previous Day High',previous_day_low:'Previous Day Low',
    previous_week_high:'Previous Week High',previous_week_low:'Previous Week Low'};
  const rows=Object.entries(names).map(([key,label])=>{
    const row=coverage.levels?.[key];
    if(!row) return `<li>${label} · Unavailable</li>`;
    const gaps=row.missing_ranges?.slice(0,3).map(range=>`${range.start_at_ny}–${range.end_at_ny}`).join('; ')||'';
    return `<li><strong>${label} · Unavailable</strong><small>${escapeHTML(row.observed_minute_count)}/${escapeHTML(row.expected_minute_count)} normal-session minutes observed · ${escapeHTML(row.reason)}${gaps?` · gaps ${escapeHTML(gaps)}`:''}${row.missing_ranges_truncated?' · more gaps omitted':''}</small></li>`;
  }).join('');
  return `<details class="source-details"><summary>Previous day/week coverage</summary><p class="helper">${escapeHTML(item.symbol)} · revision ${escapeHTML(item.revision)}. Normal CME hours are a diagnostic expectation; date-specific exchange hours, Yahoo timestamps and dated contract remain unverified. Missing source minutes cannot supply exact highs or lows. No price is populated.</p><ul>${rows}</ul></details>`;
}
function automaticSessionMarkup(){
  const c=selectedYahooContext();
  if(!c) return '';
  const rows=c.windows.map(row=>`<tr><th scope="row">${escapeHTML(row.name)}</th><td>${escapeHTML(row.high??'—')}</td><td>${escapeHTML(row.low??'—')}</td><td>${escapeHTML(sourceStateLabel(row.state))}${row.source_intervals?.length?' · '+escapeHTML(row.source_intervals.join('/')):''}</td></tr>`).join('');
  return `<details class="source-details"><summary>Automatic session references · provisional</summary><p class="helper">${escapeHTML(c.series_id)} · NY ${escapeHTML(c.display_date_ny)} · as of ${escapeHTML(c.requested_cutoff_at_utc)} · fetched ${escapeHTML(c.fetched_at_utc)}. Only ended windows fully covered by completed 1m, 5m or 15m bars have levels. Bars crossing the boundary are excluded. These are high/low references; they do not establish an untouched pool or a sweep. Draw selection remains manual.</p><table><thead><tr><th>Window</th><th>Buy-side high</th><th>Sell-side low</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}
function readSelectedCache(){
  const symbol=selectedSymbol();
  yahooPanel.refreshId++;yahooPanel.refreshing=false;yahooPanel.refreshMessage='';
  yahoo15mPanel.refreshId++;yahoo15mPanel.refreshing=false;yahoo15mPanel.symbol='';yahoo15mPanel.message='';
  yahooPanel.requestId++;
  yahooPanel.symbol=symbol||'';yahooPanel.result=null;
  if(!symbol){yahooPanel.status='unavailable';yahooPanel.message='Selected price source unavailable.';renderEntry();return;}
  readYahooCache(); // Local SQLite GET only; never a provider refresh.
  readYahooLatest(); // Local price-only cache GET; never a Yahoo provider request.
}
async function refreshSelectedPrice(){
  if(!phase2PersistentLocal || !yahooRefreshEnabled || state.screen!=='entry' || yahooPanel.refreshing) return;
  const symbol=selectedSymbol();if(!symbol) return;
  const refreshId=++yahooPanel.refreshId;
  yahooPanel.refreshing=true;yahooPanel.refreshMessage='Refreshing selected price…';renderEntry();
  let message;
  try{
    const response=await fetch('/api/market/yahoo-cache/refresh',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({symbol}),cache:'no-store'});
    if(!response.ok) throw new Error('Refresh unavailable');
    const result=await response.json();
    if(result?.symbol!==symbol || !['refreshed','cached_rate_limited','rate_limited_no_cache'].includes(result.status)) throw new Error('Invalid refresh response');
    message=result.status==='refreshed'?'Selected price refreshed.':result.status==='cached_rate_limited'?'Request limit active; showing cached price.':'Request limit active; no cached price.';
  }catch{message='Refresh unavailable; earlier cache retained.';}
  if(refreshId!==yahooPanel.refreshId || symbol!==selectedSymbol()) return;
  yahooPanel.refreshing=false;yahooPanel.refreshMessage=message;
  await readYahooCache(); // Re-read the selected private cache; no provider request.
}
async function refreshSelected15m(){
  if(!phase2PersistentLocal || !yahoo15mRefreshEnabled || state.screen!=='entry' || yahoo15mPanel.refreshing) return;
  const symbol=selectedSymbol();if(!symbol) return;
  const refreshId=++yahoo15mPanel.refreshId;
  yahoo15mPanel.symbol=symbol;yahoo15mPanel.refreshing=true;
  yahoo15mPanel.message='Refreshing selected 15-minute history…';renderEntry();
  let message;
  try{
    const response=await fetch('/api/market/yahoo-cache/refresh-15m',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({symbol}),cache:'no-store'});
    if(!response.ok) throw new Error('15-minute refresh unavailable');
    const result=await response.json();
    if(result?.symbol!==symbol || result.interval!=='15m' ||
       !['refreshed','cached_rate_limited','rate_limited_no_cache'].includes(result.status) ||
       (result.revision!==null && !/^[0-9a-f]{64}$/.test(result.revision||'')))
      throw new Error('Invalid 15-minute refresh response');
    message=result.status==='refreshed'?`15-minute history cached: ${result.row_count} completed bars. Calendar and contract unverified.`:
      result.status==='cached_rate_limited'?'Shared hourly request limit active; earlier 15-minute history retained.':
      'Shared hourly request limit active; no 15-minute history cached.';
  }catch{message='15-minute refresh unavailable; earlier cache retained.';}
  if(refreshId!==yahoo15mPanel.refreshId || symbol!==selectedSymbol()) return;
  yahoo15mPanel.refreshing=false;yahoo15mPanel.message=message;renderEntry();
}
function hiddenContextActive(){return state.dealingRange.status!=='skipped'||Boolean(state.marketRangeIds?.length||state.marketContextIds.length||state.marketTargetId);}
function hiddenContextSummary(){
  if(!hiddenContextActive())return '';
  const range=state.dealingRange.status==='confirmed'?rangeText(state.dealingRange):state.dealingRange.status;
  const keepable=validRange(state.dealingRange,Boolean(state.marketRangeIds));
  return `<section class="entry-market-card"><strong>Existing context</strong><span>${escapeHTML(range)} · ${state.marketContextIds.length} historical references</span><details class="source-details"><summary>Inspect saved draft context</summary><p>${escapeHTML(range)}</p><p>${state.marketContextIds.length} selected historical reference IDs${state.marketContextIds.length?': '+state.marketContextIds.map(escapeHTML).join(', '):''}. Source must be loaded again before reconfirming historical values.</p></details>${keepable?'<button type="button" class="secondary-button" data-action="hidden-context-keep">Keep this draft context</button>':''}<button type="button" class="text-button" data-action="hidden-context-clear">Clear from this draft</button><p role="status">${!keepable?'This hidden range is incomplete; clear it to continue.':state.hiddenContextReviewed?'Context choice confirmed.':'Choose Keep or Clear before continuing.'}</p></section>`;
}
function renderSimplifiedEntry(){
  const choices=[['NQ_continuous_provisional','NQ'],['ES_unavailable','ES'],['CL_unavailable','CL']]
    .map(([value,name])=>`<option value="${value}" ${state.marketInstrument===value?'selected':''}>${name}</option>`).join('');
  layout('<h1 tabindex="-1">Entry</h1><p class="review-detail">Record the setup you observed. Market references and draw prices are entered manually.</p>',
    `<div class="entry-market-fields"><label>Instrument<select data-market-field="instrument">${state.marketInstrument===''?'<option value="" selected>Choose instrument</option>':''}${choices}</select></label></div>${hiddenContextSummary()}<div class="action-stack"><button type="button" class="primary-button" data-action="entry-continue">Continue to Liquidity →</button></div>`);
}
function renderEntry(){
  if(phase2PersistentLocal && !state.legacyRecovery){renderSimplifiedEntry();return;}
  const snapshot=phase2Client?.getSnapshot()||null;
  const close=snapshot?.price_at_cutoff;
  const price=snapshot?`<div class="entry-market-card"><strong>Historical close at cutoff</strong><span>${close?.price===null?'— / Unavailable':escapeHTML(close?.price)}</span><small>${escapeHTML(close?.price===null?close?.reason:'Completed one-minute candle · '+snapshot.effective_cutoff_at_utc)}</small></div>`:'<div class="entry-market-card"><strong>Price at cutoff</strong><span>— / Not loaded</span></div>';
  layout('<p class="eyebrow">Phase 2 · Entry context</p><h1 tabindex="-1">Entry</h1><p class="review-detail">Choose a historical research snapshot or continue with your own chart observations.</p>',
    `<div class="entry-market-fields"><label>Instrument<select data-market-field="instrument"><option value="" ${state.marketInstrument===''?'selected':''}>Choose an instrument</option><option value="NQ_continuous_provisional" ${state.marketInstrument==='NQ_continuous_provisional'?'selected':''}>NQ continuous · provisional CSV</option><option value="ES_unavailable" ${state.marketInstrument==='ES_unavailable'?'selected':''}>ES · data unavailable here</option></select></label><label>New York display date<input type="date" data-market-field="date" value="${escapeHTML(state.marketDateNY)}"></label><label>UTC cutoff (YYYY-MM-DDTHH:MM:SSZ)<input type="text" data-market-field="cutoff" value="${escapeHTML(state.marketCutoffUTC)}" placeholder="2026-11-03T21:50:00Z"></label></div><button type="button" class="secondary-button" data-action="entry-available">Use declared fallback cutoff</button><p class="helper">Checks the local historical file only. Its completion cutoff is an assumption, not a live or complete-market claim.</p><button type="button" class="secondary-button" data-action="entry-load">Load historical snapshot</button><p id="entry-market-status" class="helper" role="status">${escapeHTML(state.marketMessage)}</p><div id="entry-market-result">${snapshot?'<p class="historical-warning">Historical fallback · unverified. Not a current or executable quote.</p><p class="helper">'+escapeHTML(snapshot.instrument_id)+' · '+escapeHTML(snapshot.series_id)+' · '+escapeHTML(snapshot.price_basis)+' · cutoff '+escapeHTML(snapshot.effective_cutoff_at_utc)+' · contract and receipt unknown.</p>':''}${price}<div class="entry-market-opens"><div class="entry-market-card"><strong>Midnight Open</strong><span>— / Unavailable</span><small>Opening policy unconfirmed</small></div><div class="entry-market-card"><strong>Week Open</strong><span>— / Unavailable</span><small>Trading-week calendar unresolved</small></div></div></div><p class="helper">Historical reconstruction only: context is not entry-time evidence. A chosen draw must have formed and have a research cutoff no later than the entry time, but its receipt at entry remains unverified. ${phase2PreviewEnabled?(phase2PersistentLocal?'In this private Mac app, selected references can be stored as unverified context.':'In the temporary Phase 2 preview, selected references can be stored as unverified context.'):'It is read only and not attached to saved reviews.'} Existing manual Liquidity, Skip and checklist flow remain available.</p>${yahooCacheMarkup()}<div class="action-stack"><button type="button" class="primary-button" data-action="entry-continue">Continue to Liquidity →</button></div>`);
}
async function loadEntryMarket(){
  restoreManualTarget();restoreManualRange();state.marketContextIds=[];state.marketContextError='';
  if(state.marketInstrument!=='NQ_continuous_provisional'){
    state.marketMessage=state.marketInstrument==='ES_unavailable'?'ES historical fallback is unavailable here. Continue with your own chart.':'Choose the provisional NQ fallback or continue manually.';
    renderEntry();return;
  }
  if(!phase2Client){state.marketMessage='Historical snapshot loading is unavailable. Continue manually.';renderEntry();return;}
  if(!phase2Client.select(state.marketDateNY,state.marketCutoffUTC)){
    state.marketMessage=phase2Client.error;renderEntry();return;
  }
  state.marketMessage='Loading historical fallback…';renderEntry();
  const request=++entryMarketLoadSequence,selectedClient=phase2Client;
  const loaded=await phase2Client.load();
  if(request!==entryMarketLoadSequence || selectedClient!==phase2Client) return;
  state.marketMessage=loaded?'Historical snapshot loaded for research. Its prices remain unverified.':phase2Client.error;
  if(state.screen==='entry') renderEntry();
  else if(state.screen==='liquidity') renderLiquidity();
}
async function loadHistoricalChart(snapshot){
  const request=++historicalChart.request;
  historicalChart.response=null;historicalChart.status='loading';
  try{
    const url=`/api/market/candles?date=${encodeURIComponent(snapshot.display_date_ny)}&cutoff=${encodeURIComponent(snapshot.requested_cutoff_at_utc.replace('+00:00','Z'))}&snapshot=${encodeURIComponent(snapshot.snapshot_id)}`;
    const response=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok) throw new Error('Historical candles unavailable');
    const data=await response.json();
    if(data?.schema_version!=='phase2-private-candles-v1' || data.mode!=='historical_fallback_unverified' ||
       data.snapshot_id!==snapshot.snapshot_id || data.source_revision_sha256!==snapshot.source_revision_sha256 ||
       data.instrument_id!==snapshot.instrument_id || data.series_id!==snapshot.series_id ||
       data.price_basis!==snapshot.price_basis || data.cutoff_at_utc!==snapshot.effective_cutoff_at_utc ||
       data.verified_market_candles!==false || data.captured_at_entry!==false || data.exchange_day_verified!==false ||
       data.display_window!=='last_240_completed_one_minute_slots' || data.time_zone!=='America/New_York' ||
       !Array.isArray(data.slots) || data.slots.length!==240 ||
       Date.parse(data.slots[239].start_at_utc)+60000!==Math.floor(Date.parse(data.cutoff_at_utc)/60000)*60000 ||
       data.slots.some((slot,index)=>{
         const time=Date.parse(slot.start_at_utc),previous=index?Date.parse(data.slots[index-1].start_at_utc):time-60000;
         const values=[slot.open,slot.high,slot.low,slot.close];
         return !Number.isFinite(time) || time!==previous+60000 || time+60000>Date.parse(data.cutoff_at_utc) ||
           !(values.every(value=>value===null) || values.every(value=>typeof value==='string' && Number.isFinite(Number(value)))) ||
           (values[0]!==null && (Number(values[1])<Math.max(Number(values[0]),Number(values[3])) || Number(values[2])>Math.min(Number(values[0]),Number(values[3]))));
       }) || data.observed_slots!==data.slots.filter(slot=>slot.open!==null).length ||
       data.missing_slots!==240-data.observed_slots) throw new Error('Historical candles do not match the snapshot');
    if(request!==historicalChart.request || phase2Client?.getSnapshot()?.snapshot_id!==snapshot.snapshot_id) return;
    historicalChart.response=data;historicalChart.status='ready';
  }catch{
    if(request!==historicalChart.request) return;
    historicalChart.status='unavailable';
  }
  if(state.screen==='liquidity') renderLiquidity();
}
function historicalCandleTable(data){
  const rows=data.slots.map(slot=>`<tr><th scope="row">${escapeHTML(slot.start_at_utc)}</th>${slot.open===null?'<td colspan="4">Missing observation</td>':`<td>${escapeHTML(slot.open)}</td><td>${escapeHTML(slot.high)}</td><td>${escapeHTML(slot.low)}</td><td>${escapeHTML(slot.close)}</td>`}</tr>`).join('');
  return `<details class="historical-candle-data"><summary>One-minute OHLC data · ${data.observed_slots} observed, ${data.missing_slots} missing</summary><div class="historical-chart-scroll"><table><caption>Historical, unverified one-minute slots through the cutoff; times are UTC. Missing rows contain no inferred prices.</caption><thead><tr><th scope="col">UTC bar start</th><th scope="col">Open</th><th scope="col">High</th><th scope="col">Low</th><th scope="col">Close</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}
function historicalPriceChart(snapshot){
  if(!phase2PreviewEnabled) return '';
  const data=historicalChart.response;
  if(!data || data.snapshot_id!==snapshot.snapshot_id) return `<section class="historical-chart"><h3>Historical price action · private preview</h3><p class="helper">${historicalChart.status==='loading'?'Loading bounded one-minute candles…':historicalChart.status==='unavailable'?'Candles unavailable; use the numeric level list and your own chart.':'Load a bounded historical candle slice only if you want to inspect price action.'}</p><button type="button" class="secondary-button" data-action="chart-load" ${historicalChart.status==='loading'?'disabled':''}>Load historical chart</button></section>`;
  const windows=[];
  for(let index=0;index<snapshot.session_references.length;index+=3) windows.push(snapshot.session_references.slice(index,index+3));
  const chosen=windows.find(group=>group[0].window_id===historicalChart.windowId)||windows.find(group=>group.some(ref=>ref.price!==null))||windows[0];
  const priced=chosen.filter(ref=>ref.price!==null && ref.occurrence_end_at_utc && Date.parse(ref.occurrence_end_at_utc)<=Date.parse(data.cutoff_at_utc));
  const bars=data.slots.map((slot,index)=>slot.open===null?null:{index,open:Number(slot.open),high:Number(slot.high),low:Number(slot.low),close:Number(slot.close)}).filter(Boolean);
  if(!bars.length) return `<section class="historical-chart"><h3>Historical price action · unverified</h3><p>No completed fallback candles in this 240-minute slice. ${data.missing_slots} missing slots; no prices inferred.</p>${historicalCandleTable(data)}</section>`;
  const values=[...bars.flatMap(bar=>[bar.high,bar.low]),...priced.map(ref=>Number(ref.price))].filter(Number.isFinite),minimum=Math.min(...values),maximum=Math.max(...values),spread=Math.max(maximum-minimum,0.01);
  const y=price=>250-(price-minimum)/spread*215,x=index=>42+index*3.7;
  const barSvg=bars.map(bar=>{const color=bar.close>=bar.open?'#267a57':'#af5550',top=Math.min(y(bar.open),y(bar.close)),height=Math.max(1,Math.abs(y(bar.open)-y(bar.close)));return `<path d="M${x(bar.index)} ${y(bar.high)}V${y(bar.low)}" stroke="${color}"/><rect x="${x(bar.index)-1.3}" y="${top}" width="2.6" height="${height}" fill="${color}"/>`;}).join('');
  const lines=priced.map(ref=>{const color=ref.kind==='high'?'#a64c42':ref.kind==='low'?'#236a9a':'#80622b',pattern=ref.kind==='high'?'9 3':ref.kind==='low'?'2 4':'4 2 1 2';return `<path d="M40 ${y(Number(ref.price))}H930" stroke="${color}" stroke-dasharray="${pattern}"/>`;}).join('');
  const nyClock=new Intl.DateTimeFormat('en-GB',{timeZone:'America/New_York',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
  const firstNY=nyClock.format(new Date(data.slots[0].start_at_utc)),lastNY=nyClock.format(new Date(data.cutoff_at_utc));
  return `<section class="historical-chart"><h3>Historical price action · provisional/unverified</h3><p class="helper">One-minute fallback, last 240 slots through the final completed minute at or before cutoff ${escapeHTML(data.cutoff_at_utc)} · New York ${escapeHTML(firstNY)} to ${escapeHTML(lastNY)} · ${data.observed_slots} observed, ${data.missing_slots} gaps. This is a display slice, not a verified exchange trading day, live quote or entry-time capture.</p><label>Session level overlay<select data-chart-window>${windows.map(group=>`<option value="${escapeHTML(group[0].window_id)}" ${group===chosen?'selected':''}>${escapeHTML(group[0].window_name)}</option>`).join('')}</select></label><div class="historical-chart-scroll"><svg viewBox="0 0 940 265" role="img" aria-label="Historical one-minute candles and selected session reference levels. Missing minutes are blank gaps; exact values follow in text."><path d="M40 35H930 M40 143H930 M40 250H930" stroke="#d2d9d3"/>${barSvg}${lines}</svg></div><p class="helper">Blank candle positions are missing observations, not flat prices. High is long-dashed, low short-dashed, midpoint dot-dashed. Lines reflect only formed selected-window references; they do not certify a sweep or target.</p><ul>${chosen.map(ref=>`<li>${escapeHTML(ref.window_name)} ${escapeHTML(ref.kind)} · ${ref.price===null?'Unavailable':escapeHTML(ref.price)} · ${escapeHTML(ref.status)} · window ${escapeHTML(ref.occurrence_start_at_utc||'unavailable')} to ${escapeHTML(ref.occurrence_end_at_utc||'unavailable')}</li>`).join('')}</ul>${historicalCandleTable(data)}</section>`;
}
function sharedSnapshotMarkup(){
  const snapshot=phase2Client?.getSnapshot();
  if(!snapshot) return historicalContextMarkup();
  const relationText={above:'Above',below:'Below',at:'At level'};
  const rows=[];
  for(let index=0;index<snapshot.session_references.length;index+=3){
    const group=snapshot.session_references.slice(index,index+3),first=group[0];
    const eligibleRange=group.every(item=>item.price!==null&&item.window_status==='observed_ended_unverified'&&item.status==='observed_unverified') && Number(group[0].price)>Number(group[2].price);
    const activeRange=state.marketRangeIds?.[0]===first.reference_id;
    rows.push(`<section class="historical-row"><h3>${escapeHTML(first.window_name)}</h3><p class="helper">${escapeHTML(first.window_status)} · ${escapeHTML(first.coverage_status)}</p>${phase2PreviewEnabled&&eligibleRange?`<p>High ${escapeHTML(group[0].price)} · 50% ${escapeHTML(group[1].price)} · Low ${escapeHTML(group[2].price)}</p><button type="button" class="secondary-button" data-market-range="${escapeHTML(first.reference_id)}" aria-pressed="${Boolean(activeRange)}" aria-label="${escapeHTML(`${activeRange?'Remove':'Confirm'} ${first.window_name} provisional historical range`)}">${activeRange?'✓ Historical range confirmed':'Confirm this historical range'}</button>`:''}<div class="historical-slots">${group.map((item,offset)=>{const comparison=snapshot.session_comparisons[index+offset],selected=state.marketContextIds.includes(item.reference_id),target=state.marketTargetId===item.reference_id,eligible=['high','low'].includes(item.kind)&&item.price!==null&&item.window_status==='observed_ended_unverified'&&item.status==='observed_unverified'&&comparison.status==='historical_provisional_comparison';return `<div><strong>${escapeHTML(item.kind)}</strong><span>${item.price===null?'Unavailable':escapeHTML(item.price)}</span><small>${comparison.status==='historical_provisional_comparison'?`% vs level ${escapeHTML(comparison.percent_display)} · ${relationText[comparison.position]}`:'% vs level — / Unavailable'}</small><small>${escapeHTML(item.status)}</small>${phase2PreviewEnabled?`<button type="button" class="market-context-choice" data-market-ref="${escapeHTML(item.reference_id)}" aria-pressed="${selected}" aria-label="${escapeHTML(`${selected?'Remove':'Add'} ${item.window_name} ${item.kind} ${item.price===null?'unavailable historical level':`provisional level ${item.price}`} ${selected?'from':'to'} historical context`)}">${selected?'✓ Added':'Add context'}</button>${eligible?`<button type="button" class="market-context-choice" data-market-target="${escapeHTML(item.reference_id)}" aria-pressed="${target}" aria-label="${escapeHTML(`${target?'Remove':'Choose'} ${item.window_name} ${item.kind} provisional level ${item.price} as intended draw; ${target?'restore manual target':'include as saved context'}`)}">${target?'✓ Intended draw':'Choose intended draw'}</button>`:''}`:''}</div>`;}).join('')}</div></section>`);
  }
  return `<details class="liquidity-section historical-panel" ${phase2PreviewEnabled?'open':''}><summary>Historical session levels and % vs level · same Entry snapshot</summary><p class="historical-warning">Provisional fallback · unverified prices and distances. + means close above the level; − means below; At means exact equality, not a confirmed touch. No sweep, target, range or checklist answer is selected automatically.</p><p class="helper">${escapeHTML(snapshot.instrument_id)} · ${escapeHTML(snapshot.effective_cutoff_at_utc)} · source revision ${escapeHTML(snapshot.source_revision_sha256.slice(0,12))}… · contract, calendar and receipt unverified. Context remains retrospective, not entry-time evidence. A chosen draw or range must have formed and have a research cutoff no later than the entry time; receipt at entry remains unverified. ${phase2PreviewEnabled?'Select up to 14 reference IDs as context. Confirming a historical range is a separate choice; it preserves your manual range draft and never answers model checks.':'This context is not yet saved with the review.'}</p>${historicalPriceChart(snapshot)}${phase2PreviewEnabled?`<p class="helper" role="status">${state.marketContextIds.length}/14 references selected. ${escapeHTML(state.marketContextError)}</p>`:''}<div class="historical-rows">${rows.join('')}</div></details>`;
}
function selectMarketRange(highId){
  if(!phase2PreviewEnabled) return;
  if(state.marketRangeIds?.[0]===highId){restoreManualRange();renderLiquidity();persistDraft();focusMarketRange(highId);return;}
  const snapshot=phase2Client?.getSnapshot(),index=snapshot?.session_references?.findIndex(row=>row.reference_id===highId);
  if(index===undefined || index<0 || index%3!==0) return;
  const group=snapshot.session_references.slice(index,index+3);
  if(group.length!==3 || group.map(row=>row.kind).join(',')!=='high,midpoint,low' ||
     group.some(row=>row.window_id!==group[0].window_id || row.price===null ||
       row.window_status!=='observed_ended_unverified' || row.status!=='observed_unverified') ||
     !(Number(group[0].price)>Number(group[2].price))) return;
  if(!state.marketRangeIds) state.manualRangeDraft=JSON.parse(JSON.stringify(state.dealingRange));
  state.marketRangeIds=group.map(row=>row.reference_id);
  state.dealingRange={status:'source_selected'};state.rangeError='';state.draftActive=true;
  renderLiquidity();persistDraft();focusMarketRange(highId);
}
function focusMarketRange(highId){
  [...(screen.querySelectorAll?.('[data-market-range]')||[])]
    .find(button=>button.dataset?.marketRange===highId)?.focus({preventScroll:true});
}
function selectMarketReference(id){
  if(!phase2PreviewEnabled || !phase2Client?.getSnapshot()) return;
  const snapshot=phase2Client.getSnapshot();
  if(!snapshot.session_references.some(item=>item.reference_id===id)) return;
  if(state.marketContextIds.includes(id)){if(state.marketTargetId===id) restoreManualTarget();state.marketContextIds=state.marketContextIds.filter(item=>item!==id);state.marketContextError='';}
  else if(state.marketContextIds.length<14){state.marketContextIds=[...state.marketContextIds,id];state.marketContextError='';}
  else state.marketContextError='Choose no more than 14 references.';
  renderLiquidity();persistDraft();
  const sameButton=[...(screen.querySelectorAll?.('[data-market-ref]')||[])].find(button=>button.dataset?.marketRef===id);
  sameButton?.focus({preventScroll:true});
}
function selectMarketTarget(id){
  if(!phase2PreviewEnabled || !phase2Client?.getSnapshot()) return;
  if(state.marketTargetId===id){restoreManualTarget();state.marketContextError='';renderLiquidity();persistDraft();return;}
  const snapshot=phase2Client.getSnapshot(),index=snapshot.session_references.findIndex(row=>row.reference_id===id);
  const ref=snapshot.session_references[index],comparison=snapshot.session_comparisons?.[index];
  if(!ref || !['high','low'].includes(ref.kind) || ref.price===null ||
     ref.window_status!=='observed_ended_unverified' || ref.status!=='observed_unverified' ||
     comparison?.status!=='historical_provisional_comparison' || comparison.reference_id!==id) return;
  if(!state.marketContextIds.includes(id) && state.marketContextIds.length>=14){
    state.marketContextError='Remove a context reference before choosing an intended draw.';renderLiquidity();return;
  }
  if(!state.marketTargetId) state.manualTargetDraft=state.liquidity.target?{...state.liquidity.target}:null;
  if(!state.marketContextIds.includes(id)) state.marketContextIds=[...state.marketContextIds,id];
  state.marketTargetId=id;
  state.liquidity.skipped=false;
  state.liquidity.target={type:ref.kind==='high'?'session_high':'session_low',label:`${ref.window_id} · NY ${snapshot.display_date_ny}`};
  state.marketContextError='';state.liquidityError='';state.draftActive=true;
  renderLiquidity();persistDraft();
  [...(screen.querySelectorAll?.('[data-market-target]')||[])].find(button=>button.dataset?.marketTarget===id)?.focus({preventScroll:true});
}
function historicalContextMarkup(){
  const result=historicalPanel.response;
  let content='';
  if(result){
    const context=result.context;
    content=`<p class="historical-warning">Historical fallback · unverified prices. Not a current quote or a confirmed NQ contract.</p><p class="helper">${escapeHTML(result.instrument_id)} · ${escapeHTML(result.price_basis)} · observed grid ${escapeHTML(result.observed_tick_grid)} · NY date ${escapeHTML(context.display_date_ny)} · cutoff ${escapeHTML(context.cutoff_at_utc)}. Exchange calendar, contract identity and entry-time capture are unverified.</p><div class="historical-rows">${context.rows.map(row=>`<section class="historical-row"><h3>${escapeHTML(row.name)}</h3><p class="helper">${escapeHTML(row.status)} · ${escapeHTML(row.coverage_status)}</p><div class="historical-slots">${row.slots.map(slot=>`<div><strong>${escapeHTML(slot.kind)}</strong><span>${slot.price===null?'Unavailable':escapeHTML(slot.price)}</span><small>${escapeHTML(slot.status)}</small></div>`).join('')}</div></section>`).join('')}</div>`;
  }
  return `<details class="liquidity-section historical-panel" ${historicalPanel.open?'open':''}><summary>Historical session levels · provisional fallback</summary><p class="helper">Optional local research view. Load a dated snapshot explicitly; the values never select liquidity, confirm a range, answer checks or enter saved history. This source is not live.</p><div class="historical-fields"><label>New York display date<input type="date" data-historical-field="date" value="${escapeHTML(historicalPanel.date)}"></label><label>UTC cutoff (YYYY-MM-DDTHH:MM:SSZ)<input type="text" data-historical-field="cutoff" value="${escapeHTML(historicalPanel.cutoff)}" placeholder="2026-11-03T21:50:00Z" inputmode="text"></label></div><button type="button" class="secondary-button" data-action="historical-load" ${historicalPanel.status==='loading'?'disabled':''}>${historicalPanel.status==='loading'?'Loading historical snapshot…':'Load historical snapshot'}</button><p id="historical-status" class="helper" role="status">${escapeHTML(historicalPanel.message)}</p><div id="historical-result">${content}</div></details>`;
}
async function loadHistoricalContext(){
  historicalPanel.open=true;historicalPanel.response=null;historicalPanel.status='loading';historicalPanel.message='Reading local historical fallback…';
  const request=++historicalPanel.request,date=historicalPanel.date,cutoff=historicalPanel.cutoff;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(cutoff)){
    historicalPanel.status='error';historicalPanel.message='Enter a New York date and an explicit UTC cutoff.';renderLiquidity();return;
  }
  renderLiquidity();
  try{
    const response=await fetch(`/api/market/context?date=${encodeURIComponent(date)}&cutoff=${encodeURIComponent(cutoff)}`,{headers:{Accept:'application/json'},cache:'no-store'});
    if(!response.ok) throw new Error(response.status===503?'Historical fallback is not configured or its source is unavailable.':'Historical snapshot unavailable for that date and cutoff.');
    const data=await response.json(),context=data?.context;
    if(data.mode!=='historical_fallback_unverified' || context?.verified_market_levels!==false || context?.captured_at_entry!==false || context?.contract_id!==null || !Array.isArray(context.rows) || context.rows.length!==20 || context.rows.some(row=>!Array.isArray(row.slots) || row.slots.length!==3) || !data.instrument_id || !data.price_basis || !data.observed_tick_grid) throw new Error('Unexpected historical fallback response.');
    if(request!==historicalPanel.request) return;
    historicalPanel.response=data;historicalPanel.status='ready';historicalPanel.message='Historical snapshot loaded. All displayed levels remain unverified.';
  }catch(error){
    if(request!==historicalPanel.request) return;
    historicalPanel.status='error';historicalPanel.message=error.message||'Historical snapshot unavailable.';
  }
  if(state.screen==='liquidity') renderLiquidity();
}
function drawRowsMarkup(){
  if(!phase2PersistentLocal || state.legacyRecovery) return '';
  return `<div class="draw-rows" role="group" aria-label="Manual draw prices">${['buy','sell'].map(side=>{
    const row=state.liquidityDraws[side],types=side==='buy'?buySideSweeps:sellSideSweeps;
    const label=side==='buy'?'Buy-side draw':'Sell-side draw';
    const needsSession=row.type.startsWith('session_'),needsTimeframe=row.type.startsWith('equal_')||row.type.startsWith('swing_');
    const choices=needsSession?rangeSessions:needsTimeframe?rangeTimeframes:[];
    return `<section class="draw-row" aria-labelledby="draw-${side}-title"><div class="draw-row-header"><h3 id="draw-${side}-title">${label}</h3><span>${side==='buy'?'Highs':'Lows'} · required</span></div><div class="draw-row-fields ${choices.length?'has-detail':''}"><div class="draw-field"><label for="draw-${side}-type">Draw type</label><select id="draw-${side}-type" data-draw-side="${side}" data-draw-field="type" required><option value="">Select type</option>${types.map(type=>`<option value="${type}" ${row.type===type?'selected':''}>${escapeHTML(liquidityTypes[type])}</option>`).join('')}</select></div>${choices.length?`<div class="draw-field"><label for="draw-${side}-detail">${needsSession?'Session':'Timeframe'}</label><select id="draw-${side}-detail" data-draw-side="${side}" data-draw-field="detail" required><option value="">Select ${needsSession?'session':'timeframe'}</option>${choices.map(choice=>`<option value="${choice}" ${row.detail===choice?'selected':''}>${escapeHTML(choice==='new_york'?'New York':choice.charAt(0).toUpperCase()+choice.slice(1))}</option>`).join('')}</select></div>`:''}<div class="draw-field"><label for="draw-${side}-price">Price</label><input id="draw-${side}-price" data-draw-side="${side}" data-draw-field="price" type="text" inputmode="decimal" maxlength="32" value="${escapeHTML(row.price)}" placeholder="Enter price" required></div></div></section>`;
  }).join('')}</div>`;
}
function drawSummary(draws){
  if(!validDraws(draws)) return '';
  return `<div class="liquidity-summary"><p><span>Buy-side draw</span> ${escapeHTML(liquidityTypes[draws.buy.type])}${draws.buy.detail?` · ${escapeHTML(draws.buy.detail)}`:''} · ${escapeHTML(draws.buy.price)}</p><p><span>Sell-side draw</span> ${escapeHTML(liquidityTypes[draws.sell.type])}${draws.sell.detail?` · ${escapeHTML(draws.sell.detail)}`:''} · ${escapeHTML(draws.sell.price)}</p><small>Manual observations; not source-verified or scored.</small></div>`;
}
function requiresDraws(){return phase2PersistentLocal && !state.legacyRecovery && !state.marketContextIds.length && !state.marketRangeIds;}
function renderLiquidity(){
  const choices=(field,types=Object.keys(liquidityTypes))=>types.filter(type=>field==='swept'?type!=='not_decided':!exclusiveSweeps.has(type)).map(type=>{
    const label=liquidityTypes[type];
    const selected=field==='swept'?state.liquidity.swept.find(item=>item.type===type):state.marketTargetId?null:state.liquidity.target?.type===type?state.liquidity.target:null;
    return `<div class="liquidity-option"><button type="button" class="liquidity-choice" data-liquidity="${field}" data-type="${type}" aria-pressed="${Boolean(selected)}"><span aria-hidden="true">${selected?'✓':'+'}</span>${label}</button>${selected && describedLiquidity.has(type)?`<label class="reference-label">${type==='other'?'Description':'Identifying label'}<input type="text" maxlength="160" data-liquidity-label="${field}" data-type="${type}" value="${escapeHTML(selected.label)}" placeholder="${type==='other'?'Describe this reference':type.startsWith('session')?'e.g. London low':'e.g. 15-minute swing high'}" required></label>`:''}</div>`;
  }).join('');
  const sweptChoices=`<div class="swept-liquidity-columns"><div class="swept-liquidity-column" role="group" aria-label="Buy-side swept liquidity"><h3>Buy-side · highs</h3><div class="liquidity-options">${choices('swept',buySideSweeps)}</div></div><div class="swept-liquidity-column" role="group" aria-label="Sell-side swept liquidity"><h3>Sell-side · lows</h3><div class="liquidity-options">${choices('swept',sellSideSweeps)}</div></div></div><div class="liquidity-options swept-liquidity-neutral" role="group" aria-label="Other swept observations">${choices('swept',neutralSweeps)}</div>`;
  const returnToReview=state.liquidityReturn==='review' && state.model;
  layout(`<p class="eyebrow">Entry review · ${requiresDraws()?'Manual liquidity':'Optional context'}</p><h1 tabindex="-1">Liquidity</h1><p class="review-detail">Record the liquidity you observed and your intended draw.</p>`,`<button type="button" class="text-button" data-action="entry">← Entry context</button>${requiresDraws()?'':'<button type="button" class="secondary-button" data-action="liquidity-skip">Skip for now</button>'}${state.liquidity.skipped && (state.liquidity.swept.length || state.liquidity.target)?'<button type="button" class="text-button" data-action="liquidity-restore">Use previous liquidity selections</button>':''}<details class="liquidity-section" ${state.liquidityOpen==='swept'?'open':''}><summary>What liquidity was swept?</summary><p class="helper">Select all that apply. No sweep and Not sure are exclusive.</p>${sweptChoices}</details><details class="liquidity-section" ${state.liquidityOpen==='target'?'open':''}><summary>What is your target liquidity?</summary><p class="helper">${phase2PersistentLocal?'Choose one primary target.':'Choose one primary target. A historical intended draw is provisional; choosing a manual target switches back without losing the earlier manual draft.'}</p>${state.marketTargetId?`<p class="historical-warning">Historical intended draw active · ${escapeHTML(state.liquidity.target?.label||'')}. Your previous manual target is preserved in this draft.</p><button type="button" class="secondary-button" data-action="target-manual">Return to manual target</button>`:''}<div class="liquidity-options" role="group" aria-label="Target liquidity">${choices('target')}</div></details>${drawRowsMarkup()}${phase2PersistentLocal?'':automaticPreviousMarkup()+automaticSessionMarkup()}<div class="liquidity-summary">${liquiditySummary(state.liquidity)}</div>${phase2PersistentLocal && !state.legacyRecovery?'':rangeForm()+sharedSnapshotMarkup()}<p class="helper">This context has no scoring effect. All required model checks still apply.</p><p id="liquidity-error" class="feedback error" role="alert">${escapeHTML(state.liquidityError)}</p><div class="action-stack"><button type="button" class="primary-button" data-action="liquidity-continue" ${requiresDraws()&&!validCurrentDraws()?'disabled':''}>${returnToReview?'Return to review':'Continue to models'} →</button></div>`);
}
function selectLiquidity(field,type){
  if(!['swept','target'].includes(field) || !Object.hasOwn(liquidityTypes,type)) return;
  if(field==='target') restoreManualTarget();
  const reference={type,label:describedLiquidity.has(type)?'':liquidityTypes[type]};
  state.draftActive=true;state.liquidity.skipped=false;state.liquidityError='';state.liquidityOpen=field;
  if(field==='target' && !exclusiveSweeps.has(type)) state.liquidity.target=state.liquidity.target?.type===type?state.liquidity.target:reference;
  else if(field==='swept' && type!=='not_decided'){
    const exists=state.liquidity.swept.some(item=>item.type===type);
    state.liquidity.swept=exists?state.liquidity.swept.filter(item=>item.type!==type):exclusiveSweeps.has(type)?[reference]:[...state.liquidity.swept.filter(item=>!exclusiveSweeps.has(item.type)),reference];
  }
  renderLiquidity();
  const focus=screen.querySelector(describedLiquidity.has(type)?`[data-liquidity-label="${field}"][data-type="${type}"]`:`[data-liquidity="${field}"][data-type="${type}"]`);
  if(focus) focus.focus({preventScroll:true});
}
function qualityText(snapshot){
  if(!validSnapshot(snapshot)) return 'Detailed score unavailable';
  const yes=snapshot.checks.filter(check=>check.answer==='yes').length,total=snapshot.checks.length;
  return `${yes}/${total} · ${Math.round(yes/total*100)}% checklist`;
}
function outcomeLabel(outcome){return outcome==='not_recorded' || !Object.hasOwn(outcomes,outcome)?'Trade outcome not recorded':outcomes[outcome];}
function instrumentText(snapshot){
  return snapshot?.schema_version===5 ? ({NQ_continuous_provisional:'NQ',ES_unavailable:'ES',CL_unavailable:'CL'}[snapshot.instrument_id]||'Instrument not recorded') : 'Instrument not recorded';
}
function modelScopeNote(id){
  const notes={
    ifvg:'Illustrative iFVG review. Met means the listed self-reported checks were affirmed; it does not certify a complete ICT setup or a source-validated CE threshold.',
    turtle:'This contextual Turtle Soup review does not check the reference level’s age. Met means only the listed checks were affirmed; it does not certify a complete ICT setup.',
    drill_fvg:'This FVG review covers the listed Episode 6 components. Episode 25’s Short-premium-relative-to-its-swing example is outside these scored checks. Met means only the listed checks were affirmed.'
  };
  return notes[id]?`<p class="notice">${notes[id]}</p>`:'';
}
function modelScopeHistoryNote(id){
  return {ifvg:'Illustrative iFVG · self-reported checks',turtle:'Met = listed checks only · reference level age unchecked',drill_fvg:'Met = listed checks only · Episode 25 Short premium relative to swing outside scored checks'}[id]||'';
}
function entrySummary(entry){
  const snapshot=entry.entry_snapshot;
  return `<div class="saved-card"><strong>${escapeHTML(labels[entry.checklist_id]||'Unknown checklist')}</strong><span>${escapeHTML(formatLocal(entry.entry_time_utc))}</span><span>Instrument: ${escapeHTML(instrumentText(snapshot))}</span><span class="${entry.checklist_met?'good':'bad'}">Checklist ${entry.checklist_met?'Met':'Not met'}</span><span class="quality-summary">${qualityText(snapshot)}</span><small>${escapeHTML(versionLabel(entry.checklist_version))}${validSnapshot(snapshot)?` · ${snapshot.direction==='long'?'Long':'Short'}`:''}</small></div>${modelScopeNote(entry.checklist_id)}${nyTimeNote(entry.checklist_id,entry.entry_time_utc)}`;
}
function renderScoreboard(){
  const score=state.scoreboard;
  if(!score) return '<section class="scoreboard"><p class="eyebrow">All time</p><p>Scoreboard unavailable. Refresh to load all-time totals.</p></section>';
  const percentage=value=>typeof value==='number' && Number.isFinite(value)?`${Math.round(value)}%`:'—';
  return `<section class="scoreboard" aria-label="All-time scoreboard"><div class="scoreboard-title"><h2>Scoreboard</h2><span>All time</span></div><div class="score-grid"><div><strong>${score.win_points}</strong><span>Win points</span><small>${score.closed_trades} closed trades · +1 per win</small></div><div><strong>${percentage(score.win_rate)}</strong><span>Win rate</span><small>${score.wins} wins / ${score.closed_trades} closed trades</small></div><div><strong>${percentage(score.average_checklist_quality)}</strong><span>Average checklist quality</span><small>${score.scored_reviews} scored reviews</small></div><div><strong>${percentage(score.full_checklist_rate)}</strong><span>Full-checklist rate</span><small>${score.full_checklist_reviews} / ${score.scored_reviews} scored reviews</small></div></div><p class="helper">${score.total_reviews} total reviews · ${score.scored_reviews} scored · ${score.unavailable_reviews} detailed scores unavailable</p><p class="helper">Closed trades: ${score.wins} Win · ${score.losses} Loss · ${score.break_even} Break-even</p>${score.closed_trades===0?'<p class="helper">Record an outcome to see your win rate.</p>':''}<details class="source-details"><summary>How scoring works</summary><p>One point per Win. Win rate includes Win, Loss and Break-even; Open, Not taken and Not recorded are excluded.</p><p>Checklist quality is the percentage of required Yes answers, including illustrative iFVG reviews. Each scored review has equal weight in the average. Full-checklist rate counts reviews with every required answer Yes. These are self-reported checklist measures, not source certification.</p><p>Liquidity and manual draw rows add no points or penalty. Older entries without individual answers keep their original result and do not enter quality averages.</p></details></section>`;
}
function openOutcome(){state.outcomeSaved=false;state.outcomeSelection=Object.hasOwn(outcomes,state.selectedEntry?.outcome)?state.selectedEntry.outcome:'not_recorded';state.outcomeMessage=null;show('outcome');}
async function saveOutcome(){
  if(state.saving || !state.selectedEntry || !Object.hasOwn(outcomes,state.outcomeSelection)) return;
  const entry=state.selectedEntry,outcome=state.outcomeSelection;
  state.saving=true;state.outcomeMessage=null;state.outcomeSaved=false;render();
  try{
    const updated=await fetchEntriesJSON({method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({outcome})},`/api/entries/${entry.id}/outcome`);
    if(!updated || updated.id!==entry.id || updated.outcome!==outcome) throw new Error('Unexpected response');
    state.selectedEntry={...entry,outcome:updated.outcome,outcome_updated_at:updated.outcome_updated_at};
    if(state.savedEntry?.id===entry.id) state.savedEntry=state.selectedEntry;
    state.outcomeSaved=true;state.saving=false;syncSavingControls();show('detail');await loadEntries();
  }catch{
    state.saving=false;syncSavingControls();state.outcomeMessage='Outcome could not be confirmed. Retry saving your selected outcome.';render();
  }
}

const $ = (id) => document.getElementById(id);
let entryLoadSequence = 0;
const saveAttempts = new Map();
const savingControls = new Map();
const draftStorageKey = "ict-entry-desk-draft-v1";
function draftSnapshot(){
  const time=parsedEntryTime();
  return {entryTimeUtc:time.valid?time.iso:null,inputTimeZone:deviceTimeZone(),liquidityReturn:state.liquidityReturn,checklistVersion:checklistVersionFor(state.model),draftActive:state.draftActive,marketInstrument:state.marketInstrument,marketDateNY:state.marketDateNY,marketCutoffUTC:state.marketCutoffUTC,legacyRecovery:state.legacyRecovery,marketTargetId:state.marketTargetId,manualTargetDraft:state.manualTargetDraft?{...state.manualTargetDraft}:null,marketRangeIds:state.marketRangeIds?[...state.marketRangeIds]:null,manualRangeDraft:state.manualRangeDraft?JSON.parse(JSON.stringify(state.manualRangeDraft)):null,liquidity:JSON.parse(JSON.stringify(state.liquidity)),liquidityDraws:JSON.parse(JSON.stringify(state.liquidityDraws)),dealingRange:JSON.parse(JSON.stringify(state.dealingRange)),model:state.model,direction:state.direction,variant:state.variant,
    answers:{...state.answers},dateValue:state.dateValue,clockValue:state.clockValue,
    screen:["detail","outcome","saved"].includes(state.screen)?state.returnScreen:state.screen,returnScreen:state.returnScreen,questionIndex:state.questionIndex};
}
function persistDraft(){
  try{
    if(!state.draftActive && !state.model && !saveAttempts.size && !state.undoDraft) sessionStorage.removeItem(draftStorageKey);
    else sessionStorage.setItem(draftStorageKey,JSON.stringify({...draftSnapshot(),draftVersion:4,
      saveAttempts:[...saveAttempts],rejectedSave:state.rejectedSave,undoDraft:state.undoDraft}));
    state.storageAvailable=true;updateDraftStatus();return true;
  }catch{state.storageAvailable=false;updateDraftStatus();return false;}
}
function applyDraft(draft){
  if(!draft || !(models.some(model=>model.id===draft.model) || (draft.model===null && draft.draftActive===true)) ||
     !["long","short"].includes(draft.direction) || !["fvg","wick"].includes(draft.variant)) return false;
  state.model=draft.model;state.direction=draft.direction;state.variant=draft.variant;
  state.legacyRecovery=draft.legacyRecovery===true || Boolean(draft.marketTargetId) || draft.dealingRange?.status==='source_selected';
  state.marketInstrument=['','NQ_continuous_provisional','ES_unavailable','CL_unavailable'].includes(draft.marketInstrument)?draft.marketInstrument:'';
  state.marketDateNY=typeof draft.marketDateNY==='string' && /^\d{4}-\d{2}-\d{2}$/.test(draft.marketDateNY)?draft.marketDateNY:'';
  state.marketCutoffUTC=typeof draft.marketCutoffUTC==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(draft.marketCutoffUTC)?draft.marketCutoffUTC:'';
  state.marketMessage='Historical data must be loaded again after restoring this draft.';
  state.marketContextIds=[];state.marketContextError='';
  state.liquidityReturn=draft.liquidityReturn==='review'?'review':'home';
  state.draftActive=true;state.liquidity=validLiquidity(draft.liquidity,true) ? JSON.parse(JSON.stringify(draft.liquidity)) : {skipped:true,swept:[],target:null};
  state.liquidityError=invalidLiquidityLabel(state.liquidity)?'Remove control characters from liquidity labels before continuing.':'';
  state.liquidityDraws=emptyDraws();
  for(const side of ['buy','sell']){
    const row=draft.liquidityDraws?.[side];
    if(!row || typeof row!=='object') continue;
    const types=side==='buy'?buySideSweeps:sellSideSweeps;
    if(types.includes(row.type)) state.liquidityDraws[side].type=row.type;
    if(typeof row.detail==='string' && [...rangeSessions,...rangeTimeframes].includes(row.detail)) state.liquidityDraws[side].detail=row.detail;
    if(typeof row.price==='string' && row.price.length<=32) state.liquidityDraws[side].price=row.price;
  }
  state.marketTargetId=null;state.manualTargetDraft=null;
  if(typeof draft.marketTargetId==='string' && draft.marketTargetId.length>0){
    const prior=draft.manualTargetDraft;
    state.liquidity.target=prior && validLiquidity({skipped:false,swept:[],target:prior},true)?{...prior}:null;
    state.draftNotice='Historical intended draw needs a fresh snapshot and explicit reconfirmation. Your manual target draft was restored.';
  }
  state.dealingRange=validRange(draft.dealingRange) ? JSON.parse(JSON.stringify(draft.dealingRange)) : {status:'skipped'};
  state.marketRangeIds=null;state.manualRangeDraft=null;
  if(draft.dealingRange?.status==='source_selected'){
    state.dealingRange=validRange(draft.manualRangeDraft)?JSON.parse(JSON.stringify(draft.manualRangeDraft)):{status:'skipped'};
    state.draftNotice='Historical range needs a fresh snapshot and explicit reconfirmation. Your manual range draft was restored.';
  }
  if(draft.dealingRange?.status==='editing' && ['session','custom'].includes(draft.dealingRange.kind)) state.dealingRange={...draft.dealingRange};
  state.rangeError='';
  const current=draft.checklistVersion===checklistVersionFor(draft.model);
  const allowed=new Set(state.model ? requiredChecks().map(entry=>entry.id) : []);
  state.answers={};
  if(current && draft.answers && typeof draft.answers==="object" && !Array.isArray(draft.answers)){
    for(const [id,answer] of Object.entries(draft.answers))
      if(allowed.has(id) && ["yes","no","unknown"].includes(answer)) state.answers[id]=answer;
  }
  state.dateValue=typeof draft.dateValue==="string" && /^\d{4}-\d{2}-\d{2}$/.test(draft.dateValue) ? draft.dateValue : "";
  state.clockValue=typeof draft.clockValue==="string" && /^\d{2}:\d{2}$/.test(draft.clockValue) ? draft.clockValue : "";
  state.timeValue=state.dateValue && state.clockValue ? `${state.dateValue}T${state.clockValue}` : "";
  state.entryTimeUtc=null;state.inputTimeZone=deviceTimeZone();
  const savedInstant=typeof draft.entryTimeUtc==='string'?new Date(draft.entryTimeUtc):null;
  let timeRecheck=false;
  if(savedInstant && Number.isFinite(savedInstant.getTime()) && typeof draft.inputTimeZone==='string'){
    const local=localTimeValue(savedInstant);
    if(draft.inputTimeZone!==deviceTimeZone()){
      state.timeValue=local;[state.dateValue,state.clockValue]=local.split('T');
      state.draftNotice=`Your entry instant is preserved. Time is now displayed in ${deviceTimeZone()} (previously ${draft.inputTimeZone}).`;
    }
    if(local===state.timeValue) state.entryTimeUtc=savedInstant.toISOString();
    else {timeRecheck=true;state.answers={};state.draftNotice='The saved time needs review. Confirm the entry time and answer the checks again.';}
  }
  if(current && state.timeValue && !state.entryTimeUtc){timeRecheck=true;state.answers={};state.draftNotice='This earlier draft has no preserved timezone. Confirm the entry time and answer the checks again.';}
  state.questionIndex=current && Number.isInteger(draft.questionIndex) ? Math.max(0,Math.min(draft.questionIndex,state.model ? requiredChecks().length-1 : 0)) : 0;
  state.screen=current && ["entry","liquidity","home","setup","check","review","history"].includes(draft.screen) ? draft.screen : "setup";
  state.returnScreen=current && ["entry","liquidity","home","setup","check","review"].includes(draft.returnScreen) ? draft.returnScreen : "setup";
  if(timeRecheck) state.screen=state.model?"setup":"entry";
  if(!current) state.draftNotice="The checklist changed. Your entry details are restored; review each check again.";
  return true;
}
function validPending(pair){
  if(!Array.isArray(pair) || pair.length!==2 || typeof pair[0]!=="string" || pair[0].length>16384 ||
     typeof pair[1]!=="string" || !/^[A-Za-z0-9_-]{16,128}$/.test(pair[1])) return false;
  try{
    const p=JSON.parse(pair[0]),keys=Object.keys(p).sort().join(',');
    return ['checklist_id,checklist_met,entry_time_utc','checklist_id,checklist_met,checklist_version,entry_time_utc','checklist_id,checklist_met,checklist_version,entry_snapshot,entry_time_utc'].includes(keys) &&
      ['ote','turtle','drill_fvg','drill_wick','silver','ifvg'].includes(p.checklist_id) &&
      typeof p.entry_time_utc==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(p.entry_time_utc) &&
      !Number.isNaN(Date.parse(p.entry_time_utc)) && typeof p.checklist_met==='boolean' &&
      (p.checklist_version===undefined || (typeof p.checklist_version==='string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(p.checklist_version))) &&
      (p.entry_snapshot===undefined || validSnapshot(p.entry_snapshot));
  }catch{return false;}
}
function updateDraftStatus(){
  const status=$("draft-status");
  if(status){status.textContent=state.storageAvailable?'Draft saved in this tab':'Draft recovery unavailable — browser storage is blocked or full';status.className=`draft-status ${state.storageAvailable?'':'error'}`;}
}
function restoreDraft(){
  try{
    const draft=JSON.parse(sessionStorage.getItem(draftStorageKey));
    if(!draft || typeof draft!=='object') return;
    applyDraft(draft);
    if(draft.undoDraft && draft.undoDraft.checklistVersion===checklistVersionFor(draft.undoDraft.model) && (models.some(m=>m.id===draft.undoDraft.model) || draft.undoDraft.draftActive===true)) state.undoDraft=draft.undoDraft;
    if(Array.isArray(draft.saveAttempts)) for(const pair of draft.saveAttempts) if(validPending(pair)) saveAttempts.set(pair[0],pair[1]);
    const rejected=draft.rejectedSave;
    if(rejected && [400,409].includes(rejected.status) && typeof rejected.body==='string' && typeof rejected.key==='string' && saveAttempts.get(rejected.body)===rejected.key)
      state.rejectedSave={body:rejected.body,key:rejected.key,status:rejected.status};
    if(saveAttempts.size){state.screen='recovery';state.saveMessage=null;}
  }catch{state.storageAvailable=false;}
}
function syncSavingControls(){
  if(state.saving){
    document.querySelectorAll("button,input,select,textarea").forEach(control => {
      if(!savingControls.has(control)) savingControls.set(control,control.disabled);
      control.disabled=true;
    });
  }else{
    for(const [control,disabled] of savingControls) control.disabled=disabled;
    savingControls.clear();
  }
}
function clearDraft(){
  saveAttempts.clear();
  state.rejectedSave=null;
  state.draftActive=false;state.liquidity={skipped:false,swept:[],target:null};state.liquidityDraws=emptyDraws();state.dealingRange={status:'skipped'};state.rangeError='';state.liquidityError="";state.liquidityReturn="home";state.liquidityOpen=null;state.entryTimeUtc=null;state.inputTimeZone=null;
  state.marketInstrument=phase2PersistentLocal?'NQ_continuous_provisional':'';state.marketDateNY=phase2PersistentLocal?currentNYDate():'';state.marketCutoffUTC='';state.marketMessage='';state.marketContextIds=[];state.marketTargetId=null;state.manualTargetDraft=null;state.marketRangeIds=null;state.manualRangeDraft=null;state.marketContextError='';state.hiddenContextReviewed=false;state.legacyRecovery=false;resetPhase2Client();
  state.model=null;state.answers={};state.timeValue="";state.dateValue="";state.clockValue="";state.questionIndex=0;state.saveMessage=null;state.draftNotice=null;
  persistDraft();
}
function replaceDraft(model=null){
  if(state.saving) return;
  if(saveAttempts.size){show('recovery');return;}
  if(state.draftActive || state.model) state.undoDraft=draftSnapshot();
  const liquidity=JSON.parse(JSON.stringify(state.liquidity));
  const liquidityDraws=JSON.parse(JSON.stringify(state.liquidityDraws));
  const dealingRange=JSON.parse(JSON.stringify(state.dealingRange));
  const legacyRecovery=state.legacyRecovery;
  const marketSelection={instrument:state.marketInstrument,date:state.marketDateNY,cutoff:state.marketCutoffUTC};
  const marketContextIds=[...state.marketContextIds];
  const marketTargetId=state.marketTargetId,manualTargetDraft=state.manualTargetDraft?{...state.manualTargetDraft}:null;
  const marketRangeIds=state.marketRangeIds?[...state.marketRangeIds]:null,manualRangeDraft=state.manualRangeDraft?JSON.parse(JSON.stringify(state.manualRangeDraft)):null;
  const loadedMarketClient=model && phase2Client?.getSnapshot() ? phase2Client : null;
  clearDraft();state.savedEntry=null;state.selectedEntry=null;state.draftActive=true;
  if(model){
    state.liquidity=liquidity;state.liquidityDraws=liquidityDraws;state.dealingRange=dealingRange;state.legacyRecovery=legacyRecovery;
    state.marketInstrument=marketSelection.instrument;state.marketDateNY=marketSelection.date;state.marketCutoffUTC=marketSelection.cutoff;
    if(loadedMarketClient){phase2Client=loadedMarketClient;state.marketContextIds=marketContextIds;state.marketTargetId=marketTargetId;state.manualTargetDraft=manualTargetDraft;state.marketRangeIds=marketRangeIds;state.manualRangeDraft=manualRangeDraft;state.marketMessage='Historical research snapshot retained for this review; it remains unverified.';}
    state.model=model;state.direction='long';state.variant='fvg';setNow();show('home');
  }
  else show('entry');
}
function undoReplacement(){
  if(state.saving || saveAttempts.size || !state.undoDraft) return;
  const draft=state.undoDraft;state.undoDraft=null;applyDraft(draft);show(state.screen);
}
function openHistory(){
  if(state.saving) return;
  if(!['history','detail','outcome','saved'].includes(state.screen)) state.returnScreen=state.screen;
  show('history');
}
function resumeReview(){
  if(saveAttempts.size){show('recovery');return;}
  if(!state.model && !state.draftActive) return;
  const destination=state.returnScreen==='history'?'setup':state.returnScreen;
  show(['entry','liquidity','home','setup','check','review'].includes(destination)?destination:(state.model?'setup':'entry'));
}
async function fetchEntriesJSON(options,url="/api/entries"){
  return window.entryBrowserLog(options,url);
}

function modelInfo(){ return models.find(model => model.id === state.model); }
function directional(longText, shortText){ return state.direction === "long" ? longText : shortText; }
function item(id,title,description,kind="source",optional=false,auto=null){ return {id,title,description,kind,optional,auto}; }
function checklistId(){ return state.model === "drill" ? `drill_${state.variant}` : state.model; }

function deviceTimeZone(){return Intl.DateTimeFormat().resolvedOptions().timeZone || 'device local time';}
function localTimeValue(date){
  const pad=value=>String(value).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function parsedEntryTime(){
  if(!state.timeValue) return {valid:false,reason:"Select an entry time."};
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(state.timeValue)) return {valid:false,reason:"Enter a valid entry time."};
  let date = new Date(state.timeValue);
  if(Number.isNaN(date.getTime())) return {valid:false,reason:"Enter a valid entry time."};
  if(localTimeValue(date)!==state.timeValue) return {valid:false,reason:"This local time is invalid at a daylight saving change. Choose another time."};
  // A restored instant disambiguates a repeated local hour, including a zone change.
  const retained=state.entryTimeUtc?new Date(state.entryTimeUtc):null;
  if(retained && Number.isFinite(retained.getTime()) && localTimeValue(retained)===state.timeValue) date=retained;
  const repeated=[-120,-60,-30,30,60,120].some(minutes=>localTimeValue(new Date(date.getTime()+minutes*60000))===state.timeValue);
  const offset=new Intl.DateTimeFormat('en',{timeZoneName:'shortOffset'}).formatToParts(date).find(part=>part.type==='timeZoneName')?.value || '';
  return {valid:true,date,iso:date.toISOString(),repeated,note:repeated?`Repeated local hour: ${retained?'the saved instant is retained':'new entries use the earlier occurrence'} (${offset}).`:''};
}
function setEntryTime(dateValue,clockValue){
  const previous=parsedEntryTime(),nextValue=dateValue && clockValue?`${dateValue}T${clockValue}`:'';
  if(nextValue!==state.timeValue) state.entryTimeUtc=null;
  state.dateValue=dateValue;state.clockValue=clockValue;state.timeValue=nextValue;state.inputTimeZone=deviceTimeZone();
  const next=parsedEntryTime();
  if((previous.valid?previous.iso:null)!==(next.valid?next.iso:null) && Object.keys(state.answers).length){
    state.answers={};state.draftNotice='Entry time changed. Review each chart condition again for this entry.';
  }
  state.entryTimeUtc=next.valid?next.iso:null;state.saveMessage=null;
}

function checklist(){
  if(state.model === "ifvg") return {
    intro:"Illustrative Scenario B exercise. The CE body-close example is not a source-validated numeric rule. Your answers record observations for this exercise, not certification of a complete ICT iFVG model. Scenario A and aggressive touch entries are outside it.",
    groups:[
      {title:"Gap and failure",items:[
        item("ifvg-gap",directional("A completed bearish FVG was identified first.","A completed bullish FVG was identified first."),"Mark the original three-candle gap before calling it inverted."),
        item("ifvg-fail",directional("The bearish FVG failed and price delivered above it.","The bullish FVG failed and price delivered below it."),"The original gap must fail in its first role before an opposite-role return is assessed."),
        item("ifvg-scenario","Scenario B applies: the gap had no penetration before failure.","Check the candles before the failure, excluding the failure itself and the later return. If there was earlier penetration, answer No for this Scenario B review.","interpretation")
      ]},
      {title:"Return and confirmation",items:[
        item("ifvg-return","Price later returned to the failed gap.","A later return into the old gap is needed; the first breach itself is not the entry retest."),
        item("ifvg-proof","In this illustration, a completed returning candle body closes at your marked CE.","This is a self-reported check for the illustrated case. The chart draws an exact CE close for clarity; the source has not established a universal numeric tolerance for this app. A wick-only touch is No in this exercise.","interpretation"),
        item("ifvg-entry","The CE entry reference is identified on your chart.","Identify the CE reference on your chart. This app neither stores an entry price nor infers a fill.","interpretation")
      ]}
    ]
  };
  if(state.model === "ote"){
    return {
      intro:"This review uses the compiled 2016/17 body-anchored 62–79% convention, with 70.5% marked. The 60% spoken floor and the separate 2022 62–70% confluence example are not reviewed here. Confirm that your chart uses this convention.",
      groups:[
        {title:"Context and leg",items:[
          item("ote-context","Directional context is stated before the entry review.","The teaching frames OTE within higher-timeframe direction; the dashboard does not determine that direction."),
          item("ote-break","An impulse leg and structure break have completed.","A pullback without the relevant impulse and break is not the described OTE sequence."),
          item("ote-anchors","The impulse body anchors were fixed before the retracement.","For this illustrated convention, use the candle bodies of the chosen leg, not its outer wicks.","interpretation")
        ]},
        {title:"Retracement and entry",items:[
          item("ote-convention","Your chart uses body anchors and the 62%–79% OTE band.","Answer No if you are using another convention. This fixed review does not silently substitute the 60% or 62%–70% alternatives.","interpretation"),
          item("ote-zone","Price has retraced into the chosen OTE area.",directional("The long review looks for a dip into the chosen retracement area.","The short review looks for a rally into the chosen retracement area.")),
          item("ote-swing",directional("The protective swing low remains intact.","The protective swing high remains intact."),"The OTE idea fails if price trades through the swing extreme protecting the retracement."),
          item("ote-entry","The entry reference inside that area is identified.","This is a manual entry-location check; the dashboard does not calculate a price or infer a fill.","interpretation")
        ]}
      ]
    };
  }
  if(state.model === "turtle"){
    return {
      intro:"Turtle Soup begins with an old high or low and a false break. Context matters; a stop run by itself does not complete the entry framework.",
      groups:[
        {title:"Reference and context",items:[
          item("ts-level",directional("An old low was marked before price ran below it.","An old high was marked before price ran above it."),"Identify the exact prior level and the Turtle Soup variant being reviewed."),
          item("ts-context","The relevant reversal context is stated.","The teaching ties stronger examples to a suitable premium/discount array or banking-level context, rather than any old high/low."),
          item("ts-variant","The specific false-break variant is identified.","Previous-day, intra-week, intermediate-term, and session examples are not interchangeable without context.","interpretation")
        ]},
        {title:"False break and entry",items:[
          item("ts-run",directional("Price traded below the premarked old low.","Price traded above the premarked old high."),"The observable run beyond the reference comes before judging a reversal."),
          item("ts-failure","There is observable evidence that the break failed.","Identify the return or rejection that makes this a false break, rather than assuming every breach reverses.","interpretation"),
          item("ts-entry","The entry reference and reason are identified on your chart.","The source covers several Turtle Soup variants; this checklist does not impose a universal numeric trigger.","interpretation")
        ]}
      ]
    };
  }
  if(state.model === "drill" && state.variant === "fvg"){
    return {
      intro:"FVG-based drill: the 2022 sweep → shifted displacement → FVG sequence is component teaching. A 2024 example uses the institutional order entry drill name for an FVG; this checklist does not claim the 2022 sequence is universal to that name.",
      groups:[
        {title:"Sweep and shift",items:[
          item("io-reference","Direction and a relevant liquidity reference were identified before the move.","The reference is supplied by the broader context. This entry dashboard does not choose the market's draw on liquidity.","interpretation"),
          item("io-sweep",directional("Sell-side liquidity was run below the reference.","Buy-side liquidity was run above the reference."),"The 2022 FVG component places the gap after a liquidity run.","component"),
          item("io-shift",directional("Price then closed above a short-term swing with energetic displacement.","Price then closed below a short-term swing with energetic displacement."),"The 2022 FVG component describes a close beyond the swing; no numeric displacement threshold is adopted here.","component")
        ]},
        {title:"Gap and return",items:[
          item("io-gap",directional("A completed bullish FVG exists inside that displacement leg.","A completed bearish FVG exists inside that displacement leg."),"Candle 3 must close before the three-candle gap is eligible. No gap in the leg means no entry under this 2022 FVG component.","component"),
          item("io-drill","The qualifying gap was located through the timeframe drill.","The 2022 teaching starts at 15 minutes and steps down through lower timeframes. Identify which timeframe contains the chosen gap.","component"),
          item("io-price",directional("Candle 3 low and the proposed return price are marked.","Candle 3 high and the proposed return price are marked."),"The source's exact 'on' versus 'just beyond' offset is unresolved. Identify your choice on your chart; no offset is supplied by the dashboard.","interpretation"),
          item("io-return","A later price return reaches the chosen reference.","A touch before candle 3 closes cannot qualify. A candle touch is an observation, not evidence of an order fill.","interpretation")
        ]}
      ]
    };
  }
  if(state.model === "drill"){
    if(state.direction === "long"){
      return {intro:"The local 2024 Lecture 8 wick example documents bearish sell-side delivery. A bullish mirror is not established by that passage, so this direction is held as a source gap.",groups:[],guard:"The bullish wick-retest rule is not sourced in the material used here. Select Short to review the documented example, or choose the FVG drill variant."};
    }
    return {
      intro:"Wick consequent-encroachment drill: this checklist follows the bearish example in 2024 Lecture 8. It is distinct from the FVG-based drill.",
      groups:[
        {title:"Reference candle",items:[
          item("wick-delivery","Sell-side delivery is already underway.","The lecture places the retest within an ongoing move lower."),
          item("wick-reference","A relevant candle and its wick were selected before the return.","The example focuses on a candle whose wick midpoint matters to the move."),
          item("wick-ce","The wick midpoint (consequent encroachment) is marked.","The midpoint is the precise price reference in this variant.")
        ]},
        {title:"Return and response",items:[
          item("wick-return","Price returns to the wick midpoint without exceeding the reference candle high.","This follows the bearish entry example at 39:45 in Lecture 8."),
          item("wick-entry","The proposed entry point is tied to that retest.","The lecture calls the retest a possible entry; the dashboard does not choose an offset or place an order.","interpretation"),
          item("wick-body","Bodies do not close above the midpoint; the next candle makes a lower high.","A supporting bearish observation described at 30:49 in Lecture 8. It is shown separately from the core retest.","source",true)
        ]}
      ]
    };
  }
  return {
    intro:"Silver Bullet is a time-windowed FVG entry. The gap may already exist, but the proposed entry must occur inside the active New York local-time hour.",
    groups:[
      {title:"Narrative and time",items:[
        item("sb-draw","The next draw on liquidity and direction were stated before entry.","The source begins with the draw, then uses the time window for entry precision."),
        item("sb-window","The proposed entry time is inside a Silver Bullet hour.","The cited hours are 03:00–04:00, 10:00–11:00, or 14:00–15:00 New York local time. The automatic weekday check is a planning safeguard; holidays and market closures are not checked.","interpretation",false,"window")
      ]},
      {title:"FVG and reprice",items:[
        item("sb-gap",directional("A relevant bullish FVG is identified.","A relevant bearish FVG is identified."),"The gap can form before the active hour; identify the exact three-candle reference."),
        item("sb-entry","The proposed entry is a return into that FVG during the active hour.","The time restriction applies to entry, not to when the gap first formed."),
        item("sb-price","The exact entry reference is identified on your chart.","This is a manual planning check; the dashboard does not derive an order price or infer a fill.","interpretation")
      ]}
    ]
  };
}

function checkSilverWindow(){
  if(!state.timeValue) return {status:"pending",message:"Select a time to check the New York entry window."};
  const parsed = parsedEntryTime();
  if(!parsed.valid) return {status:"pending",message:parsed.reason};
  const date = parsed.date;
  const parts = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const value = (type) => parts.find(part => part.type === type)?.value;
  const weekday = value("weekday");
  const hour = Number(value("hour"));
  const display = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(date);
  const weekdayAllowed = weekday !== "Sat" && weekday !== "Sun";
  const hourAllowed = hour === 3 || hour === 10 || hour === 14;
  if(!weekdayAllowed) return {status:"no",message:`${display} · Weekend; outside the listed entry windows.`};
  if(!hourAllowed) return {status:"no",message:`${display} · Outside the 03:00, 10:00, and 14:00 New York hours.`};
  const windowName = hour === 3 ? "London open" : hour === 10 ? "New York AM" : "New York PM";
  return {status:"yes",message:`${display} · Inside the ${windowName} Silver Bullet hour.`};
}

const labels = {ote:"OTE",turtle:"Turtle Soup",drill_fvg:"Institutional Drill · FVG",drill_wick:"Institutional Drill · Wick",silver:"Silver Bullet",ifvg:"Inversion FVG"};
const glyphs = {ote:"▱",turtle:"≋",drill:"▥",silver:"ϟ",ifvg:"⇄"};
const shortPrompts = {
  "ote-context":"Higher-timeframe direction clear?","ote-break":"Impulse and structure break complete?","ote-anchors":"Body anchors marked in advance?","ote-convention":"Using body-anchored 62–79%?","ote-zone":"Retracement reached the OTE area?","ote-swing":"Protective swing still intact?","ote-entry":"Entry reference identified?",
  "ts-level":"Old high or low marked first?","ts-context":"Reversal context clear?","ts-variant":"Turtle Soup variant identified?","ts-run":"Price ran the marked level?","ts-failure":"Evidence of a false break?","ts-entry":"Entry reference identified?",
  "io-reference":"Direction and liquidity reference set?","io-sweep":"Liquidity swept?","io-shift":"Displacement closed beyond the swing?","io-gap":"Completed FVG in the displacement?","io-drill":"FVG located by timeframe drill?","io-price":"Return price marked?","io-return":"Price returned to the reference?",
  "wick-delivery":"Sell-side delivery underway?","wick-reference":"Reference candle selected?","wick-ce":"Wick midpoint marked?","wick-return":"Price retested midpoint within the candle high?","wick-entry":"Entry tied to the retest?",
  "sb-draw":"Next draw on liquidity stated?","sb-window":"Entry inside a Silver Bullet hour?","sb-gap":"Relevant FVG identified?","sb-entry":"Price returned to FVG in the hour?","sb-price":"Exact entry reference marked?",
  "ifvg-gap":"Original FVG complete?","ifvg-fail":"Original FVG failed?","ifvg-scenario":"Scenario B: no prior penetration?","ifvg-return":"Later return into old gap?","ifvg-proof":"Illustrated body close at CE?","ifvg-entry":"Entry reference identified?"
};
function promptFor(entry){ return shortPrompts[entry.id] || entry.title; }
const screen = $("screen");
function answerFor(entry){ return entry.auto === "window" ? checkSilverWindow().status : (state.answers[entry.id] || "pending"); }

// Hand-drawn OHLC geometry: [open, close, high-on-screen, low-on-screen].
// FVG examples have a real separation between candle 1 high and candle 3 low.
function candleScene(model,wick=false){
  const gapCandles=[[130,140,124,146],[140,133,128,150],[133,145,120,149],[145,153,137,174],[153,130,115,158],[130,70,62,138],[70,55,45,98],[55,77,49,85],[77,96,71,103],[96,106,90,112]];
  if(wick) return {candles:[[55,70,49,78],[70,62,55,81],[62,105,57,113],[105,140,65,148],[140,157,133,169],[157,144,138,163],[144,125,118,151],[125,108,101,132],[108,100,94,116],[100,91,83,107]],zone:[81,89],level:65,midpoint:85,phases:['Delivery','Wick midpoint','Retest'],note:'Entry area surrounds the wick midpoint. Bearish example only.',focus:[4,3,9]};
  if(model==='ote'){
    const candles=[[158,147,140,170],[147,132,105,159],[132,142,125,157],[142,95,86,149],[95,66,58,102],[66,50,45,73],[50,80,47,86],[80,105,74,112],[105,123,99,130],[123,136,117,142]];
    const anchors=[candles[0][0],candles[5][1]];
    const zone=[0.62,0.79].map(ratio=>anchors[1]+(anchors[0]-anchors[1])*ratio);
    return {candles,zone,anchors,phases:['Impulse','Retracement','Entry zone'],note:'Example: body anchors, 62–79% retracement; 70.5% is the marked midpoint reference.',focus:[5,7,9]};
  }
  if(model==='turtle') return {candles:[[98,110,91,116],[110,103,98,120],[103,113,96,119],[113,143,108,175],[143,126,119,151],[126,97,88,132],[97,82,76,104],[82,95,78,102],[95,105,89,112],[105,110,99,117]],zone:[109,122],level:120,sweep:3,phases:['Old level','Liquidity sweep','Return inside'],note:'Entry zone is an example; the exact trigger depends on the Turtle Soup variant.',focus:[1,3,9]};
  if(model==='ifvg'){
    gapCandles[7]=[55,126,49,135];gapCandles[8]=[126,140,120,150];gapCandles[9]=[140,106.5,100,145];
    return {candles:gapCandles,zone:[98,115],fvg:[4,6],level:null,sweep:null,phases:['Original FVG','Failure','Opposite-role return'],note:'Scenario B illustration: the original bullish gap fails, then price returns from below. Long reverses the drawing.',focus:[5,7,9]};
  }
  if(model==='silver') gapCandles[3]=[145,153,137,158];
  return {candles:gapCandles,zone:[98,115],fvg:[4,6],level:model==='drill'?150:null,sweep:model==='drill'?3:null,phases:model==='drill'?['Liquidity sweep','FVG formed','Entry zone']:['FVG formed','Entry hour','Entry zone'],note:model==='drill'?'FVG spans candle 1 high to candle 3 low; entry follows candle 3 close.':'FVG return must occur inside a qualifying New York hour.',focus:model==='drill'?[3,5,9]:[5,7,9]};
}
// Explicit per-check visual contracts; no keyword or phase-based inference.
function conditionVisual(entry,d,y,x,mirror){
  const line=(a,b,c,e)=>`<path d="M${a} ${y(b)} L${c} ${y(e)}"/>`;
  const dot=(i,v)=>`<circle cx="${x(i)}" cy="${y(v)}" r="5"/>`;
  const zone=(a,b,start=177,end=294)=>`<rect x="${start}" y="${Math.min(y(a),y(b))}" width="${end-start}" height="${Math.abs(b-a)}" rx="2" class="condition-zone"/>`;
  const bracket=(a,b,v)=>line(x(a),v,x(b),v)+line(x(a),v-4,x(a),v+4)+line(x(b),v-4,x(b),v+4);
  const make=(label,confirm,candles,overlay,external=false)=>({label,confirm,candles,overlay,external});
  const reference=mirror?'high':'low';
  const beyond=mirror?'above':'below';
  const closeBeyond=mirror?'below':'above';
  const gap=zone(98,115,x(4),294)+dot(4,115)+dot(6,98);
  const fvgNumbers=[4,5,6].map((i,j)=>`<text x="${x(i)}" y="197" text-anchor="middle">${j+1}</text>`).join('');
  const wickRange=line(x(3),65,x(3),105)+dot(3,65)+dot(3,105);
  const configs={
    'ote-context':make('Higher-timeframe direction','State your higher-timeframe direction before reviewing this entry.',[0,1,2,3,4,5],line(x(0),177,x(5),37),true),
    'ote-break':make('Close beyond structure',`Confirm the impulse closes ${closeBeyond} the marked structure level.`,[1,3],line(x(1),105,x(4),105)+dot(1,105)+dot(3,95)),
    'ote-anchors':make('Fixed body anchors','Mark the impulse candle body anchors before judging the pullback.',[0,5],line(x(0),d.anchors?.[0]??158,x(5),d.anchors?.[1]??50)+dot(0,d.anchors?.[0]??158)+dot(5,d.anchors?.[1]??50)),
    'ote-convention':make('Body-anchored 62–79%','Confirm your chart uses this review’s body anchors and 62–79% band.',[],zone(...d.zone),true),
    'ote-zone':make('Retracement into OTE','Confirm the returning price reaches your chosen OTE band.',[8,9],zone(...d.zone)+dot(8,130)),
    'ote-swing':make('Protective swing intact','Confirm price has not traded beyond the protective swing extreme.',[0,8,9],line(13,170,294,170)+dot(0,170)+dot(9,142)),
    'ote-entry':make('Your entry reference','Identify your exact entry reference within the OTE area.',[9],zone(...d.zone,251)+line(224,130,294,130)+dot(9,130)),
    'ts-level':make(`Premarked old ${reference}`,`Identify this old ${reference} before the liquidity run.`,[1],line(13,120,294,120)+dot(1,120)),
    'ts-context':make('Reversal context','Confirm the relevant premium/discount array or banking-level context on your chart.',[1,3],zone(112,128,13,294),true),
    'ts-variant':make('Name the false-break variant','Identify whether this is a previous-day, session, intra-week, or other sourced variant.',[1,3,5],line(x(1),120,x(5),120)+bracket(1,5,184),true),
    'ts-run':make(`Sweep ${beyond} old ${reference}`,`Confirm a wick trades ${beyond} the premarked ${reference}.`,[1,3],line(13,120,144,120)+line(x(3),120,x(3),175)+dot(3,175)),
    'ts-failure':make('Evidence the break failed','Confirm a return or rejection back inside the old level; this example shows a return.',[3,4,5],line(13,120,214,120)+dot(3,175)+dot(5,97)),
    'ts-entry':make('Variant-specific entry','Identify the entry reference and reason for your selected Turtle Soup variant.',[9],zone(...d.zone,251)+line(224,110,294,110)+dot(9,110),true),
    'io-reference':make('Direction + liquidity level',`State direction and premark the relevant old ${reference} before the move.`,[1],line(13,150,294,150)+dot(1,150),true),
    'io-sweep':make(`Liquidity swept ${beyond}`,`Confirm price trades ${beyond} the marked liquidity level.`,[1,3],line(13,150,144,150)+line(x(3),150,x(3),174)+dot(3,174)),
    'io-shift':make('Displacement close',`Confirm an energetic candle closes ${closeBeyond} the short-term swing.`,[2,5],line(x(2),120,x(6),120)+dot(2,120)+dot(5,70)),
    'io-gap':make('Three-candle FVG',`Confirm candle 1 ${mirror?'low':'high'} and candle 3 ${mirror?'high':'low'} leave a gap after candle 3 closes.`,[4,5,6],gap+fvgNumbers),
    'io-drill':make('15m → lower timeframes','Step down from 15m and identify the timeframe containing your completed FVG.',[4,5,6],gap+bracket(4,6,183),true),
    'io-price':make(`Candle 3 ${reference}`,`Mark candle 3 ${reference} and your proposed return price; choose and record any offset.`,[6],line(x(6),98,294,98)+dot(6,98),true),
    'io-return':make('Later return to reference','Confirm a later candle touches the chosen reference after candle 3 has closed.',[6,8],line(x(6),98,294,98)+dot(6,98)+dot(8,98)+bracket(6,8,183)),
    'wick-delivery':make('Sell-side delivery','Confirm price is already delivering lower before the wick retest.',[0,1,2,3,4],line(x(0),48,x(4),176)),
    'wick-reference':make('Selected reference wick','Select this reference candle and its upper wick before price returns.',[3],wickRange),
    'wick-ce':make('Exact wick midpoint','Mark halfway between the candle high and the top of its body.',[3],wickRange+line(x(3),85,294,85)+dot(3,85)),
    'wick-return':make('Midpoint touch; high intact','Confirm the return reaches the midpoint without exceeding the reference candle high.',[3,9],line(x(3),65,294,65)+line(x(3),85,294,85)+dot(9,85)),
    'wick-entry':make('Entry at the wick retest','Tie your proposed entry to this retest; identify your own entry price.',[9],zone(...d.zone,251)+dot(9,85),true),
    'sb-draw':make('Draw on liquidity + direction','State the next liquidity objective and direction on your own chart before entry.',[],line(24,174,186,38),true),
    'sb-window':make('New York entry time','Confirm the entered time is in 03–04, 10–11, or 14–15 New York time.',[7,8,9],`<rect x="206" y="32" width="88" height="150" class="condition-zone"/>`),
    'sb-gap':make('Relevant three-candle FVG','Identify the three candles and the non-overlapping wick boundaries of the chosen FVG.',[4,5,6],gap+fvgNumbers),
    'sb-entry':make('FVG return during the hour','Confirm the later FVG return occurs during the selected New York entry hour.',[8,9],gap+dot(8,98)+bracket(7,9,183)),
    'sb-price':make('Exact entry reference','Identify your exact entry reference within the selected FVG.',[9],zone(...d.zone,251)+line(224,106,294,106)+dot(9,106),true)
    ,'ifvg-gap':make('Original three-candle gap','Mark the completed FVG before considering inversion.',[4,5,6],gap+fvgNumbers)
    ,'ifvg-fail':make('Gap failed in original role','Confirm price has delivered through the far edge of the old gap.',[6,7],gap+dot(7,126))
    ,'ifvg-scenario':make('Scenario B: no prior penetration','Confirm there was no gap penetration before failure. Earlier penetration is outside this review.',[4,5,6,7,8],gap)
    ,'ifvg-return':make('Later opposite-role return','Confirm a later candle returns into the old gap after failure.',[7,8,9],gap+dot(9,100))
    ,'ifvg-proof':make('Completed body close at CE','Confirm the returning candle has closed at CE; a wick-only touch is not this body condition.',[9],gap+line(x(6),106.5,294,106.5)+dot(9,106.5))
    ,'ifvg-entry':make('CE entry reference','Identify the CE entry reference on your chart.',[9],gap+line(224,106.5,294,106.5)+dot(9,106.5),true)
  };
  return configs[entry.id];
}

// A counterexample changes only this condition; these examples never set answers.
function examplePair(entry,d,condition,y,x,invalid){
  const pairs={
    'ote-context':['HTF direction was stated before entry.','No higher-timeframe direction was stated.'],
    'ote-break':['The candle closes beyond the structure level.','The wick crosses structure, but the body closes back inside.'],
    'ote-anchors':['Both impulse anchors were fixed before the pullback.','An impulse anchor was moved after seeing the pullback.'],
    'ote-convention':['The chart uses the body-anchored 62–79% convention.','The chart does not use this review’s body-anchored 62–79% convention.'],
    'ote-zone':['The retracement reaches the chosen OTE band.','The retracement stops before reaching the OTE band.'],
    'ote-swing':['Price stays inside the protective swing extreme.','Price trades through the protective swing extreme.'],
    'ote-entry':['The proposed entry reference is inside the chosen band.','The proposed entry reference is outside the chosen band.'],
    'ts-level':['The old level was marked before the run.','The sweep extreme was chosen as the level after the run.'],
    'ts-context':['Relevant reversal context was identified before entry.','No relevant reversal context was identified.'],
    'ts-variant':['The trader identified the session false-break variant.','The trader has not identified which variant applies.'],
    'ts-run':['Price trades beyond the old level.','Price approaches the old level but never trades beyond it.'],
    'ts-failure':['Price returns inside the old level after the run.','Price stays beyond the old level; there is no return or rejection yet.'],
    'ts-entry':['The entry reference and reason were identified on your chart for the selected variant.','The entry reference and reason were not identified on your chart.'],
    'io-reference':['Direction and the liquidity reference were stated in advance.','Direction and the liquidity reference were not stated.'],
    'io-sweep':['The wick runs beyond the marked liquidity level.','The wick stops short of the liquidity level.'],
    'io-shift':['Displacement closes beyond the short-term swing.','Only the wick breaks the swing; the close stays inside.'],
    'io-gap':['Candle 3 has closed and its wick leaves a gap from candle 1.','Candle 1 and candle 3 wicks overlap: this is not an FVG.'],
    'io-drill':['The trader stepped down from 15m and identified the FVG on 5m in this example.','The trader has not identified which timeframe contains the qualifying gap.'],
    'io-price':['The candle 3 boundary and proposed return price were marked.','The candle 3 boundary and proposed return price were not marked.'],
    'io-return':['A later candle touches the marked reference after candle 3 closes.','Later candles stop short of the marked reference.'],
    'wick-delivery':['Price is already delivering lower before the retest.','Price is moving higher; sell-side delivery is not underway.'],
    'wick-reference':['The reference candle and its upper wick were selected.','The body was selected; the relevant upper wick is unmarked.'],
    'wick-ce':['The marked level is halfway along the upper wick.','The selected level is not the wick midpoint.'],
    'wick-return':['The retest reaches the midpoint and stays below the candle high.','The retest exceeds the reference candle high.'],
    'wick-entry':['The proposed entry is tied to the midpoint retest.','The proposed entry is away from the midpoint retest.'],
    'sb-draw':['The next draw on liquidity and direction were stated before entry.','No draw on liquidity or direction was stated.'],
    'sb-window':['Example: 10:30 New York is inside the 10:00–11:00 hour on a weekday.','Example: 11:15 New York is outside the listed hours.'],
    'sb-gap':['The three candles leave a clear gap between the outer wicks.','The outer candle wicks overlap; there is no FVG.'],
    'sb-entry':['The later FVG return occurs within the selected entry hour.','The FVG return occurs after the selected entry hour ends.'],
    'sb-price':['An exact entry reference was identified on your chart inside the FVG.','No exact entry reference was identified on your chart.']
    ,'ifvg-gap':['A completed three-candle FVG is marked.','The outer wicks overlap; no original FVG is present.']
    ,'ifvg-fail':['Price closes through the far side of the original gap.','Price has not broken through the far side of the original gap.']
    ,'ifvg-scenario':['No gap penetration occurred before the failure: Scenario B.','A candle penetrated the gap before failure: this is not Scenario B.']
    ,'ifvg-return':['A later candle returns into the failed gap.','The later candle stops short of the failed gap.']
    ,'ifvg-proof':['The returning candle has closed at CE in this example.','Only a wick touched CE; the body did not close there.']
    ,'ifvg-entry':['The CE entry reference was identified on your chart.','No entry reference was identified on your chart.']
  };
  const pair=pairs[entry.id];
  if(!pair) throw new Error(`Missing example pair: ${entry.id}`);
  const line=(a,b,c,e)=>`<path d="M${a} ${y(b)} L${c} ${y(e)}"/>`;
  const dot=(i,v)=>`<circle cx="${x(i)}" cy="${y(v)}" r="5"/>`;
  const zone=(a,b,start=177,end=294)=>`<rect x="${start}" y="${Math.min(y(a),y(b))}" width="${end-start}" height="${Math.abs(b-a)}" class="condition-zone"/>`;
  const gap=zone(98,115,x(4),294);
  const badge=text=>`<text x="160" y="20" text-anchor="middle" class="example-annotation">${text}</text>`;
  // Both examples stop at the same decision candle, without later confirming price action.
  const decisionCutoffs={'ote-break':3,'ts-level':3,'ts-run':3,'ts-failure':5,'io-sweep':3,'io-shift':5,'io-gap':6,'sb-gap':6,'wick-delivery':4,'ifvg-gap':6,'ifvg-fail':7,'ifvg-scenario':8};
  const until=decisionCutoffs[entry.id] ?? 9;
  let overlay=condition.overlay;
  const badges={
    'ote-context':['HTF direction stated','HTF direction missing'],
    'ote-convention':['Body-anchored 62–79%','Different or missing convention'],
    'ts-context':['Reversal context identified','Reversal context missing'],
    'ts-variant':['Example: session variant','Variant not identified'],
    'ts-entry':['Reference + reason identified on your chart','Reference + reason missing'],
    'io-reference':['Direction + level stated','Direction + level missing'],
    'io-drill':['Example: FVG on 5m','Timeframe not identified'],
    'io-price':['Boundary + price marked','Boundary + price missing'],
    'sb-draw':['Draw + direction stated','Draw + direction missing'],
    'sb-price':['Entry reference identified on your chart','Entry reference missing']
    ,'ifvg-scenario':['Scenario B: no prior penetration','Earlier penetration: not Scenario B']
    ,'ifvg-entry':['Entry reference identified on your chart','Entry reference missing']
  };
  if(badges[entry.id]) overlay=(invalid?'':overlay)+badge(badges[entry.id][invalid?1:0]);
  if(invalid){
    switch(entry.id){
      case 'ote-break': d.candles[3]=[142,112,86,149];overlay=line(x(1),105,x(4),105)+dot(3,112);break;
      case 'ote-anchors':overlay=line(x(7),112,x(5),d.anchors[1])+dot(7,112)+dot(5,d.anchors[1])+badge('Anchor moved after pullback');break;
      case 'ote-zone':d.candles[8]=[105,109,99,112];d.candles[9]=[109,111,105,115];overlay=zone(...d.zone)+dot(9,115);break;
      case 'ote-swing':d.candles[9]=[123,176,117,182];overlay=line(13,170,294,170)+dot(9,182);break;
      case 'ote-entry':overlay=zone(...d.zone)+line(224,110,294,110)+dot(9,110)+badge('Proposed price outside band');break;
      case 'ts-level':overlay=line(13,175,294,175)+dot(3,175)+badge('Level chosen after run');break;
      case 'ts-run':d.candles[3]=[113,110,108,119];overlay=line(13,120,144,120)+dot(3,119);break;
      case 'ts-failure':d.candles[4]=[143,145,128,151];d.candles[5]=[145,153,126,162];overlay=line(13,120,214,120)+dot(5,153);break;
      case 'io-sweep':d.candles[3]=[145,144,137,149];overlay=line(13,150,144,150)+dot(3,149);break;
      case 'io-shift':d.candles[5]=[130,125,70,138];overlay=line(x(2),120,x(6),120)+dot(5,125);break;
      case 'io-gap':case 'sb-gap':d.candles[6]=[70,55,45,125];overlay=zone(115,125,x(4),x(6))+dot(4,115)+dot(6,125)+badge('Outer wicks overlap')+[4,5,6].map((i,j)=>`<text x="${x(i)}" y="197" text-anchor="middle">${j+1}</text>`).join('');break;
      case 'io-return':d.candles[8]=[77,86,71,94];d.candles[9]=[86,90,80,96];overlay=line(x(6),98,294,98)+dot(9,96);break;
      case 'wick-delivery':d.candles.splice(0,5,[150,140,130,160],[140,125,120,148],[125,100,95,133],[100,78,70,108],[78,55,45,84]);overlay=line(x(0),165,x(4),40);break;
      case 'wick-reference':overlay=zone(105,140,x(3)-8,x(3)+8)+badge('Body selected, wick unmarked');break;
      case 'wick-ce':overlay=line(x(3),65,x(3),105)+dot(3,65)+dot(3,105)+line(x(3),100,294,100)+dot(3,100)+badge('Wrong midpoint selected');break;
      case 'wick-return':d.candles[9]=[100,91,55,107];overlay=line(x(3),65,294,65)+line(x(3),85,294,85)+dot(9,55);break;
      case 'wick-entry':overlay=line(x(3),85,294,85)+line(224,130,294,130)+dot(9,130)+badge('Proposed price away from retest');break;
      case 'ifvg-scenario':d.candles[7]=[55,90,49,105];d.candles[8]=[90,140,85,150];overlay=gap+dot(7,105)+badge('Earlier penetration: not Scenario B');break;
      case 'ifvg-gap':d.candles[6]=[70,55,45,125];overlay=zone(115,125,x(4),x(6))+badge('Outer wicks overlap');break;
      case 'ifvg-fail':d.candles[7]=[55,102,49,112];overlay=gap+dot(7,102)+badge('Original gap still holds');break;
      case 'ifvg-return':d.candles[9]=[140,135,120,145];overlay=gap+dot(9,120);break;
      case 'ifvg-proof':d.candles[9]=[140,128,100,145];overlay=gap+line(x(6),106.5,294,106.5)+dot(9,100)+badge('Wick only at CE');break;
    }
  }
  if(entry.id==='sb-window'||entry.id==='sb-entry'){
    overlay=(entry.id==='sb-entry'?zone(98,115,x(4),294):'')+`<rect x="206" y="32" width="54" height="150" class="condition-zone"/>`+badge(invalid?'Example: 11:15 NY — outside':'Example: 10:30 NY — inside')+dot(invalid?9:8,invalid?106:98);
    condition.candles=invalid?[9]:[8];
  }
  return {...condition,overlay,until,reason:pair[invalid?1:0],invalid};
}

function chartIllustration(page,entry=null,saved=null){
  const model=saved ? (saved.checklist_id.startsWith('drill')?'drill':saved.checklist_id) : state.model || 'ote';
  const wick=model==='drill' && (saved?saved.checklist_id==='drill_wick':state.variant==='wick');
  const bearish=wick || state.direction==='short';
  const mirror=(model==='ifvg'?state.direction==='long':bearish) && !wick;
  const d=candleScene(model,wick);
  if(model==='ifvg' && state.direction==='long') d.note='Scenario B illustration: the original bearish gap fails, then price returns from above.';
  if(mirror && d.fvg && model==='drill') d.note='FVG spans candle 1 low to candle 3 high; entry follows candle 3 close.';
  const y=v=>mirror?210-v:v;
  const x=i=>24+i*27;
  const low=Math.min(...d.zone.map(y)),height=Math.abs(d.zone[1]-d.zone[0]);
  const baseCondition=entry?conditionVisual(entry,d,y,x,mirror):null;
  const condition=entry?examplePair(entry,d,baseCondition,y,x,state.exampleMode==="invalid"):null;
  const phaseText=condition?condition.label:page==='home'&&!state.model?'Select a model to preview':`${wick?'Bearish':bearish?'Short':'Long'} example`;
  const band=d.fvg?`<rect x="${x(4)}" y="${low}" width="${294-x(4)}" height="${height}" fill="#dcebf6"/><text x="178" y="${low+height/2+4}" class="candle-label fvg-label">FVG</text>`:model==='ote'?`<rect x="177" y="${low}" width="117" height="${height}" fill="#edf1e7"/><text x="179" y="${low+height/2+4}" class="candle-label">OTE 62–79%</text><line x1="177" x2="294" y1="${y(d.anchors[1]+(d.anchors[0]-d.anchors[1])*0.705)}" y2="${y(d.anchors[1]+(d.anchors[0]-d.anchors[1])*0.705)}" stroke="#8a6424" stroke-dasharray="3 2"/>`:'';
  const entryZone=`<rect x="251" y="${low}" width="43" height="${height}" rx="2" fill="#c8e3cf" fill-opacity=".65" stroke="#296948" stroke-width="1.4" stroke-dasharray="3 2"/>`;
  const oldLevel=d.level===null||d.level===undefined?'':`<line x1="13" x2="${wick?294:126}" y1="${y(d.level)}" y2="${y(d.level)}" stroke="#aa8a55" stroke-width="1.2" stroke-dasharray="4 3"/><text x="${wick?183:13}" y="${wick?56:y(d.level)+(mirror?-7:14)}" class="candle-label">${wick?'Candle high':mirror?'Old high':'Old low'}</text>`;
  const midpoint=wick?`<line x1="${x(3)}" x2="294" y1="85" y2="85" stroke="#6b826e" stroke-dasharray="3 3"/><text x="174" y="78" class="candle-label">Wick 50%</text>`:'';
  const sweep=d.sweep===null||d.sweep===undefined?'':`<circle cx="${x(d.sweep)}" cy="${y(d.candles[d.sweep][3])}" r="6" fill="none" stroke="#b48631" stroke-width="1.8"/><path d="M${x(d.sweep)} ${y(d.candles[d.sweep][3])+(mirror?-7:7)} V${mirror?21:193} H58" fill="none" stroke="#a67c2d"/><text x="13" y="${mirror?15:209}" class="candle-label sweep-label">Liquidity sweep</text>`;
  const entryLabelY=mirror?209:24;
  const entryLeader=mirror?low+height+3:low-3;
  const entryMark=`<path d="M273 ${entryLeader} V${mirror?193:31} H249" fill="none" stroke="#397c51" stroke-width="1"/><text x="295" y="${entryLabelY}" text-anchor="end" class="candle-label entry-label">Entry zone</text>`;
  const timeBand=model==='silver'?`<path d="${mirror?'M206 29 V24 H294 V29':'M206 192 V197 H294 V192'}" fill="none" stroke="#a67c2d"/><text x="250" y="${mirror?15:213}" text-anchor="middle" class="candle-label sweep-label">Entry hour</text>`:'';
  const candles=d.candles.map(([o,c,h,l],i)=>{
    if(condition && i>condition.until) return '';
    const open=y(o),close=y(c),up=close<open;
    return `<g class="candle ${up?'up':'down'}" opacity="${condition&&!condition.candles.includes(i)?0.23:1}"><line x1="${x(i)}" x2="${x(i)}" y1="${Math.min(y(h),y(l))}" y2="${Math.max(y(h),y(l))}" stroke-width="1.5"/><rect x="${x(i)-5}" y="${Math.min(open,close)}" width="10" height="${Math.max(2,Math.abs(close-open))}" rx=".7"/></g>`;
  }).join('');
  const highlight=condition?`<g class="condition-overlay ${condition.invalid?'example-invalid':'example-valid'}">${condition.overlay}</g>`:'';
  const title=labels[saved?saved.checklist_id:model==='drill'?`drill_${wick?'wick':'fvg'}`:model];
  return `<figure class="entry-chart ${page==='check'?'chart-question':''}"><figcaption><strong>${phaseText}</strong><span>Schematic · not live</span></figcaption>${entry?`<div class="example-toggle" role="group" aria-label="Chart example"><button type="button" data-example="valid" aria-pressed="${state.exampleMode==='valid'}">✓ Valid</button><button type="button" data-example="invalid" aria-pressed="${state.exampleMode==='invalid'}">× Invalid</button></div>`:''}<svg class="candle-chart" viewBox="0 0 320 224" role="img" aria-label="${title} candlestick example. ${condition?condition.label:"Marked entry zone"}${!condition&&d.fvg?', three-candle FVG':''}${!condition&&d.sweep!==null&&d.sweep!==undefined?', liquidity sweep beyond the old level':''}. ${condition?condition.reason:d.note}"><g class="chart-grid"><path d="M13 55H295 M13 95H295 M13 135H295 M13 175H295"/></g>${condition?"":band+entryZone+oldLevel+midpoint}${candles}${condition?"":sweep+entryMark+timeBand}${highlight}</svg>${condition?`<div class="condition-confirm"><strong class="${condition.invalid?'example-no':'example-yes'}">${condition.invalid?'No in this example':'Yes in this example'}</strong><p>${condition.reason}</p><small>Example only · ${entry.auto?'your entered time is checked below':'answer for your own chart'}${model==='ote'?' · body-anchored 62–79%':model==='ifvg'?' · Scenario B · CE-close review':''}</small></div>`:`<div class="chart-steps">${d.phases.map((label,index)=>`<span><b>${index+1}</b>${label}</span>`).join('')}</div>${page==='setup'||page==='review'?`<p>${d.note}</p>`:''}`}</figure>`;
}
function historyChart(){
  const met=state.entries.filter(entry=>entry.checklist_met===true).length;
  const missed=state.entries.length-met;
  const max=Math.max(met,missed,1);
  return `<figure class="entry-chart history-chart"><figcaption><strong>Checklist results</strong><span>Recent ${state.entries.length} ${state.entries.length===1 ? "log" : "logs"}</span></figcaption><svg viewBox="0 0 320 88" role="img" aria-label="${met} entries met the checklist; ${missed} did not. Checklist results, not trading performance."><text x="12" y="30" class="chart-label">Met</text><text x="12" y="66" class="chart-label">Not met</text><rect x="74" y="16" width="${met/max*192}" height="20" rx="5" fill="#174f3b"/><rect x="74" y="52" width="${missed/max*192}" height="20" rx="5" fill="#c58c83"/><text x="291" y="30" text-anchor="end" class="chart-label">${met}</text><text x="291" y="66" text-anchor="end" class="chart-label">${missed}</text></svg><p>Checklist alignment · not trading performance</p></figure>`;
}

function requiredChecks(){
  return checklist().groups.flatMap(group => group.items).filter(entry => !entry.optional);
}
function reviewResult(){
  const checks = requiredChecks();
  const statuses = checks.map(answerFor);
  const resolved = !checklist().guard && checks.length > 0 && statuses.every(status => status === "yes" || status === "no");
  return {resolved,met:resolved && statuses.every(status => status === "yes")};
}
function liquidityContradiction(){
  const noSweep=state.liquidity.swept.some(item=>item.type==='no_sweep');
  const runAffirmed=(state.model==='drill' && state.variant==='fvg' && state.answers['io-sweep']==='yes') ||
    (state.model==='turtle' && state.answers['ts-run']==='yes');
  return noSweep && runAffirmed ? 'Liquidity says No sweep observed, but a required check says liquidity or a marked level was run. Review the liquidity selection or checklist answer.' : '';
}
function show(name){
  if(state.saving) return;
  if(name==="check") state.exampleMode="valid";
  state.screen = saveAttempts.size && !["history","recovery","saved"].includes(name) ? "recovery" : name;
  closeMenu();
  render();
  window.scrollTo({top:0,behavior:"instant"});
  const title = screen.querySelector("h1");
  if(title) title.focus({preventScroll:true});
}
function layout(top,body){
  const active=screen.contains?.(document.activeElement)?document.activeElement:null;
  const focusAttribute=active&&['id','data-outcome','data-direction','data-variant','data-range-choice','data-range-session','data-market-field','data-yahoo-symbol','data-chart-window','data-model','data-action'].find(name=>active.hasAttribute(name));
  const focusValue=focusAttribute?active.getAttribute(focusAttribute):null;
  persistDraft();
  const status=state.storageAvailable ? 'Draft saved in this tab' : 'Draft recovery unavailable — browser storage is blocked or full';
  const notice=state.draftNotice ? `<p class="notice" role="status">${escapeHTML(state.draftNotice)}</p>` : '';
  const undo=state.undoDraft && !saveAttempts.size ? '<button class="text-button" type="button" data-action="undo-draft">Undo last review replacement</button>' : '';
  const privateNotice='';
  screen.innerHTML = `${top}${privateNotice}${notice}${body}${state.draftActive || state.model || saveAttempts.size ? `<p id="draft-status" class="draft-status ${state.storageAvailable?'':'error'}" role="status">${status}</p>` : ''}${undo}`;
  if(focusAttribute){
    const replacement=[...screen.querySelectorAll(`[${focusAttribute}]`)].find(node=>node.getAttribute(focusAttribute)===focusValue);
    replacement?.focus({preventScroll:true});
  }
}
function closeMenu(){
  $("header-menu").hidden=true;
  $("menu-button").setAttribute("aria-expanded","false");
}
function setNow(){
  const [date,clock]=localTimeValue(new Date()).split('T');
  setEntryTime(date,clock);
}
function stepSegments(active){
  return `<div class="step-segments" aria-hidden="true">${[1,2,3,4,5].map(step => `<span class="${step <= active ? "active" : ""}"></span>`).join("")}</div>`;
}
function backRow(label,action,active=1,count=""){
  return `<div class="top-row"><button class="back-button" type="button" data-action="${action}" aria-label="Back to ${label}">←</button>${stepSegments(active)}${count ? `<span class="step-count">${count}</span>` : ""}</div>`;
}
function renderHome(){
  const cards = models.map(model => `<button class="model-card" type="button" data-model="${model.id}" aria-pressed="${state.model === model.id}"><span class="model-icon" aria-hidden="true">${glyphs[model.id]}</span><strong>${model.title}</strong><span class="model-select" aria-hidden="true">${state.model === model.id ? "✓" : ""}</span></button>`).join("");
  layout(`<div class="home-rule" aria-hidden="true"></div><h1 tabindex="-1">Choose Model</h1>`,
    `<div class="liquidity-summary">${liquiditySummary(state.liquidity)}${requiresDraws()?drawSummary(state.liquidityDraws):''}<button type="button" class="text-button" data-action="liquidity">${phase2PersistentLocal?'Edit liquidity':'Edit liquidity or range'}</button></div>${visibleRangeSummary()}<div class="card-list">${cards}</div>${chartIllustration("home")}<div class="action-stack"><button class="primary-button" type="button" data-action="choose-continue" ${state.model ? "" : "disabled"}>Continue <span aria-hidden="true">→</span></button></div>`);
}
function setupGuard(){ return checklist().guard || ""; }
function renderSetup(){
  const model = modelInfo();
  const variant = state.model === "drill" ? `<div class="form-section"><span class="field-label">Drill example</span><div class="choice-grid"><button type="button" class="choice-button" data-variant="fvg" aria-pressed="${state.variant === "fvg"}">FVG retest</button><button type="button" class="choice-button" data-variant="wick" aria-pressed="${state.variant === "wick"}">Wick midpoint</button></div></div>` : "";
  layout(`${backRow("Choose Model","home",1)}<h1 tabindex="-1">Set Up</h1><p class="setup-model">${model.title}</p>${modelScopeNote(checklistId())}<details class="source-details"><summary>Framework notes</summary><p>${checklist().intro}</p></details>`,
    `${phase2PersistentLocal?'':rangeSummary(validRange(state.dealingRange,Boolean(state.marketRangeIds))?state.dealingRange:null)}${!phase2PersistentLocal && state.model==='ote'?'<p class="helper">The wider dealing range is context. OTE impulse body anchors remain separate.</p>':''}<div class="form-section"><span class="field-label">Direction</span><div class="choice-grid"><button type="button" class="choice-button" data-direction="long" aria-pressed="${state.direction === "long"}">↗ &nbsp;Long</button><button type="button" class="choice-button" data-direction="short" aria-pressed="${state.direction === "short"}">↘ &nbsp;Short</button></div></div>${variant}${chartIllustration("setup")}<div class="form-section"><div class="field-heading"><span class="field-label">Entry date & time</span><button class="text-button" type="button" data-action="now">Use now</button></div><label class="time-field"><span aria-hidden="true">▦</span><span class="sr-only">Entry date</span><input id="entry-date" type="date" aria-label="Entry date"></label><label class="time-field"><span aria-hidden="true">◷</span><span class="sr-only">Entry time</span><input id="entry-clock" type="time" aria-label="Entry time"></label><p id="time-helper" class="helper" role="status"></p></div>${setupGuard() ? `<p class="notice">${setupGuard()}</p>` : ""}<div class="action-stack"><button id="start-button" class="primary-button" type="button" data-action="start">Start Checks <span aria-hidden="true">→</span></button></div>`);
  $("entry-date").value = state.dateValue;
  $("entry-clock").value = state.clockValue;
  updateSetupTime();
}
function updateSetupTime(){
  if(state.screen !== "setup") return;
  const parsed = parsedEntryTime();
  const helper = $("time-helper");
  if(!parsed.valid){helper.textContent=parsed.reason;helper.className=`helper ${state.timeValue ? "error" : ""}`;}
  else if(state.model === "silver"){
    const windowResult = checkSilverWindow();
    helper.textContent = windowResult.message;
    helper.className = `helper ${windowResult.status === "no" ? "error" : ""}`;
  }else{helper.textContent=`New York: ${formatNewYork(parsed.iso)}. Saved in UTC; displayed in ${deviceTimeZone()}.`;helper.className="helper";}
  if(parsed.valid && parsed.note) helper.textContent+=` ${parsed.note}`;
  $("start-button").disabled = !parsed.valid || Boolean(setupGuard());
}
function renderQuestion(){
  const checks = requiredChecks();
  state.questionIndex = Math.max(0,Math.min(state.questionIndex,checks.length-1));
  const entry = checks[state.questionIndex];
  const number = state.questionIndex+1;
  const status = answerFor(entry);
  const checkKind = state.model==='ifvg' ? "Illustrative review check" : entry.kind === "interpretation" ? "Planning check" : entry.kind === "component" ? "Source component check" : "Source check";
  const auto = entry.auto === "window";
  const choices = auto
    ? `<div class="notice">${checkSilverWindow().message}</div><div class="action-stack"><button class="primary-button" type="button" data-action="next">Continue <span aria-hidden="true">→</span></button></div>`
    : `<div class="answer-stack"><button class="answer-choice" type="button" data-choice="yes" aria-label="Yes, confirmed" aria-pressed="${status === "yes"}">✓ Yes</button><div class="answer-pair"><button class="answer-choice" type="button" data-choice="no" aria-label="No" aria-pressed="${status === "no"}">× No</button><button class="answer-choice" type="button" data-choice="unknown" aria-label="Not sure yet" aria-pressed="${status === "unknown"}">? Not sure</button></div></div>`;
  const reviewShortcut = reviewResult().resolved && number < checks.length ? `<div class="action-stack"><button class="secondary-button" type="button" data-action="review">Review result →</button></div>` : "";
  layout(`${backRow("Setup","previous",Math.max(1,Math.ceil(number/checks.length*5)),`${number} / ${checks.length}`)}<h1 class="sr-only" tabindex="-1">Check ${number} of ${checks.length}</h1>`,
    `${checkRangeDisclosure()}${modelScopeNote(checklistId())}<article class="question-card"><p class="helper">${checkKind}</p><div class="question-main"><span class="question-mark" aria-hidden="true">⊙</span><h2>${promptFor(entry)}</h2></div><p class="example-heading">${state.model==='ifvg'?'Illustrative example':'Teaching example'}</p>${chartIllustration("check",entry)}<details class="question-note"><summary aria-label="What to check">⌄</summary><p>${entry.title} ${entry.description}</p></details></article><p class="answer-heading">Your chart — is this condition met?</p>${choices}${reviewShortcut}${auto ? `<p class="question-footer">Checked from your entry time.</p>` : ""}`);
}
function formatLocal(iso){
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "Invalid time" : date.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"});
}
function formatNewYork(iso){
  const date=new Date(iso);
  return Number.isNaN(date.getTime()) ? "Invalid time" : new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"}).format(date);
}
function versionLabel(version){ return typeof version==='string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version) && version!=='legacy' ? `Checklist ${version}` : 'Earlier checklist · version unknown'; }
function nyTimeNote(id,iso){ return id==='silver' ? `<p class="helper">New York: ${formatNewYork(iso)}</p>` : ''; }
function renderRecovery(){
  const first=saveAttempts.entries().next().value;
  if(!first){show('home');return;}
  const entry=JSON.parse(first[0]);
  const rejected=state.rejectedSave?.body===first[0] && state.rejectedSave?.key===first[1] ? state.rejectedSave.status : null;
  layout('<h1 tabindex="-1">Confirm saved review</h1>',
    `<p class="review-detail">This review may already be in your log. Retry to confirm it before starting another review.</p><div class="saved-card"><strong>${labels[entry.checklist_id]}</strong><span>${formatLocal(entry.entry_time_utc)}</span><span>Checklist ${entry.checklist_met?'Met':'Not Met'}</span><small>${versionLabel(entry.checklist_version)}</small></div>${modelScopeNote(entry.checklist_id)}${nyTimeNote(entry.checklist_id,entry.entry_time_utc)}${entry.entry_snapshot?.schema_version===3?'<p class="historical-warning">Historical context in this pending review is retrospective and unverified. Retry keeps the original request and key.</p>':''}<p class="helper">${saveAttempts.size>1?`${saveAttempts.size} earlier save attempts need confirmation.`:'The original result and request are kept for this confirmation.'}</p><div class="action-stack"><button class="primary-button" type="button" data-action="save" ${state.saving?'disabled':''}>${state.saving?'Confirming…':'Retry Save Entry'}</button><button class="text-button" type="button" data-action="history" ${state.saving?'disabled':''}>View history</button></div><p id="save-feedback" class="feedback" role="status"></p>`);
  if(rejected){
    const notice=rejected===409?'This request key conflicts with an existing entry. Check History before editing or discarding this pending review; a new save could create a duplicate.':'The log rejected this request. It did not confirm a save. Review your answers and context before trying a new request.';
    screen.innerHTML+=`<p class="notice" role="alert">${notice}</p><div class="action-stack"><button class="secondary-button" type="button" data-action="recovery-edit">Edit rejected review</button><button class="text-button" type="button" data-action="recovery-discard">Discard pending review</button></div>`;
  }
  if(state.saveMessage){const feedback=$("save-feedback");feedback.textContent=state.saveMessage.text;feedback.className=`feedback ${state.saveMessage.kind}`;}
}
function resolveRejectedSave(discard=false){
  const first=saveAttempts.entries().next().value,rejected=state.rejectedSave;
  if(!first || !rejected || rejected.body!==first[0] || rejected.key!==first[1] || ![400,409].includes(rejected.status)) return;
  if((discard || rejected.status===409) && !window.confirm(rejected.status===409 ?
    'A review already uses this request key. Check History first. Removing this pending request may allow a duplicate if you save again. Continue?' :
    'Discard this unsaved review and its pending request? This cannot be undone.')) return;
  const before=[...saveAttempts];
  saveAttempts.delete(first[0]);state.rejectedSave=null;
  if(!persistDraft()){
    saveAttempts.clear();for(const pair of before)saveAttempts.set(...pair);
    state.rejectedSave=rejected;
    state.saveMessage={kind:'error',text:'Recovery details could not be updated in this tab. The original request and key are retained.'};
    renderRecovery();return;
  }
  if(saveAttempts.size){
    state.saveMessage={kind:'error',text:'This rejected request was removed. Confirm the remaining pending request before editing this review.'};
    show('recovery');return;
  }
  state.saveMessage=null;
  if(discard){state.undoDraft=null;clearDraft();show('entry');}
  else {state.draftNotice='The rejected request was removed. Review your entry before saving with a new request key.';show(state.model?'review':'entry');}
}
function renderReview(){
  const result = reviewResult();
  const contradiction=liquidityContradiction();
  const checks = requiredChecks();
  const unresolved = checks.filter(entry => !["yes","no"].includes(answerFor(entry))).length;
  const resultClass = !result.resolved ? "review" : result.met ? "" : "not-met";
  const icon = !result.resolved ? "?" : result.met ? "✓" : "×";
  const resultTitle = state.model==='ifvg' ? (!result.resolved?'Illustrative review incomplete':result.met?'Illustrative checks met':'Illustrative checks not met') : !result.resolved ? "Needs review" : result.met ? "Checklist met" : "Checklist not met";
  const resultText = !result.resolved ? `${unresolved} check${unresolved === 1 ? "" : "s"} still marked Not sure. Resolve before saving.` : result.met ? "Every required check was confirmed." : "At least one required check is No.";
  const rows = checks.map((entry,index) => {
    const answer=answerFor(entry);
    const answerLabel=answer==='yes'?'Yes':answer==='no'?'No':'Not sure';
    return `<button class="check-row" type="button" data-edit="${index}" data-status="${answer}" aria-label="Edit check ${index+1}: ${escapeHTML(promptFor(entry))}. Answer: ${answerLabel}"><span class="check-num">${index+1}</span><span class="check-label">${promptFor(entry)}</span><span class="check-status" aria-hidden="true">${answer==='yes'?'✓':answer==='no'?'×':'?'}</span></button>`;
  }).join("");
  const sources = modelInfo().sources.map(source => `<a href="${source.href}" target="_blank" rel="noopener noreferrer">${source.label} ↗</a>`).join("");
  const time = parsedEntryTime();
  const liquidityValid=validLiquidity(canonicalLiquidity()) && (!requiresDraws() || validCurrentDraws());
  const marketReview=marketSelectionReview();
  const targetTimingProblem=phase2PreviewEnabled && (state.marketTargetId || state.marketRangeIds) && time.valid?historicalTargetTimingProblem(time.iso):'';
  const marketReady=(!phase2PreviewEnabled || (!state.marketContextIds.length && !state.marketRangeIds) || Boolean(marketSelectionRequest())) && !targetTimingProblem;
  const saveBlocked = !state.storageAvailable || !liquidityValid || !validRange(state.dealingRange,Boolean(state.marketRangeIds)) || !marketReady || !result.resolved || !time.valid || state.apiStatus !== "ready" || state.saving;
  layout(`${backRow("Checks","previous",4)}<h1 tabindex="-1">Review</h1>`,
    `<div class="review-card ${resultClass}"><div class="review-result"><span class="review-icon" aria-hidden="true">${icon}</span><h2>${resultTitle}</h2></div><div class="review-summary"><div><span aria-hidden="true">▱</span><strong>${labels[checklistId()]}</strong></div><div><span aria-hidden="true">◷</span><strong>${time.valid ? formatLocal(time.iso) : "Missing"}</strong></div></div></div><p class="review-detail">${resultText}</p>${modelScopeNote(checklistId())}${time.valid?nyTimeNote(checklistId(),time.iso):""}<p class="helper">${versionLabel(checklistVersionFor(state.model))} · ${state.direction==='long'?'Long':'Short'}</p><div class="liquidity-summary">${liquiditySummary(state.liquidity)}${requiresDraws()?drawSummary(state.liquidityDraws):''}<button type="button" class="text-button" data-action="liquidity">${phase2PersistentLocal?'Edit liquidity':'Edit liquidity or range'}</button></div>${visibleRangeSummary()}${marketReview}<p class="quality-summary">${result.resolved?qualityText(snapshotForReview(marketReady)):'Checklist score pending · resolve every required check'}</p>${!marketReady?`<p class="notice">${escapeHTML(targetTimingProblem||'Reload the historical snapshot and reselect references before saving.')}</p>`:''}${!liquidityValid||!validRange(state.dealingRange,Boolean(state.marketRangeIds))?`<p class="notice">${requiresDraws()?'Complete liquidity and both draw prices':'Complete or skip optional context'} before saving. <button type="button" class="text-button" data-action="liquidity">Edit context</button></p>`:''}${chartIllustration("review")}<div class="check-list" aria-label="Checks; tap a row to edit">${rows}</div><div class="action-stack"><button id="save-button" class="primary-button" type="button" data-action="save" ${saveBlocked ? "disabled" : ""}>${state.saving ? "Saving…" : "Save entry review"}</button><button class="text-button" type="button" data-action="edit-setup">Edit time or direction</button></div><p id="save-feedback" class="feedback" role="status"></p><details class="source-details"><summary>Source notes</summary><div class="source-links">${sources}</div></details>`);
  const feedback = $("save-feedback");
  if(contradiction){
    const warning=document.createElement('p');
    warning.className='notice';warning.setAttribute('role','alert');warning.textContent=contradiction;
    screen.querySelector('.liquidity-summary')?.after(warning);
  }
  if(state.saveMessage){feedback.textContent=state.saveMessage.text;feedback.className=`feedback ${state.saveMessage.kind}`;}
  else if(state.apiStatus === "loading") feedback.textContent="Opening this browser's journal…";
  else if(state.apiStatus !== "ready") feedback.textContent="Browser journal unavailable. Check site storage and free space, close other ICT Entry Desk tabs, then refresh.";
  else if(!marketReady) feedback.textContent=targetTimingProblem||"Reload the historical snapshot and reselect references before saving.";
  else if(!result.resolved) feedback.textContent="Tap a Not sure check above to resolve it.";
  else feedback.textContent="Stores your original required answers and liquidity context. Record a trade outcome separately.";
}
function renderSaved(){
  const entry=state.savedEntry;
  layout(`<div class="saved-hero"><span class="saved-mark ${entry.checklist_met?'':'not-met'}" aria-hidden="true">${entry.checklist_met?'✓':'×'}</span><h1 tabindex="-1">Entry review saved</h1></div>`,
    `${entrySummary(entry)}${validSnapshot(entry.entry_snapshot)?`<div class="liquidity-summary">${liquiditySummary(entry.entry_snapshot.liquidity)}${[4,5].includes(entry.entry_snapshot.schema_version)?drawSummary(entry.entry_snapshot.liquidity_draws):''}</div>`:""}${rangeSummary(entry.entry_snapshot?.dealing_range)}${marketSummary(entry.entry_snapshot)}<p class="outcome-note">${outcomeLabel(entry.outcome)}</p><div class="action-stack"><button class="primary-button" type="button" data-action="saved-outcome">Record trade outcome</button><button class="secondary-button" type="button" data-action="history">View history</button><button class="text-button" type="button" data-action="new">New review</button></div>`);
}
function renderHistory(){
  const ready=state.apiStatus==='ready';
  const rows=ready?state.entries.map(entry=>`<button type="button" class="history-card" data-entry="${Number(entry.id)}"><span class="history-glyph" aria-hidden="true">${glyphs[String(entry.checklist_id).startsWith('drill')?'drill':entry.checklist_id]||'▱'}</span><span class="history-info"><strong>${escapeHTML(labels[entry.checklist_id]||'Unknown checklist')}</strong><time datetime="${escapeHTML(entry.entry_time_utc)}">${escapeHTML(formatLocal(entry.entry_time_utc))}</time><small>${qualityText(entry.entry_snapshot)}</small><small>Instrument: ${escapeHTML(instrumentText(entry.entry_snapshot))}</small>${modelScopeHistoryNote(entry.checklist_id)?`<small>${modelScopeHistoryNote(entry.checklist_id)}</small>`:''}<small>Range: ${escapeHTML(rangeHistoryText(entry.entry_snapshot))}</small>${entry.entry_snapshot?.market_context?.state==='historical_reconstruction_unverified'?'<small>Historical context · unverified</small>':''}<span class="history-outcome">${outcomeLabel(entry.outcome)}</span></span><span class="history-result ${entry.checklist_met?'':'not-met'}">${entry.checklist_met?'MET':'NOT MET'}</span></button>`).join(''):'';
  layout('<h1 tabindex="-1">History</h1>', `${state.draftActive || state.model || saveAttempts.size ? `<button class="secondary-button resume-button" type="button" data-action="resume">${saveAttempts.size?'Confirm pending save':'Resume review'}</button>`:''}${ready?renderScoreboard():''}<h2 class="history-heading">Recent reviews <span>Latest ${state.entries.length} · up to 50</span></h2>${!ready?`<p class="empty-state">${state.apiStatus==='loading'?'Loading entries…':'The local entry log is unavailable.'}</p>`:!state.entries.length?'<p class="empty-state">Your scoreboard starts with your first entry review.</p>':`<div class="history-list">${rows}</div>`}<div class="history-actions"><button class="text-button" type="button" data-action="refresh">Refresh</button></div>`);
}
function renderDetail(){
  const entry=state.selectedEntry,snapshot=entry.entry_snapshot;
  const answers=validSnapshot(snapshot)?`<h2 class="detail-heading">Original required answers</h2><ol class="original-answers">${snapshot.checks.map(check=>`<li><span>${escapeHTML(check.title)}${check.automatic?'<small>Automatic check</small>':''}</span><strong class="${check.answer==='yes'?'good':'bad'}">${check.answer==='yes'?'Yes':'No'}</strong></li>`).join('')}</ol>`:'<p class="notice">Detailed score unavailable. This earlier review retains its original checklist result.</p><p class="helper">Liquidity context and direction were not recorded.</p>';
  layout(`${backRow('History','history',5)}<h1 tabindex="-1">Entry review</h1>`,`${state.outcomeSaved?'<p class="notice" role="status">Outcome saved. Your original checklist answers are unchanged.</p>':""}${entrySummary(entry)}${validSnapshot(snapshot)?`<div class="liquidity-summary">${liquiditySummary(snapshot.liquidity)}${[4,5].includes(snapshot.schema_version)?drawSummary(snapshot.liquidity_draws):''}</div>`:''}${rangeSummary(snapshot?.dealing_range)}${marketSummary(snapshot)}${answers}<div class="outcome-panel"><h2>Trade outcome</h2><p>${outcomeLabel(entry.outcome)}</p>${entry.outcome_updated_at?`<p class="helper">Updated ${escapeHTML(formatLocal(entry.outcome_updated_at))}</p>`:''}<button type="button" class="secondary-button" data-action="edit-outcome">Record or edit outcome</button></div>`);
}
function renderOutcome(){
  const entry=state.selectedEntry;
  layout(`${backRow('Entry review','detail',5)}<h1 tabindex="-1">Did you take this trade?</h1>`,`${entrySummary(entry)}<p class="review-detail">Record the trade outcome for this review.</p><div class="outcome-choices" role="group" aria-label="Trade outcome">${Object.entries(outcomes).map(([value,label])=>`<button type="button" class="outcome-choice" data-outcome="${value}" aria-pressed="${state.outcomeSelection===value}">${label}</button>`).join('')}</div><div class="action-stack"><button type="button" class="primary-button" data-action="save-outcome">${state.saving?'Saving…':'Save outcome'}</button></div><p class="feedback ${state.outcomeMessage?'error':''}" role="status">${escapeHTML(state.outcomeMessage||'Original checklist answers stay as recorded at entry.')}</p>`);
}
function render(){
  if(state.screen === "entry") renderEntry();
  else if(state.screen === "liquidity") renderLiquidity();
  else if(state.screen === "detail" && state.selectedEntry) renderDetail();
  else if(state.screen === "outcome" && state.selectedEntry) renderOutcome();
  else if(state.screen === "recovery" && saveAttempts.size) renderRecovery();
  else if(state.screen === "setup" && state.model) renderSetup();
  else if(state.screen === "check" && state.model) renderQuestion();
  else if(state.screen === "review" && state.model) renderReview();
  else if(state.screen === "saved" && state.savedEntry) renderSaved();
  else if(state.screen === "history") renderHistory();
  else renderHome();
  $("nav-home").setAttribute("aria-current",state.screen === "home" ? "page" : "false");
  $("nav-history").setAttribute("aria-current",state.screen === "history" ? "page" : "false");
  syncSavingControls();
}
function nextCheck(){
  const count=requiredChecks().length;
  if(state.questionIndex < count-1){state.questionIndex++;show("check");}
  else show("review");
}
function previous(){
  if(state.screen === "review"){state.questionIndex=requiredChecks().length-1;show("check");}
  else if(state.questionIndex > 0){state.questionIndex--;show("check");}
  else show("setup");
}
async function loadEntries(){
  const sequence=++entryLoadSequence;
  try{
    const data=await fetchEntriesJSON({headers:{Accept:"application/json"},cache:"no-store"});
    if(sequence!==entryLoadSequence) return;
    if(!data || !Array.isArray(data.entries)) throw new Error("Unexpected response");
    state.entries=data.entries;
    state.scoreboard=data.scoreboard || null;
    state.apiStatus="ready";
  }catch{
    if(sequence!==entryLoadSequence) return;
    state.apiStatus="unavailable";
  }
  if(state.screen === "history" || state.screen === "review") render();
}

async function saveEntry(){
  if(state.saving) return;
  if(!saveAttempts.size){
    const result=reviewResult(),time=parsedEntryTime();
    if(state.apiStatus!=="ready" || !result.resolved || !time.valid || !validLiquidity(canonicalLiquidity()) || (requiresDraws() && !validCurrentDraws()) || !validRange(state.dealingRange,Boolean(state.marketRangeIds)) ||
       (phase2PreviewEnabled && historicalTargetTimingProblem(time.iso)) ||
       (phase2PreviewEnabled && (state.marketContextIds.length || state.marketRangeIds) && !marketSelectionRequest())) return;
    const body=JSON.stringify({checklist_id:checklistId(),entry_time_utc:time.iso,checklist_met:result.met,checklist_version:checklistVersionFor(state.model),entry_snapshot:snapshotForReview()});
    saveAttempts.set(body,crypto.randomUUID());
  }
  const [body,requestKey]=saveAttempts.entries().next().value;
  const submitted=JSON.parse(body);
  state.screen='recovery';state.saveMessage=null;state.rejectedSave=null;
  if(!persistDraft()){
    state.saveMessage={kind:'error',text:'Save paused: this browser cannot keep the retry details. Enable tab storage, then retry. No request was sent.'};
    renderRecovery();return;
  }
  state.saving=true;renderRecovery();syncSavingControls();
  try{
    const created=await fetchEntriesJSON({method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json","Idempotency-Key":requestKey},body});
    if(!created || !Number.isInteger(created.id) || created.checklist_id!==submitted.checklist_id ||
       created.checklist_met!==submitted.checklist_met ||
       created.checklist_version!==(submitted.checklist_version || 'legacy') ||
       Date.parse(created.entry_time_utc)!==Math.floor(Date.parse(submitted.entry_time_utc)/1000)*1000 ||
       (submitted.entry_snapshot && !matchingSnapshot(submitted.entry_snapshot,created.entry_snapshot))) throw new Error('Unexpected response');
    state.savedEntry=created;saveAttempts.delete(body);state.saving=false;syncSavingControls();
    if(saveAttempts.size){persistDraft();show('recovery');}
    else{state.undoDraft=null;clearDraft();show('saved');}
    await loadEntries();
  }catch(error){
    state.saving=false;syncSavingControls();
    if(error.status===413){
      // The local server rejects oversized bodies before parsing or writing.
      // Keep the review editable; never shorten evidence or reuse this rejected key.
      saveAttempts.delete(body);
      state.saveMessage={kind:'error',text:'The local server rejected this review because it exceeds the save-size limit. No entry was stored. Edit the review explicitly, then save again; no text or evidence was shortened automatically.'};
      state.screen=saveAttempts.size?'recovery':'review';
      persistDraft();render();return;
    }
    if([400,409].includes(error.status)){
      state.rejectedSave={body,key:requestKey,status:error.status};
      state.saveMessage={kind:'error',text:error.status===409?
        'The log reports a request-key conflict. Another entry may already use this key. Check History, then choose Edit or Discard if appropriate.':
        'The log rejected this review. Check the fields and choose Edit to correct it, or Discard to start over.'};
      persistDraft();
    }else state.saveMessage={kind:'error',text:'Save could not be confirmed. Retry this saved review with the same request key to avoid a duplicate.'};
    renderRecovery();
  }
}

screen.addEventListener("click",event => {
  if(state.saving) return;
  if(event.target.closest('a[href="#data-notes"]')){
    const details=screen.querySelector('#data-notes');
    if(details){event.preventDefault?.();details.open=true;details.scrollIntoView?.({block:'nearest'});}
    return;
  }
  const pendingAction=event.target.closest("[data-action]")?.dataset.action;
  if(saveAttempts.size && !['save','history','refresh','resume','recovery-edit','recovery-discard'].includes(pendingAction)){show('recovery');return;}
  const marketRange=event.target.closest('[data-market-range]');
  if(marketRange && state.screen==='liquidity'){selectMarketRange(marketRange.dataset.marketRange);return;}
  const marketTarget=event.target.closest('[data-market-target]');
  if(marketTarget && state.screen==='liquidity'){selectMarketTarget(marketTarget.dataset.marketTarget);return;}
  const marketRef=event.target.closest('[data-market-ref]');
  if(marketRef && state.screen==='liquidity'){selectMarketReference(marketRef.dataset.marketRef);return;}
  const liquidityOption=event.target.closest('[data-liquidity]');
  if(liquidityOption){selectLiquidity(liquidityOption.dataset.liquidity,liquidityOption.dataset.type);return;}
  const historyEntry=event.target.closest('[data-entry]');
  if(historyEntry){const entry=state.entries.find(entry=>entry.id===Number(historyEntry.dataset.entry));if(entry){state.selectedEntry=entry;state.outcomeSaved=false;show('detail');}return;}
  const outcome=event.target.closest('[data-outcome]');
  if(outcome && Object.hasOwn(outcomes,outcome.dataset.outcome)){state.outcomeSelection=outcome.dataset.outcome;state.outcomeMessage=null;render();return;}
  const example=event.target.closest("[data-example]");
  if(example && state.screen==="check"){
    state.exampleMode=example.dataset.example;
    renderQuestion();
    screen.querySelector(`[data-example="${state.exampleMode}"]`).focus({preventScroll:true});
    return;
  }
  const model=event.target.closest("[data-model]");
  if(model){if(state.model!==model.dataset.model) replaceDraft(model.dataset.model);else renderHome();return;}
  const direction=event.target.closest("[data-direction]");
  if(direction){if(state.direction!==direction.dataset.direction){state.direction=direction.dataset.direction;state.answers={};renderSetup();}return;}
  const variant=event.target.closest("[data-variant]");
  if(variant){if(state.variant!==variant.dataset.variant){state.variant=variant.dataset.variant;state.answers={};renderSetup();}return;}
  const choice=event.target.closest("[data-choice]");
  if(choice && state.screen==="check"){
    const entry=requiredChecks()[state.questionIndex];
    if(!entry.auto){state.answers[entry.id]=choice.dataset.choice;state.saveMessage=null;nextCheck();}
    return;
  }
  const edit=event.target.closest("[data-edit]");
  if(edit){state.questionIndex=Number(edit.dataset.edit);show("check");return;}
  const rangeChoice=event.target.closest('[data-range-choice]')?.dataset.rangeChoice;
  if(rangeChoice){
    restoreManualRange();
    const previous=state.dealingRange;
    state.dealingRange=['skipped','not_sure'].includes(rangeChoice)?{status:rangeChoice}:{status:'editing',kind:rangeChoice,session:rangeChoice==='session'?(previous.kind==='session'?previous.session:''):null,label:rangeChoice==='custom'?(previous.kind==='custom'?previous.label:''):'',timeframe:rangeTimeframes.includes(previous.timeframe)?previous.timeframe:'15-minute',high:previous.kind===rangeChoice?previous.high:'',low:previous.kind===rangeChoice?previous.low:''};
    state.rangeError='';renderLiquidity();persistDraft();return;
  }
  const rangeSession=event.target.closest('[data-range-session]')?.dataset.rangeSession;
  if(rangeSession && rangeSessions.includes(rangeSession)){state.dealingRange.session=rangeSession;state.dealingRange.status='editing';state.rangeError='';renderLiquidity();persistDraft();return;}
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(!action) return;
  if(action==='entry-available' && state.screen==='entry'){useDeclaredFallbackCutoff();}
  else if(action==='yahoo-cache-read' && state.screen==='entry'){readYahooCache();}
  else if(action==='refresh-price' && state.screen==='entry'){refreshSelectedPrice();}
  else if(action==='refresh-yahoo-latest' && state.screen==='entry'){refreshYahooLatest();}
  else if(action==='refresh-15m' && state.screen==='entry'){refreshSelected15m();}
  else if(action==='entry-load' && state.screen==='entry'){loadEntryMarket();}
  else if(action==='hidden-context-keep' && state.screen==='entry' && phase2PersistentLocal && validRange(state.dealingRange,Boolean(state.marketRangeIds))){state.hiddenContextReviewed=true;persistDraft();renderEntry();}
  else if(action==='hidden-context-clear' && state.screen==='entry' && phase2PersistentLocal){
    if(!window.confirm('Clear the hidden range and historical selections from this unsaved draft? Saved entries stay unchanged.')) return;
    restoreManualTarget();restoreManualRange();state.marketContextIds=[];state.marketRangeIds=null;
    state.dealingRange={status:'skipped'};state.rangeError='';state.hiddenContextReviewed=true;
    resetPhase2Client();persistDraft();renderEntry();
  }
  else if(action==='entry-continue' && state.screen==='entry'){
    if(phase2PersistentLocal && hiddenContextActive() && !state.hiddenContextReviewed){renderEntry();return;}
    show('liquidity');
  }
  else if(action==='entry'){show('entry');}
  else if(action==='historical-load' && state.screen==='liquidity'){loadHistoricalContext();}
  else if(action==='target-manual' && state.screen==='liquidity'){restoreManualTarget();renderLiquidity();persistDraft();}
  else if(action==='chart-load' && state.screen==='liquidity' && phase2Client?.getSnapshot()){loadHistoricalChart(phase2Client.getSnapshot());renderLiquidity();}
  else if(action==='liquidity'){state.liquidityReturn=state.screen==='review'?'review':'home';show('liquidity');}
  else if(action==='liquidity-continue'){
    const error=state.liquidity.skipped?'':liquidityProblem(state.liquidity);state.liquidityError=error || (requiresDraws()?drawInputProblem(state.liquidityDraws):'');
    state.rangeError=validRange(state.dealingRange,Boolean(state.marketRangeIds))?'':'Confirm high and low, choose Not sure yet, or skip the range.';
    if(state.liquidityError || state.rangeError) renderLiquidity();else show(state.liquidityReturn==='review' && state.model?'review':'home');
  }
  else if(action==='liquidity-restore'){state.liquidity.skipped=false;state.liquidityError='';renderLiquidity();persistDraft();}
  else if(action==='liquidity-skip' && !requiresDraws()){restoreManualTarget();state.liquidity.skipped=true;state.liquidityError='';if(!validRange(state.dealingRange,Boolean(state.marketRangeIds))) state.dealingRange={status:'skipped'};state.rangeError='';show(state.liquidityReturn==='review' && state.model?'review':'home');}
  else if(action==='range-confirm'){
    const value=state.dealingRange;
    const candidate={...value,status:'confirmed',label:String(value.label||'').trim(),high:value.high===''?NaN:Number(value.high),low:value.low===''?NaN:Number(value.low)};
    if(validRange(candidate)){state.dealingRange=candidate;state.rangeError='';persistDraft();renderLiquidity();}
    else {state.rangeError='Choose a session or label, timeframe, and a finite high greater than the low.';renderLiquidity();}
  }
  else if(action==='saved-outcome'){state.selectedEntry=state.savedEntry;openOutcome();}
  else if(action==='edit-outcome') openOutcome();
  else if(action==='save-outcome') saveOutcome();
  else if(action==='detail') show('detail');
  else if(action==="home") show("home");
  else if(action==="choose-continue" && state.model) show("setup");
  else if(action==="now"){
    setNow();$("entry-date").value=state.dateValue;$("entry-clock").value=state.clockValue;updateSetupTime();persistDraft();
  }
  else if(action==="start" && parsedEntryTime().valid && !setupGuard()){state.questionIndex=0;show("check");}
  else if(action==="next") nextCheck();
  else if(action==="review" && reviewResult().resolved) show("review");
  else if(action==="previous") previous();
  else if(action==="edit-setup") show("setup");
  else if(action==="save") saveEntry();
  else if(action==="recovery-edit") resolveRejectedSave(false);
  else if(action==="recovery-discard") resolveRejectedSave(true);
  else if(action==="history"){openHistory();}
  else if(action==="history-back" || action==="resume") resumeReview();
  else if(action==="undo-draft") undoReplacement();
  else if(action==="refresh"){state.apiStatus="loading";renderHistory();loadEntries();}
  else if(action==="new") replaceDraft();
});
screen.addEventListener("input",event => {
  if(state.saving || saveAttempts.size) return;
  if(state.screen==='liquidity' && event.target.dataset?.drawSide){
    const side=event.target.dataset.drawSide,field=event.target.dataset.drawField;
    if(!['buy','sell'].includes(side) || !['type','detail','price'].includes(field)) return;
    const row=state.liquidityDraws[side];
    if(field==='type'){
      const types=side==='buy'?buySideSweeps:sellSideSweeps;
      row.type=types.includes(event.target.value)?event.target.value:'';row.detail='';state.liquidityError='';persistDraft();renderLiquidity();
      screen.querySelector(`[data-draw-side="${side}"][data-draw-field="${row.type.startsWith('session_')||row.type.startsWith('equal_')||row.type.startsWith('swing_')?'detail':'price'}"]`)?.focus({preventScroll:true});
    }else{
      row[field]=event.target.value;state.liquidityError=drawInputProblem(state.liquidityDraws);persistDraft();
      const error=screen.querySelector('#liquidity-error');if(error)error.textContent=state.liquidityError;
      const button=screen.querySelector('[data-action="liquidity-continue"]');if(button)button.disabled=!validCurrentDraws();
    }
    return;
  }
  if(state.screen==='entry' && event.target.dataset?.yahooSymbol!==undefined){
    yahooPanel.requestId++;
    yahooPanel.symbol=event.target.value==='ES=F'?'ES=F':'NQ=F';
    yahooPanel.result=null;yahooPanel.status='idle';yahooPanel.message='Choose Read cached price to inspect this series.';
    renderEntry();return;
  }
  if(state.screen==='liquidity' && event.target.dataset?.chartWindow!==undefined){
    historicalChart.windowId=event.target.value;renderLiquidity();return;
  }
  const marketField=event.target.dataset?.marketField;
  if(phase2PersistentLocal && state.screen==='entry' && marketField==='instrument'){
    if(hiddenContextActive()){event.target.value=state.marketInstrument;renderEntry();return;}
    const next=event.target.value;
    if(!['NQ_continuous_provisional','ES_unavailable','CL_unavailable'].includes(next)) return;
    if(next===state.marketInstrument) return;
    state.marketInstrument=next;state.marketDateNY=currentNYDate();state.marketCutoffUTC='';
    state.hiddenContextReviewed=false;state.draftActive=true;persistDraft();renderEntry();return;
  }
  if(state.screen==='entry' && ['instrument','date','cutoff'].includes(marketField)){
    entryMarketLoadSequence++;
    restoreManualTarget();restoreManualRange();
    historicalChart.request++;historicalChart.response=null;historicalChart.status='idle';
    state.marketContextIds=[];state.marketContextError='';
    state[marketField==='instrument'?'marketInstrument':marketField==='date'?'marketDateNY':'marketCutoffUTC']=event.target.value;
    phase2Client?.select(state.marketDateNY,state.marketCutoffUTC);
    state.marketMessage='Selection changed. Load a historical snapshot or continue manually.';
    const status=document.getElementById('entry-market-status');if(status)status.textContent=state.marketMessage;
    const result=document.getElementById('entry-market-result');if(result)result.innerHTML='<p class="helper">Historical snapshot cleared. Midnight Open and Week Open remain unavailable.</p>';
    persistDraft();return;
  }
  const historicalField=event.target.dataset?.historicalField;
  if(state.screen==='liquidity' && ['date','cutoff'].includes(historicalField)){
    historicalPanel[historicalField]=event.target.value;
    historicalPanel.response=null;historicalPanel.status='idle';historicalPanel.message='Selection changed. Load a historical snapshot to see levels.';
    historicalPanel.request++;
    const status=document.getElementById('historical-status');if(status)status.textContent=historicalPanel.message;
    const result=document.getElementById('historical-result');if(result)result.innerHTML='';
    const load=screen.querySelector('[data-action="historical-load"]');if(load)load.disabled=false;
    return;
  }
  const rangeField=event.target.dataset?.rangeField;
  if(rangeField && ['label','timeframe','high','low'].includes(rangeField)){
    state.dealingRange={...state.dealingRange,status:'editing',[rangeField]:event.target.value};
    state.rangeError='';persistDraft();return;
  }
  if(event.target.dataset?.liquidityLabel){
    const field=event.target.dataset.liquidityLabel,type=event.target.dataset.type;
    const reference=field==='swept'?state.liquidity.swept.find(item=>item.type===type):state.liquidity.target;
    if(reference && reference.type===type){
      reference.label=event.target.value;
      state.liquidityError=invalidLiquidityLabel(state.liquidity)?'Remove control characters from liquidity labels before continuing.':'';
      const error=screen.querySelector('#liquidity-error');if(error)error.textContent=state.liquidityError;
      persistDraft();
    }
    return;
  }
  if(event.target.id==="entry-date" || event.target.id==="entry-clock"){
    setEntryTime($("entry-date").value,$("entry-clock").value);
    updateSetupTime();persistDraft();
  }
});
$("home-button").addEventListener("click",()=>show("home"));
$("menu-button").addEventListener("click",()=>{
  if(state.saving) return;
  const menu=$("header-menu");menu.hidden=!menu.hidden;$("menu-button").setAttribute("aria-expanded",String(!menu.hidden));
});
$("header-menu").addEventListener("click",event=>{
  if(state.saving) return;
  const nav=event.target.closest("[data-nav]")?.dataset.nav;
  if(nav==="home") show("home");
  else if(nav==="new") replaceDraft();
  else if(nav==="history"){openHistory();}
});
$("nav-home").addEventListener("click",()=>show("home"));
$("nav-new").addEventListener("click",()=>{replaceDraft();});
$("nav-history").addEventListener("click",()=>{if(state.saving) return;openHistory();});

restoreDraft();
if(!state.marketInstrument)state.marketInstrument='NQ_continuous_provisional';
loadPhase2Capability();
render();
loadEntries();
