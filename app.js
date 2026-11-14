const $=id=>document.getElementById(id);const sat=t=>6.112*Math.exp(17.62*t/(243.12+t));let outside=null;
const rooms={salon:{name:'Salón',area:48,volume:120},principal:{name:'Dormitorio principal',area:30,volume:75},pequeno:{name:'Dormitorio pequeño',area:16,volume:40},cocina:{name:'Cocina',area:8,volume:20},bano:{name:'Baño',area:6,volume:15}};
const fields=['temp','rh','mode','target','ach','flow'];let saved={},sessions={};try{saved=JSON.parse(localStorage.getItem('aireRooms')||'{}')||{};sessions=JSON.parse(localStorage.getItem('aireSessions')||'{}')||{}}catch{}const views={};
// Earlier versions could save both wheel minima during initialization.
try {
 if (!localStorage.getItem('aireWheelInitFixed')) {
  for (const room of Object.values(saved)) {
   if (Number(room?.temp) === 5 && Number(room?.rh) === 1) {
    room.temp = '19';
    room.rh = '65';
   }
  }
  localStorage.setItem('aireRooms', JSON.stringify(saved));
  localStorage.setItem('aireWheelInitFixed', '1');
 }
} catch {}
let historyByRoom = {};
try { historyByRoom = JSON.parse(localStorage.getItem('aireHistory') || '{}') || {}; } catch {}
function saveHistory() {
 try { localStorage.setItem('aireHistory', JSON.stringify(historyByRoom)); } catch {}
}
function dewPoint(temp, rh) {
 const gamma = Math.log(sat(temp) * rh / 611.2);
 return 243.12 * gamma / (17.62 - gamma);
}
function localDateTime(timestamp) {
 const date = new Date(timestamp);
 const pad = value => String(value).padStart(2, '0');
 return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function setupHistory(key, v) {
 const entries = historyByRoom[key] ??= [];
 const dateFormat = new Intl.DateTimeFormat('es-ES', {dateStyle:'short', timeStyle:'short'});
 const numberFormat = new Intl.NumberFormat('es-ES', {maximumFractionDigits:1});
 let editing = null;
 function edit(entry) {
  editing = entry;
  v.historyForm.reset();
  v.historyError.textContent = '';
  v.historyStart.value = localDateTime(entry?.start ?? Date.now() - 300000);
  v.historyEnd.value = localDateTime(entry?.end ?? Date.now());
  v.afterTemp.value = entry?.after?.temp ?? '';
  v.afterRh.value = entry?.after?.rh ?? '';
  v.historyForm.hidden = false;
  v.historyStart.focus();
 }
 function render() {
  v.historyList.replaceChildren();
  const active = sessions[key];
  if (active?.startedAt) {
   const item = document.createElement('li');
   const status = active.end !== null && Date.now() >= active.end ? 'Fin sin confirmar' : 'En curso';
   item.textContent = dateFormat.format(active.startedAt) + ' · ' + status;
   v.historyList.append(item);
  }
  for (const entry of [...entries].sort((a,b) => b.start - a.start)) {
   const item = document.createElement('li');
   const span = document.createElement('div');
   const minutes = (entry.end - entry.start) / 60000;
   span.textContent = dateFormat.format(entry.start) + ' → ' + dateFormat.format(entry.end) +
    ' · ' + (minutes < 1 ? '<1' : Math.round(minutes)) + ' min';
   item.append(span);
   const readings = document.createElement('div');
   readings.className = 'muted';
   const formatReading = r => numberFormat.format(r.temp) + ' °C / ' + r.rh + ' %';
   const parts = [];
   if (entry.before) parts.push('Antes: ' + formatReading(entry.before));
   if (entry.after) parts.push('Después: ' + formatReading(entry.after));
   if (entry.before && entry.after) {
    const delta = dewPoint(entry.after.temp, entry.after.rh) - dewPoint(entry.before.temp, entry.before.rh);
    parts.push('Cambio del punto de rocío: ' + (delta >= 0.05 ? '+' : '') + numberFormat.format(Math.round(delta * 10) / 10 || 0) + ' °C');
   }
   readings.textContent = parts.join(' · ');
   if (parts.length) item.append(readings);
   const button = document.createElement('button');
   button.type = 'button';
   button.className = 'secondary';
   button.textContent = 'Editar';
   button.onclick = () => edit(entry);
   item.append(button);
   v.historyList.append(item);
  }
  if (!v.historyList.children.length) {
   const item = document.createElement('li');
   item.textContent = 'Aún no hay registros.';
   v.historyList.append(item);
  }
 }
 v.historyAdd.onclick = () => edit(null);
 v.historyCancel.onclick = () => { v.historyForm.hidden = true; };
 v.historyForm.onsubmit = event => {
  event.preventDefault();
  const start = editing && v.historyStart.value === localDateTime(editing.start)
   ? editing.start : new Date(v.historyStart.value).getTime();
  const end = editing && v.historyEnd.value === localDateTime(editing.end)
   ? editing.end : new Date(v.historyEnd.value).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || (!editing && end === start) || end > Date.now()) {
   v.historyError.textContent = 'El fin debe ser posterior al inicio y no puede estar en el futuro.';
   return;
  }
  if (Boolean(v.afterTemp.value) !== Boolean(v.afterRh.value)) {
   v.historyError.textContent = 'Introduce ambas lecturas posteriores o deja las dos vacías.';
   return;
  }
  const after = v.afterTemp.value ? {temp:Number(v.afterTemp.value), rh:Number(v.afterRh.value)} : null;
  if (editing) Object.assign(editing, {start, end, after});
  else entries.push({start, end, after});
  saveHistory();
  v.historyForm.hidden = true;
  render();
 };
 v.renderHistory = render;
 v.recordVentilation = entry => { entries.push(entry); saveHistory(); };
 render();
}

