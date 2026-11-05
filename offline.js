"use strict";
const offlineStatus=document.getElementById('offline-status');
function showConnectionStatus(){
  if(!navigator.onLine){
    offlineStatus.hidden=false;
    offlineStatus.textContent='Offline — the page may stay open, but your draft is only in this tab and is not saved to cloud. Reconnect before saving.';
  }else if(offlineStatus.dataset.workerError!=='true')offlineStatus.hidden=true;
}
window.addEventListener('online',showConnectionStatus);
window.addEventListener('offline',showConnectionStatus);
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{
    offlineStatus.dataset.workerError='true';
    offlineStatus.hidden=false;
    offlineStatus.textContent='Cached page reload is unavailable. Connect and reload while online. Cloud saves still require a connection.';
  });
}else{
  offlineStatus.dataset.workerError='true';
  offlineStatus.hidden=false;
  offlineStatus.textContent='This browser does not support cached page reload. Cloud saves require a connection; keep a private backup.';
}
showConnectionStatus();
