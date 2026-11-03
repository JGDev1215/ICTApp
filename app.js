"use strict";


const models = [
  {id:"ote", number:"01", short:"OTE", title:"OTE Entry Model", subtitle:"Retracement into an impulse", summary:"Review the 2016/17 body-anchored 62–79% OTE variant, including structure and protective swing.", sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]},
  {id:"turtle", number:"02", short:"TS", title:"Turtle Soup", subtitle:"False break of an old level", summary:"Review a run beyond a preidentified high or low, its context, and observable evidence that the break failed.", sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]},
  {id:"drill", number:"03", short:"IO", title:"Institutional Order Flow Entry Drill", subtitle:"FVG or wick retest", summary:"Choose one documented drill variant. The FVG and wick examples are separate observations, not a single automatic combined setup.", sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]},
  {id:"silver", number:"04", short:"SB", title:"Silver Bullet", subtitle:"Time-windowed FVG reprice", summary:"A qualifying FVG reprice must fit the selected New York local-time entry window and an already stated draw on liquidity.", sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]},
  {id:"ifvg", number:"05", short:"iFVG", title:"Inversion FVG", subtitle:"Failed gap, opposite role", summary:"Review Scenario B with conservative CE-close confirmation after the original FVG fails.", sources:[{label:"Checklist source notes",href:"SOURCE_MAP.md"}]}
];