function persist(){try{localStorage.setItem('aireRooms',JSON.stringify(saved));localStorage.setItem('aireSessions',JSON.stringify(sessions))}catch{}}
function setOutside(t,h,label){outside={t,h,loaded:Date.now()};$('outT').textContent=t.toFixed(1);$('outH').textContent=Math.round(h);$('weatherStatus').textContent=label;for(const v of Object.values(views)){v.result.classList.add('hidden');v.minutes=0}}
async function weather(){outside=null;$('outT').textContent='—';$('outH').textContent='—';$('weatherStatus').textContent='Consultando Open-Meteo…';$('refresh').disabled=true;try{const res=await fetch('https://api.open-meteo.com/v1/forecast?latitude=47.981&longitude=7.849&current=temperature_2m,relative_humidity_2m&timezone=Europe%2FBerlin',{signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error();const data=await res.json(),c=data.current;if(!c||!Number.isFinite(c.temperature_2m)||!Number.isFinite(c.relative_humidity_2m)||c.relative_humidity_2m<1||c.relative_humidity_2m>100)throw Error();const stamp=c.time;const nowBerlin=new Date().toLocaleString('sv-SE',{timeZone:'Europe/Berlin'}).replace(' ','T');if(Math.abs(Date.parse(nowBerlin)-Date.parse(stamp))>2*3600000)throw Error();setOutside(c.temperature_2m,c.relative_humidity_2m,'Actualizado '+stamp.slice(11,16)+' · '+stamp.slice(0,10)+' (Freiburg)')}catch(e){$('weatherStatus').textContent='Sin datos recientes. Actualiza o introduce los datos a mano.'}finally{$('refresh').disabled=false}}
$('refresh').onclick=weather;$('manual').onclick=()=>{const t=Number($('manualT').value),h=Number($('manualH').value);if(!$('manualT').value||!$('manualH').value||t< -30||t>50||h<1||h>100){$('weatherStatus').textContent='Introduce una temperatura entre −30 y 50 °C y humedad entre 1 y 100 %.';return}setOutside(t,h,'Manual · '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}))};

