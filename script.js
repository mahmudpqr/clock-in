const K='pt_tracker_v1', DEF={ws:480,we:1020,os:1140,oe:1320,max:90};
const NAME={work:'Working hours',ot:'Overtime'}, SHORT={work:'Work',ot:'Overtime'};
const $=id=>document.getElementById(id), pad=n=>String(n).padStart(2,'0');
let S=load();

function load(){try{const o=JSON.parse(localStorage.getItem(K));if(o&&o.set&&o.logs)return o}catch(e){}return{set:{...DEF},logs:{},open:null}}
function save(){try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}}
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const dayStart=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d).getTime()};
function t12(ts,sec){const d=new Date(ts);let h=d.getHours();const ap=h<12?'AM':'PM';h=h%12||12;return h+':'+pad(d.getMinutes())+(sec?':'+pad(d.getSeconds()):'')+' '+ap}
function m12(m){const h=Math.floor(m/60);return(h%12||12)+':'+pad(m%60)+' '+(h<12?'AM':'PM')}
const hms=ms=>{const t=Math.max(0,Math.floor(ms/1000));return pad(Math.floor(t/3600))+':'+pad(Math.floor(t%3600/60))+':'+pad(t%60)};
const dur=ms=>{const m=Math.max(0,Math.floor(ms/60000));return Math.floor(m/60)+'h '+pad(m%60)+'m'};
const endMin=s=>S.set[s==='work'?'we':'oe'];
const slotEnd=(date,s)=>dayStart(date)+endMin(s)*60000;

function trim(max=S.set.max){const ks=Object.keys(S.logs).sort();for(let i=0;i<ks.length-max;i++)delete S.logs[ks[i]];if(S.open&&!S.logs[S.open.date])S.open=null}
function ensureToday(){const k=key(new Date());if(S.logs[k])return false;S.logs[k]={work:{s:[],b:[]},ot:{s:[],b:[]}};trim();save();return true}
function curSlot(d){const m=d.getHours()*60+d.getMinutes()+d.getSeconds()/60,s=S.set;if(m>=s.ws&&m<s.we)return'work';if(m>=s.os&&m<s.oe)return'ot';return null}
const openSlot=()=>S.open&&S.logs[S.open.date][S.open.slot];
const last=a=>a[a.length-1];
const onBreak=sl=>{const b=sl&&last(sl.b);return !!b&&b.e==null};

function closeOpen(at,auto){
  const sl=openSlot();
  if(sl){const b=last(sl.b);if(b&&b.e==null)b.e=Math.max(at,b.s);const s=last(sl.s);if(s&&s.o==null){s.o=Math.max(at,s.i);s.auto=!!auto}}
  S.open=null;save();
}
function stats(sl,now){
  let b=0,w=0;
  sl.s.forEach(x=>w+=(x.o==null?now:x.o)-x.i);
  sl.b.forEach(x=>b+=(x.e==null?now:x.e)-x.s);
  return{w:w-b,b};
}

/* Session actions */
function clockIn(){
  const n=Date.now(),slot=curSlot(new Date(n));
  if(!slot||S.open)return;
  ensureToday();const k=key(new Date(n));
  if(S.logs[k][slot].s.length)return;
  S.logs[k][slot].s.push({i:n,o:null});S.open={date:k,slot};save();refresh();
}
function toggleBreak(){
  const sl=openSlot();if(!sl)return;const n=Date.now();
  if(onBreak(sl))last(sl.b).e=n;else sl.b.push({s:n,e:null});
  save();refresh();
}
async function clockOut(){
  if(!S.open)return;
  if(await ask('Clock out?','This ends your current session and any break in progress.','Clock out')){closeOpen(Date.now(),false);refresh()}
}

/* Rendering */
function renderStatus(now){
  const d=new Date(now),slot=curSlot(d),o=S.open,today=S.logs[key(d)],m=d.getHours()*60+d.getMinutes(),
    nx=[['work',S.set.ws],['ot',S.set.os]].filter(x=>x[1]>m).sort((a,b)=>a[1]-b[1])[0];
  const next=nx?'Next: '+NAME[nx[0]]+' at '+m12(nx[1])+'.':'No more slots today.';
  let p,det,cls='avail';
  if(o){
    const br=onBreak(openSlot());
    cls=br?'break':o.slot;p=br?'On break':'Clocked in';det=NAME[o.slot]+' until '+m12(endMin(o.slot));
  }else if(!slot){cls='off';p='No active slot';det=next}
  else if(today[slot].s.length){p='Clocked out';det=next}
  else{p=NAME[slot]+' available';det='Clock in to start your session.'}
  $('status').dataset.s=cls;$('stP').textContent=p;$('stD').textContent=det;
  $('bIn').disabled=!(slot&&!o&&!today[slot].s.length);$('bBrk').disabled=!o;$('bOut').disabled=!o;
  $('bBrk').textContent=o&&onBreak(openSlot())?'End break':'Start break';
  const sl=openSlot(),b=sl&&onBreak(sl),r=$('reading');
  r.classList.toggle('idle',!sl);r.classList.toggle('brk',!!b);
  $('rdL').textContent=!sl?'Not clocked in':b?'Break time':'Time clocked in';
  $('rdV').textContent=sl?hms(now-(b?last(sl.b).s:last(sl.s).i)):'00:00:00';
}
function slotHtml(sl,s,now){
  const st=stats(sl,now);
  const rg=sl.s.length?sl.s.map(x=>'<div>'+t12(x.i)+' – '+(x.o==null?'now':t12(x.o))+'</div>').join(''):'<div class="mut">None</div>';
  return '<div class="slot '+s+'"><h4>'+SHORT[s]+'</h4><div class="k">Clocked in</div>'+rg+'<div class="k">Total worked</div><div>'+dur(st.w)+'</div><div class="k">Total break</div><div>'+dur(st.b)+'</div></div>';
}
function card(k,now){
  const L=S.logs[k],lab=new Date(dayStart(k)).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  return '<div class="log" data-k="'+k+'"><div class="lh">'+lab+(k===key(new Date(now))?'<span class="tag">Today</span>':'')+'</div><div class="cols">'+slotHtml(L.work,'work',now)+slotHtml(L.ot,'ot',now)+'</div></div>';
}
function renderHistory(){
  const now=Date.now(),ks=Object.keys(S.logs).sort().reverse();
  $('list').innerHTML=ks.length?ks.map(k=>card(k,now)).join(''):'<div class="empty">No logs yet. Your first log appears here.</div>';
}
function refresh(){renderStatus(Date.now());renderHistory()}

