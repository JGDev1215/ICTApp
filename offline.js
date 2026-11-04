"use strict";
const offlineStatus=document.getElementById('offline-status');
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{
    offlineStatus.hidden=false;
    offlineStatus.textContent='Offline reload is unavailable. Connect and reload while online to set it up; your journal can still work while this page remains open.';
  });
}else{
  offlineStatus.hidden=false;
  offlineStatus.textContent='This browser does not support offline reload. Export a backup to protect your journal.';
}