const CHECKLIST_VERSION = "2026-11-03.2";
const state = {exampleMode:"valid",screen:"home", returnScreen:"home", model:null, direction:"long", variant:"fvg", answers:{}, timeValue:"", dateValue:"", clockValue:"", questionIndex:0, entries:[], apiStatus:"loading", saving:false, saveMessage:null, savedEntry:null, undoDraft:null, draftNotice:null, storageAvailable:true};
const $ = (id) => document.getElementById(id);
let entryLoadSequence = 0;
const saveAttempts = new Map();
const savingControls = new Map();
const draftStorageKey = "ict-entry-desk-draft-v1";
function draftSnapshot(){
  return {checklistVersion:CHECKLIST_VERSION,model:state.model,direction:state.direction,variant:state.variant,
    answers:{...state.answers},dateValue:state.dateValue,clockValue:state.clockValue,
    screen:state.screen,returnScreen:state.returnScreen,questionIndex:state.questionIndex};
}
function persistDraft(){
  try{
    if(!state.model && !saveAttempts.size && !state.undoDraft) sessionStorage.removeItem(draftStorageKey);
    else sessionStorage.setItem(draftStorageKey,JSON.stringify({...draftSnapshot(),draftVersion:2,
      saveAttempts:[...saveAttempts],undoDraft:state.undoDraft}));
    state.storageAvailable=true;updateDraftStatus();return true;
  }catch{state.storageAvailable=false;updateDraftStatus();return false;}
}
function applyDraft(draft){
  if(!draft || !models.some(model=>model.id===draft.model) ||
     !["long","short"].includes(draft.direction) || !["fvg","wick"].includes(draft.variant)) return false;
  state.model=draft.model;state.direction=draft.direction;state.variant=draft.variant;
  const current=draft.checklistVersion===CHECKLIST_VERSION;
  const allowed=new Set(requiredChecks().map(entry=>entry.id));
  state.answers={};
  if(current && draft.answers && typeof draft.answers==="object" && !Array.isArray(draft.answers)){
    for(const [id,answer] of Object.entries(draft.answers))
      if(allowed.has(id) && ["yes","no","unknown"].includes(answer)) state.answers[id]=answer;
  }
  state.dateValue=typeof draft.dateValue==="string" && /^\d{4}-\d{2}-\d{2}$/.test(draft.dateValue) ? draft.dateValue : "";
  state.clockValue=typeof draft.clockValue==="string" && /^\d{2}:\d{2}$/.test(draft.clockValue) ? draft.clockValue : "";
  state.timeValue=state.dateValue && state.clockValue ? `${state.dateValue}T${state.clockValue}` : "";
  state.questionIndex=current && Number.isInteger(draft.questionIndex) ? Math.max(0,Math.min(draft.questionIndex,requiredChecks().length-1)) : 0;
  state.screen=current && ["home","setup","check","review","history"].includes(draft.screen) ? draft.screen : "setup";
  state.returnScreen=current && ["home","setup","check","review"].includes(draft.returnScreen) ? draft.returnScreen : "setup";
  if(!current) state.draftNotice="The checklist changed. Your entry details are restored; review each check again.";
  return true;
}
function validPending(pair){
  if(!Array.isArray(pair) || pair.length!==2 || typeof pair[0]!=="string" || pair[0].length>1024 ||
     typeof pair[1]!=="string" || !/^[A-Za-z0-9_-]{16,128}$/.test(pair[1])) return false;
  try{
    const p=JSON.parse(pair[0]),keys=Object.keys(p).sort().join(',');
    return (keys==='checklist_id,checklist_met,entry_time_utc' || keys==='checklist_id,checklist_met,checklist_version,entry_time_utc') &&
      ['ote','turtle','drill_fvg','drill_wick','silver','ifvg'].includes(p.checklist_id) &&
      typeof p.entry_time_utc==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(p.entry_time_utc) &&
      !Number.isNaN(Date.parse(p.entry_time_utc)) && typeof p.checklist_met==='boolean' &&
      (p.checklist_version===undefined || (typeof p.checklist_version==='string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(p.checklist_version)));
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
    if(draft.undoDraft && draft.undoDraft.checklistVersion===CHECKLIST_VERSION && models.some(m=>m.id===draft.undoDraft.model)) state.undoDraft=draft.undoDraft;
    if(Array.isArray(draft.saveAttempts)) for(const pair of draft.saveAttempts) if(validPending(pair)) saveAttempts.set(pair[0],pair[1]);
    if(saveAttempts.size){state.screen='recovery';state.saveMessage=null;}
  }catch{state.storageAvailable=false;}
}
function syncSavingControls(){
  if(state.saving){
    document.querySelectorAll("button,input").forEach(control => {
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
  state.model=null;state.answers={};state.timeValue="";state.dateValue="";state.clockValue="";state.questionIndex=0;state.saveMessage=null;state.draftNotice=null;
  persistDraft();
}
function replaceDraft(model=null){
  if(state.saving) return;
  if(saveAttempts.size){show('recovery');return;}
  if(state.model) state.undoDraft=draftSnapshot();
  clearDraft();state.savedEntry=null;
  if(model){state.model=model;state.direction='long';state.variant='fvg';setNow();}
  show('home');
}
function undoReplacement(){
  if(state.saving || saveAttempts.size || !state.undoDraft) return;
  const draft=state.undoDraft;state.undoDraft=null;applyDraft(draft);show(state.screen);
}
function openHistory(){
  if(state.saving) return;
  if(state.screen!=='history') state.returnScreen=state.screen;
  show('history');
}
function resumeReview(){
  if(saveAttempts.size){show('recovery');return;}
  if(!state.model) return;
  const destination=state.returnScreen==='history'?'setup':state.returnScreen;
  show(['setup','check','review'].includes(destination)?destination:'setup');
}
async function fetchEntriesJSON(options){
  return window.entryBrowserLog(options);
}

function modelInfo(){ return models.find(model => model.id === state.model); }
function directional(longText, shortText){ return state.direction === "long" ? longText : shortText; }
function item(id,title,description,kind="source",optional=false,auto=null){ return {id,title,description,kind,optional,auto}; }
function checklistId(){ return state.model === "drill" ? `drill_${state.variant}` : state.model; }

function parsedEntryTime(){
  if(!state.timeValue) return {valid:false,reason:"Select an entry time."};
  const date = new Date(state.timeValue);
  if(Number.isNaN(date.getTime())) return {valid:false,reason:"Enter a valid entry time."};
  const pad = value => String(value).padStart(2,"0");
  const roundTrip = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if(roundTrip !== state.timeValue.slice(0,16)) return {valid:false,reason:"This local time is invalid at a daylight saving change. Choose another time."};
  return {valid:true,date,iso:date.toISOString()};
}

function checklist(){
  if(state.model === "ifvg") return {
    intro:"This review covers Scenario B with conservative confirmation at consequent encroachment (CE): no gap penetration before failure, followed by an opposite-role return and body close at CE. Scenario A and aggressive touch entries are outside this checklist.",
    groups:[
      {title:"Gap and failure",items:[
        item("ifvg-gap",directional("A completed bearish FVG was identified first.","A completed bullish FVG was identified first."),"Mark the original three-candle gap before calling it inverted."),
        item("ifvg-fail",directional("The bearish FVG failed and price delivered above it.","The bullish FVG failed and price delivered below it."),"The original gap must fail in its first role before an opposite-role return is assessed."),
        item("ifvg-scenario","Scenario B applies: the gap had no penetration before failure.","Check the candles before the failure, excluding the failure itself and the later return. If there was earlier penetration, answer No for this Scenario B review.","interpretation")
      ]},
      {title:"Return and confirmation",items:[
        item("ifvg-return","Price later returned to the failed gap.","A later return into the old gap is needed; the first breach itself is not the entry retest."),
        item("ifvg-proof","A completed returning candle provides body-close confirmation at CE.","This review uses the CE-close example from the compiled reference. The chart shows an exact CE close for clarity; no universal numeric tolerance is claimed. A wick-only touch does not establish the required body close."),
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
  "ifvg-gap":"Original FVG complete?","ifvg-fail":"Original FVG failed?","ifvg-scenario":"Scenario B: no prior penetration?","ifvg-return":"Later return into old gap?","ifvg-proof":"Completed body close at CE?","ifvg-entry":"Entry reference identified?"
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
  persistDraft();
  const status=state.storageAvailable ? 'Draft saved in this tab' : 'Draft recovery unavailable — browser storage is blocked or full';
  const notice=state.draftNotice ? `<p class="notice" role="status">${state.draftNotice}</p>` : '';
  const undo=state.undoDraft && !saveAttempts.size ? '<button class="text-button" type="button" data-action="undo-draft">Undo last review replacement</button>' : '';
  screen.innerHTML = `${top}${notice}${body}${state.model || saveAttempts.size ? `<p id="draft-status" class="draft-status ${state.storageAvailable?'':'error'}" role="status">${status}</p>` : ''}${undo}`;
}
function closeMenu(){
  $("header-menu").hidden=true;
  $("menu-button").setAttribute("aria-expanded","false");
}
function setNow(){
  const now=new Date();const pad=value=>String(value).padStart(2,"0");
  state.dateValue=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  state.clockValue=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
  state.timeValue=`${state.dateValue}T${state.clockValue}`;
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
    `<div class="card-list">${cards}</div>${chartIllustration("home")}<div class="action-stack"><button class="primary-button" type="button" data-action="choose-continue" ${state.model ? "" : "disabled"}>Continue <span aria-hidden="true">→</span></button></div>`);
}
function setupGuard(){ return checklist().guard || ""; }
function renderSetup(){
  const model = modelInfo();
  const variant = state.model === "drill" ? `<div class="form-section"><span class="field-label">Drill example</span><div class="choice-grid"><button type="button" class="choice-button" data-variant="fvg" aria-pressed="${state.variant === "fvg"}">FVG retest</button><button type="button" class="choice-button" data-variant="wick" aria-pressed="${state.variant === "wick"}">Wick midpoint</button></div></div>` : "";
  layout(`${backRow("Choose Model","home",1)}<h1 tabindex="-1">Set Up</h1><p class="setup-model">${model.title}</p><details class="source-details"><summary>Framework notes</summary><p>${checklist().intro}</p></details>`,
    `<div class="form-section"><span class="field-label">Direction</span><div class="choice-grid"><button type="button" class="choice-button" data-direction="long" aria-pressed="${state.direction === "long"}">↗ &nbsp;Long</button><button type="button" class="choice-button" data-direction="short" aria-pressed="${state.direction === "short"}">↘ &nbsp;Short</button></div></div>${variant}${chartIllustration("setup")}<div class="form-section"><div class="field-heading"><span class="field-label">Entry date & time</span><button class="text-button" type="button" data-action="now">Use now</button></div><label class="time-field"><span aria-hidden="true">▦</span><span class="sr-only">Entry date</span><input id="entry-date" type="date" aria-label="Entry date"></label><label class="time-field"><span aria-hidden="true">◷</span><span class="sr-only">Entry time</span><input id="entry-clock" type="time" aria-label="Entry time"></label><p id="time-helper" class="helper" role="status"></p></div>${setupGuard() ? `<p class="notice">${setupGuard()}</p>` : ""}<div class="action-stack"><button id="start-button" class="primary-button" type="button" data-action="start">Start Checks <span aria-hidden="true">→</span></button></div>`);
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
  }else{helper.textContent="Saved in UTC; displayed in your local time.";helper.className="helper";}
  $("start-button").disabled = !parsed.valid || Boolean(setupGuard());
}
function renderQuestion(){
  const checks = requiredChecks();
  state.questionIndex = Math.max(0,Math.min(state.questionIndex,checks.length-1));
  const entry = checks[state.questionIndex];
  const number = state.questionIndex+1;
  const status = answerFor(entry);
  const checkKind = entry.kind === "interpretation" ? "Planning check" : entry.kind === "component" ? "Source component check" : "Source check";
  const auto = entry.auto === "window";
  const choices = auto
    ? `<div class="notice">${checkSilverWindow().message}</div><div class="action-stack"><button class="primary-button" type="button" data-action="next">Continue <span aria-hidden="true">→</span></button></div>`
    : `<div class="answer-stack"><button class="answer-choice" type="button" data-choice="yes" aria-label="Yes, confirmed" aria-pressed="${status === "yes"}">✓ Yes</button><div class="answer-pair"><button class="answer-choice" type="button" data-choice="no" aria-label="No" aria-pressed="${status === "no"}">× No</button><button class="answer-choice" type="button" data-choice="unknown" aria-label="Not sure yet" aria-pressed="${status === "unknown"}">? Not sure</button></div></div>`;
  const reviewShortcut = reviewResult().resolved && number < checks.length ? `<div class="action-stack"><button class="secondary-button" type="button" data-action="review">Review result →</button></div>` : "";
  layout(`${backRow("Setup","previous",Math.max(1,Math.ceil(number/checks.length*5)),`${number} / ${checks.length}`)}<h1 class="sr-only" tabindex="-1">Check ${number} of ${checks.length}</h1>`,
    `<article class="question-card"><p class="helper">${checkKind}</p><div class="question-main"><span class="question-mark" aria-hidden="true">⊙</span><h2>${promptFor(entry)}</h2></div><p class="example-heading">Teaching example</p>${chartIllustration("check",entry)}<details class="question-note"><summary aria-label="What to check">⌄</summary><p>${entry.title} ${entry.description}</p></details></article><p class="answer-heading">Your chart — is this condition met?</p>${choices}${reviewShortcut}${auto ? `<p class="question-footer">Checked from your entry time.</p>` : ""}`);
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
  layout('<h1 tabindex="-1">Confirm saved review</h1>',
    `<p class="review-detail">This review may already be in your log. Retry to confirm it before starting another review.</p><div class="saved-card"><strong>${labels[entry.checklist_id]}</strong><span>${formatLocal(entry.entry_time_utc)}</span><span>Checklist ${entry.checklist_met?'Met':'Not Met'}</span><small>${versionLabel(entry.checklist_version)}</small></div>${nyTimeNote(entry.checklist_id,entry.entry_time_utc)}<p class="helper">${saveAttempts.size>1?`${saveAttempts.size} earlier save attempts need confirmation.`:'The original result and request are kept for this confirmation.'}</p><div class="action-stack"><button class="primary-button" type="button" data-action="save" ${state.saving?'disabled':''}>${state.saving?'Confirming…':'Retry Save Entry'}</button><button class="text-button" type="button" data-action="history" ${state.saving?'disabled':''}>View history</button></div><p id="save-feedback" class="feedback" role="status"></p>`);
  if(state.saveMessage){const feedback=$("save-feedback");feedback.textContent=state.saveMessage.text;feedback.className=`feedback ${state.saveMessage.kind}`;}
}
function renderReview(){
  const result = reviewResult();
  const checks = requiredChecks();
  const unresolved = checks.filter(entry => !["yes","no"].includes(answerFor(entry))).length;
  const resultClass = !result.resolved ? "review" : result.met ? "" : "not-met";
  const icon = !result.resolved ? "?" : result.met ? "✓" : "×";
  const resultTitle = !result.resolved ? "Needs review" : result.met ? "Checklist met" : "Checklist not met";
  const resultText = !result.resolved ? `${unresolved} check${unresolved === 1 ? "" : "s"} still marked Not sure. Resolve before saving.` : result.met ? "Every required check was confirmed." : "At least one required check is No.";
  const rows = checks.map((entry,index) => `<button class="check-row" type="button" data-edit="${index}" data-status="${answerFor(entry)}" aria-label="Edit check ${index+1}: ${promptFor(entry)}"><span class="check-num">${index+1}</span><span class="check-label">${promptFor(entry)}</span><span class="check-status" aria-hidden="true">${answerFor(entry) === "yes" ? "✓" : answerFor(entry) === "no" ? "×" : "?"}</span></button>`).join("");
  const sources = modelInfo().sources.map(source => `<a href="${source.href}" target="_blank" rel="noopener noreferrer">${source.label} ↗</a>`).join("");
  const time = parsedEntryTime();
  const saveBlocked = !result.resolved || !time.valid || state.apiStatus !== "ready" || state.saving;
  layout(`${backRow("Checks","previous",4)}<h1 tabindex="-1">Review</h1>`,
    `<div class="review-card ${resultClass}"><div class="review-result"><span class="review-icon" aria-hidden="true">${icon}</span><h2>${resultTitle}</h2></div><div class="review-summary"><div><span aria-hidden="true">▱</span><strong>${labels[checklistId()]}</strong></div><div><span aria-hidden="true">◷</span><strong>${time.valid ? formatLocal(time.iso) : "Missing"}</strong></div></div></div><p class="review-detail">${resultText}</p>${time.valid?nyTimeNote(checklistId(),time.iso):""}<p class="helper">${versionLabel(CHECKLIST_VERSION)}</p>${chartIllustration("review")}<div class="check-list" aria-label="Checks; tap a row to edit">${rows}</div><div class="action-stack"><button id="save-button" class="primary-button" type="button" data-action="save" ${saveBlocked ? "disabled" : ""}>${state.saving ? "Saving…" : "Save Entry"}</button><button class="text-button" type="button" data-action="edit-setup">Edit time or direction</button></div><p id="save-feedback" class="feedback" role="status"></p><details class="source-details"><summary>Source notes</summary><div class="source-links">${sources}</div></details>`);
  const feedback = $("save-feedback");
  if(state.saveMessage){feedback.textContent=state.saveMessage.text;feedback.className=`feedback ${state.saveMessage.kind}`;}
  else if(state.apiStatus === "loading") feedback.textContent="Opening this browser’s test log…";
  else if(state.apiStatus !== "ready") feedback.textContent="Browser log unavailable. Allow website storage and reload.";
  else if(!result.resolved) feedback.textContent="Tap a Not sure check above to resolve it.";
  else feedback.textContent="Only the checklist, entry time, and result are stored. No trade details.";
}
function renderSaved(){
  const entry = state.savedEntry;
  layout(`<div class="saved-hero"><span class="saved-mark ${entry.checklist_met ? "" : "not-met"}" aria-hidden="true">${entry.checklist_met ? "✓" : "×"}</span><h1 tabindex="-1">Saved</h1></div>`,
    `${entry.checklist_version===CHECKLIST_VERSION?chartIllustration("saved",null,entry):""}${nyTimeNote(entry.checklist_id,entry.entry_time_utc)}<p class="helper">${versionLabel(entry.checklist_version)}</p><div class="saved-card"><div><span aria-hidden="true">▱</span><strong>${labels[entry.checklist_id]}</strong></div><div><span aria-hidden="true">◷</span><strong>${formatLocal(entry.entry_time_utc)}</strong></div><div class="${entry.checklist_met ? "good" : "bad"}"><span aria-hidden="true">${entry.checklist_met ? "✓" : "×"}</span><strong>Checklist ${entry.checklist_met ? "Met" : "Not Met"}</strong></div></div><div class="action-stack"><button class="primary-button" type="button" data-action="new">Log Another Entry</button><button class="text-button" type="button" data-action="history">View history</button></div>`);
}
function renderHistory(){
  layout(`<h1 tabindex="-1">History</h1>`,
    `${state.model || saveAttempts.size ? `<button class="secondary-button" type="button" data-action="resume">${saveAttempts.size?"Confirm pending save":"Resume review"}</button>` : ""}<div id="history-chart">${state.apiStatus==="ready" ? historyChart() : ""}</div><div id="history-content"></div><div class="history-actions"><button class="text-button" type="button" data-action="refresh">Refresh</button></div>`);
  const content = $("history-content");
  if(state.apiStatus === "loading"){content.className="empty-state";content.textContent="Loading entries…";return;}
  if(state.apiStatus !== "ready"){content.className="empty-state";content.textContent="The browser test log is unavailable. Allow website storage and reload.";return;}
  if(!state.entries.length){content.className="empty-state";content.textContent="No entries yet.";return;}
  content.className="history-list";
  for(const entry of state.entries){
    const card = document.createElement("article");card.className="history-card";
    const glyph = document.createElement("span");glyph.className="history-glyph";glyph.setAttribute("aria-hidden","true");glyph.textContent=glyphs[entry.checklist_id.startsWith("drill") ? "drill" : entry.checklist_id] || "▱";
    const info = document.createElement("div");
    const name = document.createElement("strong");name.textContent=labels[entry.checklist_id] || "Unknown checklist";
    const time = document.createElement("time");time.dateTime=entry.entry_time_utc;time.textContent=formatLocal(entry.entry_time_utc);
    info.append(name,time);
    if(entry.checklist_id==='silver'){const ny=document.createElement('small');ny.textContent=`New York: ${formatNewYork(entry.entry_time_utc)}`;info.append(ny);}
    const version=document.createElement('small');version.textContent=versionLabel(entry.checklist_version);info.append(version);
    const result = document.createElement("span");result.className=`history-result ${entry.checklist_met ? "" : "not-met"}`;result.textContent=entry.checklist_met ? "MET" : "NOT MET";
    card.append(glyph,info,result);content.append(card);
  }
}
function render(){
  if(state.screen === "recovery" && saveAttempts.size) renderRecovery();
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
    if(state.apiStatus!=="ready" || !result.resolved || !time.valid) return;
    const body=JSON.stringify({checklist_id:checklistId(),entry_time_utc:time.iso,checklist_met:result.met,checklist_version:CHECKLIST_VERSION});
    saveAttempts.set(body,crypto.randomUUID());
  }
  const [body,requestKey]=saveAttempts.entries().next().value;
  const submitted=JSON.parse(body);
  state.screen='recovery';state.saveMessage=null;
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
       Date.parse(created.entry_time_utc)!==Math.floor(Date.parse(submitted.entry_time_utc)/1000)*1000) throw new Error('Unexpected response');
    state.savedEntry=created;saveAttempts.delete(body);state.saving=false;syncSavingControls();
    if(saveAttempts.size){persistDraft();show('recovery');}
    else{state.undoDraft=null;clearDraft();show('saved');}
    await loadEntries();
  }catch(error){
    state.saving=false;syncSavingControls();
    state.saveMessage={kind:'error',text:[400,409].includes(error.status)?'This browser could not accept the saved review. Its request is retained. Keep this tab open and retry after resolving the storage issue.':'Save could not be confirmed. Retry this saved review; the same request will only be logged once.'};
    renderRecovery();
  }
}

screen.addEventListener("click",event => {
  if(state.saving) return;
  const pendingAction=event.target.closest("[data-action]")?.dataset.action;
  if(saveAttempts.size && !['save','history','refresh','resume'].includes(pendingAction)){show('recovery');return;}
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
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(!action) return;
  if(action==="home") show("home");
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
  else if(action==="history"){openHistory();}
  else if(action==="history-back" || action==="resume") resumeReview();
  else if(action==="undo-draft") undoReplacement();
  else if(action==="refresh"){state.apiStatus="loading";renderHistory();loadEntries();}
  else if(action==="new") replaceDraft();
});
screen.addEventListener("input",event => {
  if(state.saving || saveAttempts.size) return;
  if(event.target.id==="entry-date" || event.target.id==="entry-clock"){
    state.dateValue=$("entry-date").value;state.clockValue=$("entry-clock").value;
    state.timeValue=state.dateValue && state.clockValue ? `${state.dateValue}T${state.clockValue}` : "";
    state.saveMessage=null;updateSetupTime();persistDraft();
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
render();
loadEntries();