function tick(){
  const now=Date.now(),d=new Date(now);
  let h=d.getHours();const ap=h<12?'AM':'PM';h=h%12||12;
  $('time').innerHTML=h+':'+pad(d.getMinutes())+':'+pad(d.getSeconds())+'<small>'+ap+'</small>';
  $('date').textContent=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const fresh=ensureToday();let changed=fresh;
  if(S.open){const end=slotEnd(S.open.date,S.open.slot);if(now>=end){closeOpen(end,true);changed=true}}
  renderStatus(now);
  if(changed)renderHistory();
  else if(S.open){const el=$('list').querySelector('[data-k="'+key(d)+'"]');if(el)el.outerHTML=card(key(d),now)}
}

/* Dialog */
function ask(t,m,y){
  return new Promise(r=>{
    $('dT').textContent=t;$('dM').textContent=m;$('dY').textContent=y;
    const dlg=$('dlg');dlg.returnValue='';
    dlg.onclose=()=>r(dlg.returnValue==='yes');dlg.showModal();
  });
}

/* 12-hour time pickers */
function mkPicker(id){
  const el=$(id);
  el.innerHTML='<select aria-label="Hour">'+Array.from({length:12},(_,i)=>'<option>'+(i+1)+'</option>').join('')+'</select>'+
    '<select aria-label="Minute">'+Array.from({length:60},(_,i)=>'<option>'+pad(i)+'</option>').join('')+'</select>'+
    '<select aria-label="AM or PM"><option>AM</option><option>PM</option></select>';
}
function getMin(id){const[h,m,a]=$(id).querySelectorAll('select');return(+h.value%12+(a.value==='PM'?12:0))*60+ +m.value}
function setMin(id,v){const[h,m,a]=$(id).querySelectorAll('select'),hr=Math.floor(v/60);h.value=hr%12||12;m.value=pad(v%60);a.value=hr<12?'AM':'PM'}
function loadForm(){['ws','we','os','oe'].forEach(i=>setMin(i,S.set[i]));$('max').value=S.set.max}

/* Settings */
function flash(el,txt,ms){el.textContent=txt;el.hidden=false;if(ms)setTimeout(()=>el.hidden=true,ms)}
async function saveSettings(){
  $('err').hidden=true;$('msg').hidden=true;
  const n={ws:getMin('ws'),we:getMin('we'),os:getMin('os'),oe:getMin('oe')},raw=$('max').value,max=Number(raw),errs=[];
  if(n.ws>=n.we)errs.push('Invalid working hours.');
  if(n.os>=n.oe)errs.push('Invalid overtime hours.');
  if(n.ws<n.oe&&n.os<n.we)errs.push('Overlapping hours.');
  if(raw===''||!Number.isInteger(max)||max<1||max>365)errs.push('Invalid history size.');
  if(errs.length){flash($('err'),errs.join(' '));return}
  const count=Object.keys(S.logs).length;
  if(max<count){
    const del=count-max;
    if(!await ask('Delete older logs?','This will permanently delete the '+del+' oldest '+(del===1?'log':'logs')+'.','Delete and save'))return;
  }
  S.set={...n,max};trim();save();refresh();
  flash($('msg'),'Settings saved.',3000);
}
async function clearHistory(){
  if(!await ask('Clear all history?','All logs will be permanently deleted, and any active session will end. This cannot be undone.','Clear history'))return;
  S.logs={};S.open=null;ensureToday();save();refresh();
}

/* Tabs */
function setTab(t){$('app').dataset.tab=t;$('tabS').setAttribute('aria-selected',t==='session');$('tabH').setAttribute('aria-selected',t==='history')}

/* Init */
['ws','we','os','oe'].forEach(mkPicker);
loadForm();ensureToday();
$('bIn').onclick=clockIn;$('bBrk').onclick=toggleBreak;$('bOut').onclick=clockOut;
$('bSave').onclick=saveSettings;$('bClear').onclick=clearHistory;
$('tabS').onclick=()=>setTab('session');$('tabH').onclick=()=>setTab('history');
tick();renderHistory();setInterval(tick,1000);

/* Large screens: Session / Options tabs in the left column */
function setSub(t){$('left').dataset.sub=t;$('subS').setAttribute('aria-selected',t==='session');$('subO').setAttribute('aria-selected',t==='options')}
$('subS').onclick=()=>setSub('session');$('subO').onclick=()=>setSub('options');