const keys=Object.keys(rooms);let index=0;
function go(i){index=Math.max(0,Math.min(keys.length-1,i));views[keys[index]].slide.scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'})}
$('prev').onclick=()=>go(index-1);$('next').onclick=()=>go(index+1);
for(const [key,room] of Object.entries(rooms)){
 const slide=document.createElement('article');slide.className='room-slide';slide.setAttribute('aria-label',room.name);slide.innerHTML=$('roomTemplate').innerHTML;
 const elements={};for(const el of slide.querySelectorAll('[id]')){const original=el.id;elements[original]=el;el.id=key+'-'+original}for(const label of slide.querySelectorAll('label[for]'))label.htmlFor=key+'-'+label.htmlFor;
 slide.querySelector('[data-room-name]').textContent=room.name;elements.roomInfo.textContent=room.area+' m² × 2,5 m = '+room.volume+' m³';elements.result.classList.add('result');elements.minutes.className='minutes';elements.timer.className='timer';elements.error.className='error';elements.result.removeAttribute('aria-live');
 const session=document.createElement('div');session.className='session hidden';session.innerHTML='<strong>Ventilación en curso</strong><div class="timer" role="timer"></div><p class="muted">Mantén la página abierta para recibir el aviso.</p><button type="button" class="secondary">Terminar</button>';slide.append(session);
 const v={...elements,slide,session,minutes:0};views[key]=v;const data=saved[key]||{};for(const field of fields)v[field].value=data[field]??({temp:'19',rh:'65',mode:'single',target:'50'}[field]||'');
 const updateDew = () => {
   const dew = dewPoint(Number(v.temp.value), Number(v.rh.value));
   v.dew.textContent = 'Punto de rocío · ' + dew.toLocaleString('es-ES', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' °C';
 };
 const initializeWheels = [];
 for(const [field,min,max,unit] of [['temp',5,40,'°C'],['rh',1,100,'%']]){
 const input=v[field];if(input.value==='')input.value=field==='temp'?'19':'65';input.type='hidden';
 const wheel=document.createElement('div');wheel.className='wheel';wheel.tabIndex=0;wheel.setAttribute('role','spinbutton');wheel.setAttribute('aria-label',(field==='temp'?'Temperatura':'Humedad relativa')+' · '+room.name);wheel.setAttribute('aria-valuemin',min);wheel.setAttribute('aria-valuemax',max);
 for(let number=min;number<=max;number++){const option=document.createElement('div');option.className='wheel-option';option.textContent=number+' '+unit;option.dataset.value=number;option.addEventListener('click',()=>wheel.scrollTo({top:(number-min)*48,behavior:'smooth'}));wheel.append(option)}
 input.after(wheel);let selected=Math.max(min,Math.min(max,Math.round(+input.value)));input.value=selected;wheel.setAttribute('aria-valuenow',selected);
 const update=()=>{const number=Math.max(min,Math.min(max,min+Math.round(wheel.scrollTop/48)));wheel.setAttribute('aria-valuenow',number);for(const option of wheel.children)option.classList.toggle('chosen',+option.dataset.value===number);if(+input.value!==number){input.value=number;input.dispatchEvent(new Event('input',{bubbles:true}))}};
 wheel.addEventListener('scroll',update,{passive:true});wheel.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?min:event.key==='End'?max:Math.max(min,Math.min(max,+input.value+(event.key==='ArrowUp'?-1:1)));wheel.scrollTo({top:(next-min)*48,behavior:'smooth'})}});
 initializeWheels.push(() => {
  wheel.children[selected-min].classList.add('chosen');
  wheel.scrollTop = (selected-min)*48;
 });
 }
 updateDew();
 v.form.addEventListener('input',()=>{updateDew();saved[key]=Object.fromEntries(fields.map(f=>[f,v[f].value]));persist();v.result.classList.add('hidden');v.minutes=0});
 v.form.onsubmit=e=>{e.preventDefault();v.error.textContent='';if(!outside||Date.now()-outside.loaded>1800000){v.error.textContent='Actualiza el tiempo o introduce datos exteriores.';return}const t=+v.temp.value,h=+v.rh.value,target=+v.target.value,ei=sat(t)*h/100,eo=sat(outside.t)*outside.h/100,goal=sat(t)*target/100,equiv=100*eo/sat(t);let big,title,advice;v.minutes=0;
 if(h<=target){big='En objetivo';title='Humedad en objetivo';advice='No necesitas secar más. Ventila si el aire está cargado.'}
 else if(eo>=ei){big='Espera';title='Ahora no seca';advice='Fuera hay igual o más humedad. Espera o usa un deshumidificador.'}
 else if(eo>=goal){big='Ayuda parcial';title='Solo secará un poco';advice='Puedes reducir la humedad, pero no alcanzar el objetivo ahora.'}
 else{let rates={single:[4,10],cross:[10,25],tilt:[.5,2]}[v.mode.value];const known=+v.flow.value>0?+v.flow.value/room.volume:+v.ach.value;if(known>0)rates=[known,known];const factor=60*Math.log((ei-eo)/(goal-eo)),low=factor/rates[1],high=factor/rates[0];big=known?Math.ceil(high)+' min':Math.max(1,Math.ceil(low))+'–'+Math.max(1,Math.ceil(high))+' min';title='Puedes ventilar';v.minutes=Math.max(1,Math.min(10,Math.ceil(low)));advice='Para llegar a '+target+' % a '+t+' °C. Revisa en '+v.minutes+' min con el higrómetro.';if(high>15)advice+=' Si hace frío, cierra y vuelve a medir.';if(v.mode.value==='tilt')advice+=' Mejor abrir del todo un rato corto.'}
 elements.minutes.textContent=big;v.headline.textContent=title;v.advice.textContent=advice;v.comparison.textContent='Fuera, a '+t+' °C: ≈ '+equiv.toFixed(0)+' %. Dentro: '+h+' % · objetivo: '+target+' %.';v.timerArea.classList.toggle('hidden',!v.minutes);v.result.classList.remove('hidden');v.start.disabled=!!sessions[key];v.start.textContent=sessions[key]?'Ventilando':'Ventilar · revisar en '+v.minutes+' min';};
 v.start.onclick = () => {
  startVentilation(v.minutes);
 };
 v.historyTrack.onclick = () => startVentilation(0);
 function startVentilation(minutes) {
  if (sessions[key]) return;
  const startedAt = Date.now();
  sessions[key] = {
   startedAt,
   end: minutes ? startedAt + minutes * 60000 : null,
   notified: false,
   before: {temp:Number(v.temp.value), rh:Number(v.rh.value)}
  };
  persist();
  tick();
  v.renderHistory();
  session.scrollIntoView({block:'nearest', inline:'nearest'});
 }
 session.querySelector('button').onclick = () => {
  const active = sessions[key];
  if (active?.startedAt) v.recordVentilation({
   start: active.startedAt,
   end: Math.max(Date.now(), active.startedAt),
   before: active.before
  });
  delete sessions[key];
  persist();
  tick();
  v.renderHistory();
  if (active?.startedAt) v.history.open = true;
 };
 setupHistory(key, v);
 const nav=document.createElement('button');nav.type='button';nav.textContent=room.name;nav.onclick=()=>go(keys.indexOf(key));v.nav=nav;$('roomNav').append(nav);$('carousel').append(slide);
 for (const initialize of initializeWheels) initialize();
}
function tick(){let active=0;for(const [key,v] of Object.entries(views)){const s=sessions[key];v.session.classList.toggle('hidden',!s);v.start.disabled=!!s;v.historyTrack.disabled=!!s;if(!s)continue;active++;if(s.end===null){v.session.querySelector('strong').textContent='Ventilando · '+rooms[key].name;v.session.querySelector('.timer').textContent='Apertura registrada';continue}const remaining=Math.max(0,Math.ceil((s.end-Date.now())/1000));v.session.querySelector('.timer').textContent=remaining?Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0'):'Revisa el higrómetro';v.session.querySelector('strong').textContent=remaining?'Ventilando · '+rooms[key].name:'Revisión pendiente · '+rooms[key].name;if(!remaining&&!s.notified){s.notified=true;persist();v.renderHistory();if(navigator.vibrate)navigator.vibrate([200,100,200])}}$('activeTimers').textContent=active?active+' habitación'+(active===1?'':'es')+' con ventilación iniciada.':''}
$('carousel').addEventListener('scroll',()=>{index=Math.round($('carousel').scrollLeft/($('carousel').clientWidth+16));for(const [i,key] of keys.entries())views[key].nav.setAttribute('aria-current',String(i===index))},{passive:true});views[keys[0]].nav.setAttribute('aria-current','true');document.addEventListener('visibilitychange',tick);setInterval(tick,1000);tick();weather();
