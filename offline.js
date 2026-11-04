"use strict";
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{
    // The journal still works while this page remains open. Offline reload
    // requires a successful first cache install on this browser and origin.
  });
}
