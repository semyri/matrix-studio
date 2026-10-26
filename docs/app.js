import {SERVICE, WRITE, NOTIFY, command, transmit} from './protocol.mjs';
import {dashboardFrame, timeParts, weatherType, WEATHER_NAMES, displayTemperature} from './dashboard.mjs';
const $ = id => document.getElementById(id);
const BLACK = '#000000', COLORS = ['#39edac','#d8f28b','#ffb76b','#ff657d','#a58bff','#6ac7ff','#ffffff'];
const blank = () => Array(256).fill(BLACK);
const state = {frames:[], selected:0, color:COLORS[0], erase:false, mode:'draw', title:'A bright beginning', gamma:.6, busy:false, connecting:false, device:null, characteristic:null, notify:null, playing:null, live:null, liveStarting:false, liveToken:0, lastClock:'', shelf:[], weather:null, weatherQuery:null, weatherAttemptAt:0, weatherRequest:0};
let toastTimer, drawing = false, drawColor = BLACK;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4500); }
function log(message) { const li=document.createElement('li'), time=document.createElement('time'); time.textContent=new Date().toLocaleTimeString(); li.append(time,document.createTextNode(message)); $('activityLog').prepend(li); while($('activityLog').children.length>60) $('activityLog').lastChild.remove(); $('activityCount').textContent=$('activityLog').children.length+' events'; }
function report(error) { const message=error?.message||String(error); $('transferStatus').textContent=message; log(message); toast(message); }
function connected() { return !!(state.device?.gatt?.connected && state.characteristic); }
function updateConnection() {
  const isConnected=connected();
  $('deviceName').textContent=isConnected?(state.device.name||'MI Matrix Display'):'Ready when you are';
  $('deviceStatus').textContent=isConnected?'Connected · ready to receive':state.connecting?'Waiting for Bluetooth…':'Connect your MI Matrix display';
  $('connectionTop').classList.toggle('connected',isConnected); $('connectionTop').querySelector('span').textContent=isConnected?'Display connected':'Not connected'; $('statusOrb').classList.toggle('connected',isConnected);
  $('connect').disabled=isConnected||state.connecting||state.busy; $('connect').innerHTML=isConnected?'Connected <span>✓</span>':state.connecting?'Connecting…':'Connect display <span>↗</span>';
  for(const id of ['send','powerOn','powerOff']) $(id).disabled=!isConnected||state.busy;
  $('disconnect').disabled=!isConnected||state.busy; $('liveClock').disabled=state.busy;
  if(!isConnected&&!state.busy) $('transferStatus').textContent='Connect a display to send your creation.';
}
function drawMini(canvas,frame) { const ctx=canvas.getContext('2d'); frame.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i%16,Math.floor(i/16),1,1);}); }
const pixelElements=[];
for(let i=0;i<256;i++) {
  const pixel=document.createElement('button'); pixel.className='pixel'; pixel.type='button'; pixel.setAttribute('role','gridcell'); pixel.dataset.index=i; pixel.setAttribute('aria-label',`Row ${Math.floor(i/16)+1}, column ${i%16+1}`);
  pixel.tabIndex=i===0?0:-1;
  pixel.addEventListener('keydown',event=>{let next=i;const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-16,ArrowDown:16}[event.key];if(step!==undefined){event.preventDefault();next=Math.max(0,Math.min(255,i+step));pixelElements[next].tabIndex=0;pixel.tabIndex=-1;pixelElements[next].focus();}else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(state.mode==='draw'){stopPlayback();stopLive();paint(i,state.erase?BLACK:state.color);saveDraft();}}});
  $('pixelGrid').append(pixel); pixelElements.push(pixel);
}
function paint(i,color) { state.frames[state.selected][i]=color; const pixel=pixelElements[i]; pixel.style.setProperty('--pixel',color);pixel.classList.toggle('lit',color!==BLACK);pixel.setAttribute('aria-label',`Row ${Math.floor(i/16)+1}, column ${i%16+1}: ${color}`); }
function drawPixels() { state.frames[state.selected].forEach((color,i)=>{const pixel=pixelElements[i];pixel.style.setProperty('--pixel',color);pixel.classList.toggle('lit',color!==BLACK);pixel.setAttribute('aria-label',`Row ${Math.floor(i/16)+1}, column ${i%16+1}: ${color}`);}); $('previewLabel').textContent=`PREVIEW · FRAME ${state.selected+1} OF ${state.frames.length}`; }
function renderFrames() {
  $('frameStrip').replaceChildren(); state.frames.forEach((frame,i)=>{const button=document.createElement('button');button.className='frame-thumb'+(i===state.selected?' selected':'');button.setAttribute('aria-label','Select frame '+(i+1));button.setAttribute('aria-pressed',String(i===state.selected));const canvas=document.createElement('canvas');canvas.width=canvas.height=16;drawMini(canvas,frame);const span=document.createElement('span');span.textContent=String(i+1).padStart(2,'0');button.append(canvas,span);button.onclick=()=>{stopPlayback();state.selected=i;render();};$('frameStrip').append(button);});
  $('frameCount').textContent=String(state.frames.length).padStart(2,'0')+' / 08';$('addFrame').disabled=state.frames.length>=8;$('deleteFrame').disabled=state.frames.length===1;
}
function render() { drawPixels();renderFrames();$('sceneTitle').textContent=state.title;saveDraft(); }
function saveDraft() { try {localStorage.setItem('matrix-studio-draft-v1',JSON.stringify({frames:state.frames,title:state.title,gamma:state.gamma}));}catch{} }
function setScene(frames,title) { stopLive();stopPlayback();state.frames=frames;state.selected=0;state.title=title;render(); }
$('pixelGrid').addEventListener('pointerdown',event=>{if(state.mode!=='draw'||event.button!==0)return;const pixel=event.target.closest('[data-index]');if(!pixel)return;event.preventDefault();stopPlayback();stopLive();drawing=true;drawColor=state.erase?BLACK:state.color;paint(Number(pixel.dataset.index),drawColor);});
document.addEventListener('pointermove',event=>{if(!drawing)return;const pixel=document.elementFromPoint(event.clientX,event.clientY)?.closest('#pixelGrid [data-index]');if(pixel)paint(Number(pixel.dataset.index),drawColor);});
function finishDraw(){if(drawing){drawing=false;renderFrames();saveDraft();}}document.addEventListener('pointerup',finishDraw);document.addEventListener('pointercancel',finishDraw);window.addEventListener('blur',finishDraw);
COLORS.forEach(color=>{const b=document.createElement('button');b.className='swatch'+(color===state.color?' selected':'');b.style.setProperty('--swatch',color);b.setAttribute('aria-label','Paint '+color);b.onclick=()=>{state.color=color;state.erase=false;updateTools();};$('palette').append(b);});
function updateTools(){document.querySelectorAll('.swatch').forEach((b,i)=>b.classList.toggle('selected',COLORS[i]===state.color&&!state.erase));$('eraser').setAttribute('aria-pressed',String(state.erase));}
$('customColor').oninput=event=>{state.color=event.target.value;state.erase=false;updateTools();};$('eraser').onclick=()=>{state.erase=!state.erase;updateTools();};
$('clearFrame').onclick=()=>{stopLive();stopPlayback();state.frames[state.selected]=blank();render();};
function setMode(mode){state.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-selected',String(b.dataset.mode===mode));});for(const name of ['draw','text','image','clock'])$(name+'Panel').hidden=name!==mode;}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('gridToggle').onclick=()=>{const hidden=$('pixelGrid').classList.toggle('no-grid');$('gridToggle').setAttribute('aria-pressed',String(!hidden));};
$('addFrame').onclick=()=>{if(state.frames.length>=8)return;stopLive();stopPlayback();state.frames.push([...state.frames[state.selected]]);state.selected=state.frames.length-1;render();};
$('deleteFrame').onclick=()=>{if(state.frames.length<2)return;stopLive();stopPlayback();state.frames.splice(state.selected,1);state.selected=Math.min(state.selected,state.frames.length-1);render();};
function stopPlayback(){if(state.playing){clearInterval(state.playing);state.playing=null;}$('playFrames').textContent='▷ Play';$('playFrames').setAttribute('aria-pressed','false');}
$('playFrames').onclick=()=>{if(state.playing){stopPlayback();return;}if(state.frames.length<2){toast('Add another frame to preview an animation.');return;}$('playFrames').textContent='Ⅱ Pause';$('playFrames').setAttribute('aria-pressed','true');state.playing=setInterval(()=>{state.selected=(state.selected+1)%state.frames.length;drawPixels();document.querySelectorAll('.frame-thumb').forEach((b,i)=>{b.classList.toggle('selected',i===state.selected);b.setAttribute('aria-pressed',String(i===state.selected));});},300);};
function makePreset(name){
  const frame=blank(), set=(x,y,color)=>{if(x>=0&&x<16&&y>=0&&y<16)frame[y*16+x]=color;};
  if(name==='check'){for(let t=0;t<3;t++){for(let n=0;n<4;n++)set(3+n,7+n+t,COLORS[0]);for(let n=0;n<7;n++)set(6+n,10-n+t,COLORS[0]);}}
  if(name==='heart'){const rows=['01100110','11111111','11111111','01111110','00111100','00011000'];rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1'){set(x+4,y+5,'#ff657d');}}));}
  if(name==='sun'){for(let y=0;y<16;y++)for(let x=0;x<16;x++){const d=Math.hypot(x-7.5,y-7.5);if(d<3.7)set(x,y,'#ffb76b');if(d>4.8&&d<6.8&&(Math.abs(x-7.5)<1||Math.abs(y-7.5)<1||Math.abs(Math.abs(x-7.5)-Math.abs(y-7.5))<.5))set(x,y,'#d8f28b');}set(6,7,BLACK);set(9,7,BLACK);set(7,9,BLACK);set(8,9,BLACK);}
  if(name==='wave'){return Array.from({length:8},(_,t)=>{const f=blank();for(let x=0;x<16;x++){const y=Math.round(7.5+4*Math.sin(x*.42+t*Math.PI/4));for(let k=-1;k<=1;k++)f[(y+k)*16+x]=COLORS[Math.floor(x/3)%COLORS.length];}return f;});}
  return [frame];
}
const presetTitles={check:'All systems go',heart:'Pixel love',sun:'Good energy',wave:'Color wave'};
document.querySelectorAll('[data-preset]').forEach(b=>{drawMini(b.querySelector('canvas'),makePreset(b.dataset.preset)[0]);b.onclick=()=>{setScene(makePreset(b.dataset.preset),presetTitles[b.dataset.preset]);setMode('draw');};});
const FONT={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'101111111111101',O:'010101101101010',P:'110101110100100',Q:'010101101111011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110','4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001110','!':'010010010000010','?':'110001010000010','-':'000000111000000',':':'000010000010000','.':'000000000000010',' ':'000000000000000'};
function textOn(frame,text,x,y,color){[...text.toUpperCase()].forEach((char,c)=>{const glyph=FONT[char]||FONT['?'];[...glyph].forEach((on,i)=>{const px=x+c*4+i%3,py=y+Math.floor(i/3);if(on==='1'&&px>=0&&px<16&&py>=0&&py<16)frame[py*16+px]=color;});});}
$('makeText').onclick=()=>{const text=$('textInput').value.trim().toUpperCase();if(!text){toast('Type a message first.');return;}const color=$('textColor').value;let frames;if($('textStyle').value==='still'){const short=text.slice(0,4);if(text.length>4)toast('Still text uses the first four characters.');const f=blank();textOn(f,short,Math.floor((16-(short.length*4-1))/2),5,color);frames=[f];}else{const width=text.length*4-1;frames=Array.from({length:8},(_,i)=>{const f=blank();textOn(f,text,Math.round(13-i*(width+10)/7),5,color);return f;});}setScene(frames,text.length>17?text.slice(0,17)+'…':text);};
function clockOptions(){return {hour12:$('clockFormat').value==='12',layout:$('clockLayout').value,color:$('clockColor').value,weather:usableWeather(),unit:$('weatherUnit').value};}
function usableWeather(){const w=state.weather;return w&&w.query===$('weatherLocation').value.trim()&&Date.now()-w.fetchedAt<45*60*1000?w:null;}
function clockFrame(){return dashboardFrame(clockOptions());}
function saveClockSettings(){try{localStorage.setItem('matrix-studio-clock-v1',JSON.stringify({location:$('weatherLocation').value.trim(),unit:$('weatherUnit').value,layout:$('clockLayout').value,format:$('clockFormat').value,color:$('clockColor').value}));}catch{}}
function clockLegend(){const compact=$('clockLayout').value==='dashboard';$('weatherControls').hidden=!compact;$('clockLegend').textContent=compact?'Top: time · middle: month/day · bottom: weather + temperature. Time/date come from this PC. Keep this page open for live updates.':'Hours above minutes. Time comes from this PC. Keep this page open for live updates.';}
function paintClock(){state.title=$('clockLayout').value==='dashboard'?'Your day, in pixels':'A little time';state.frames=[clockFrame()];state.selected=0;render();const date=new Date(),w=usableWeather();$('clockReadout').textContent=date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:$('clockFormat').value==='12'})+' · '+date.toLocaleDateString([],{month:'short',day:'numeric'})+($('clockLayout').value==='dashboard'?' · '+(w?`${WEATHER_NAMES[weatherType(w.code,w.isDay)]}, ${displayTemperature(w.celsius,$('weatherUnit').value)}°${$('weatherUnit').value}`:'Weather unavailable'):'');}
async function fetchJSON(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('Weather service returned '+response.status+'.');return await response.json();}finally{clearTimeout(timer);}}
async function refreshWeather(){
  const query=$('weatherLocation').value.trim();if(!query){$('weatherStatus').textContent='Enter a city or ZIP to load weather.';return false;}
  const request=++state.weatherRequest;state.weatherAttemptAt=Date.now();$('refreshWeather').disabled=true;$('weatherStatus').textContent='Loading local conditions…';
  try{
    let place=state.weatherQuery?.query===query?state.weatherQuery:null;
    if(!place){const search=new URL('https://geocoding-api.open-meteo.com/v1/search');search.search=new URLSearchParams({name:query,count:'5',language:'en',format:'json',...(/^\d{5}$/.test(query)?{countryCode:'US'}:{})});const data=await fetchJSON(search);const result=data.results?.[0];if(!result||!Number.isFinite(result.latitude)||!Number.isFinite(result.longitude))throw new Error('Location not found. Try a US ZIP or city, state.');place={query,latitude:result.latitude,longitude:result.longitude,name:[result.name,result.admin1].filter(Boolean).join(', ')};}
    const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(place.latitude),longitude:String(place.longitude),current:'temperature_2m,weather_code,is_day',timezone:'auto'});const data=await fetchJSON(url);const current=data.current;
    if(!current||!Number.isFinite(current.temperature_2m)||!Number.isInteger(current.weather_code))throw new Error('Current conditions are unavailable.');
    if(request!==state.weatherRequest||query!==$('weatherLocation').value.trim())return false;
    state.weatherQuery=place;state.weather={query,name:place.name,celsius:current.temperature_2m,code:current.weather_code,isDay:current.is_day,fetchedAt:Date.now()};
    $('weatherStatus').textContent=`${place.name} · ${displayTemperature(current.temperature_2m,$('weatherUnit').value)}°${$('weatherUnit').value} · ${WEATHER_NAMES[weatherType(current.weather_code,current.is_day)]} · fetched ${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
    log('Weather refreshed for '+place.name+'.');state.lastClock='';saveClockSettings();if(state.mode==='clock')paintClock();return true;
  }catch(error){if(request!==state.weatherRequest)return false;const w=usableWeather();$('weatherStatus').textContent=(error.name==='AbortError'?'Weather request timed out.':error.message)+(w?' Showing last known conditions from '+new Date(w.fetchedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'.':' Clock/date will keep working; weather shows --.');state.lastClock='';if(state.mode==='clock')paintClock();return false;}
  finally{if(request===state.weatherRequest)$('refreshWeather').disabled=false;}
}
$('refreshWeather').onclick=refreshWeather;
$('weatherLocation').onchange=()=>{state.weatherRequest++;state.weatherAttemptAt=0;$('refreshWeather').disabled=false;$('weatherStatus').textContent='Location changed. Click Update weather.';saveClockSettings();state.lastClock='';};
for(const id of ['clockLayout','clockFormat','clockColor','weatherUnit'])$(id).onchange=()=>{saveClockSettings();clockLegend();state.lastClock='';if(state.mode==='clock')paintClock();if(id==='weatherUnit'&&usableWeather()){$('weatherStatus').textContent=`${state.weather.name} · ${displayTemperature(state.weather.celsius,$('weatherUnit').value)}°${$('weatherUnit').value} · ${WEATHER_NAMES[weatherType(state.weather.code,state.weather.isDay)]}`;}};
$('makeClock').onclick=async()=>{stopLive();stopPlayback();paintClock();if($('clockLayout').value==='dashboard'&&$('weatherLocation').value.trim()&&!usableWeather())await refreshWeather();};
function stopLive(){state.liveToken++;state.liveStarting=false;if(state.live)clearInterval(state.live);state.live=null;state.lastClock='';$('liveClock').textContent='Start live clock';$('liveClock').setAttribute('aria-pressed','false');}
$('liveClock').onclick=async()=>{
  if(state.live||state.liveStarting){stopLive();toast('Live clock stopped.');return;}if(!connected()){toast('Connect your display to start a live clock.');return;}
  stopPlayback();const token=++state.liveToken;state.liveStarting=true;$('liveClock').textContent='Starting…';
  if($('clockLayout').value==='dashboard'&&$('weatherLocation').value.trim()&&!usableWeather())await refreshWeather();
  if(token!==state.liveToken)return;paintClock();if(!await sendFrames({save:false,quiet:true})){stopLive();return;}if(token!==state.liveToken)return;
  state.liveStarting=false;$('liveClock').textContent='Stop live clock';$('liveClock').setAttribute('aria-pressed','true');toast('Live clock started. Keep this page open.');
  state.live=setInterval(async()=>{
    if(token!==state.liveToken||state.busy)return;
    if($('clockLayout').value==='dashboard'&&$('weatherLocation').value.trim()&&Date.now()-state.weatherAttemptAt>=15*60*1000){await refreshWeather();if(token!==state.liveToken)return;}
    const parts=timeParts(),key=JSON.stringify([parts.year,parts.month,parts.day,parts.hour,parts.minute,clockOptions()]);if(key===state.lastClock||state.busy)return;state.lastClock=key;paintClock();if(!await sendFrames({save:false,quiet:true}))stopLive();
  },5000);
};
function canvasFrame(source){const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle=BLACK;ctx.fillRect(0,0,16,16);ctx.imageSmoothingEnabled=false;const w=source.displayWidth||source.naturalWidth||source.width,h=source.displayHeight||source.naturalHeight||source.height;const scale=Math.min(16/w,16/h,1),dw=Math.max(1,Math.round(w*scale)),dh=Math.max(1,Math.round(h*scale));ctx.drawImage(source,Math.floor((16-dw)/2),Math.floor((16-dh)/2),dw,dh);const data=ctx.getImageData(0,0,16,16).data;return Array.from({length:256},(_,i)=>'#'+[data[i*4],data[i*4+1],data[i*4+2]].map(v=>v.toString(16).padStart(2,'0')).join(''));}
$('imageInput').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw new Error('Choose an image smaller than 10 MB.');let frames=[];if(file.type==='image/gif'&&'ImageDecoder'in window&&await ImageDecoder.isTypeSupported('image/gif')){const decoder=new ImageDecoder({data:await file.arrayBuffer(),type:'image/gif',preferAnimation:true});try{await decoder.tracks.ready;const count=Math.min(8,decoder.tracks.selectedTrack.frameCount);for(let i=0;i<count;i++){const {image}=await decoder.decode({frameIndex:i});try{frames.push(canvasFrame(image));}finally{image.close();}}if(decoder.tracks.selectedTrack.frameCount>8)toast('Imported the first eight GIF frames.');}finally{decoder.close();}}else{const image=await createImageBitmap(file);try{frames=[canvasFrame(image)];}finally{image.close();}if(file.type==='image/gif')toast('This browser imported only the first GIF frame.');}if(!frames.length)throw new Error('No image frames could be decoded.');setScene(frames,file.name.replace(/\.[^.]+$/,''));log(`Imported ${file.name}: ${frames.length} frame(s).`);}catch(error){report(error);}finally{event.target.value='';}};
function validateProject(project){if(!project||!Array.isArray(project.frames)||project.frames.length<1||project.frames.length>8||!project.frames.every(f=>Array.isArray(f)&&f.length===256&&f.every(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c))))throw new Error('This is not a valid 16×16 Matrix Studio project.');return {frames:project.frames.map(f=>f.map(c=>c.toLowerCase())),title:typeof project.title==='string'?project.title.slice(0,60):'Untitled creation'};}
function renderShelf(){const shelf=$('savedScenes');shelf.replaceChildren();if(!state.shelf.length){const div=document.createElement('div');div.className='saved-empty';div.textContent='Good ideas belong on a shelf. Save one here.';shelf.append(div);return;}state.shelf.forEach(project=>{const b=document.createElement('button');b.className='saved-item';const canvas=document.createElement('canvas');canvas.width=canvas.height=16;drawMini(canvas,project.frames[0]);const title=document.createElement('span');title.textContent=project.title;const count=document.createElement('small');count.textContent=project.frames.length+'F';b.append(canvas,title,count);b.onclick=()=>setScene(project.frames.map(f=>[...f]),project.title);shelf.append(b);});}
$('saveScene').onclick=()=>{if(state.shelf.length>=50){toast('Your shelf has 50 creations. Export a project to keep a backup.');return;}try{const project={frames:state.frames.map(f=>[...f]),title:state.title};const next=[project,...state.shelf];localStorage.setItem('matrix-studio-shelf-v1',JSON.stringify(next));state.shelf=next;renderShelf();toast('Saved to your browser’s shelf.');}catch{toast('Browser storage is unavailable or full. Use Export project instead.');}};
$('exportScene').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,title:state.title,frames:state.frames,gamma:state.gamma},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='matrix-studio-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Project exported.');};
$('projectInput').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>200000)throw new Error('Project file is too large.');const project=validateProject(JSON.parse(await file.text()));setScene(project.frames,project.title);toast('Project imported.');}catch(error){report(error);}finally{event.target.value='';}};
async function connect(){
  if(connected()||state.connecting)return;
  if(!window.isSecureContext||!navigator.bluetooth){$('helpDialog').showModal();report(new Error('Open Matrix Studio in a normal desktop Edge or Chrome tab to use Bluetooth.'));return;}
  state.connecting=true;updateConnection();let device;
  try{
    device=await navigator.bluetooth.requestDevice({filters:[{name:'MI Matrix Display'},{namePrefix:'MI Matrix'}],optionalServices:[SERVICE]});
    state.device=device;device.addEventListener('gattserverdisconnected',()=>{if(state.device!==device)return;state.characteristic=null;state.notify=null;stopLive();updateConnection();log('Display disconnected.');});
    const server=await device.gatt.connect(),service=await server.getPrimaryService(SERVICE);state.characteristic=await service.getCharacteristic(WRITE);
    if(!state.characteristic.properties.writeWithoutResponse)throw new Error('This device does not support the expected MI Matrix connection.');
    try{state.notify=await service.getCharacteristic(NOTIFY);await state.notify.startNotifications();}catch{log('Optional device notifications are unavailable. Image sending is ready.');}
    log('Connected directly to '+(device.name||'MI Matrix Display')+'.');$('transferStatus').textContent='Connected. Choose a creation and send it.';toast('Your display is connected.');
  }catch(error){state.characteristic=null;state.notify=null;if(device?.gatt?.connected)device.gatt.disconnect();const message=error.name==='NotFoundError'?'No display selected. Disconnect the old controller, then try again.':error.name==='SecurityError'?'Bluetooth is blocked here. Open this site in a normal Edge or Chrome tab.':`Connection failed: ${error.message}`;report(new Error(message));}
  finally{state.connecting=false;updateConnection();}
}
async function write(bytes){if(!connected())throw new Error('The display disconnected. Reconnect and send again.');await state.characteristic.writeValueWithoutResponse(bytes);}
async function sendFrames({save=$('saveDevice').checked,quiet=false}={}){
  if(state.busy)return false;if(!connected()){toast('Connect your display first.');return false;}
  state.busy=true;updateConnection();$('send').textContent='Sending…';const frames=state.frames.map(f=>[...f]);const title=state.title;
  try{const packets=await transmit(frames,write,{gamma:state.gamma,save,progress:(n,total)=>{$('transferStatus').textContent=`Sending ${Math.round(n/total*100)}% · keep this page open`;}});if(!connected())throw new Error('Connection lost before transfer finished.');$('transferStatus').textContent=`Sent ${frames.length===1?'1 image':frames.length+' animation frames'} · ${save?'saved on display':'temporary display'}.`;log(`Bluetooth writes completed: “${title}”, ${packets} packets. ${save?'Saved on display.':'Temporary; saved content kept.'}`);if(!quiet)toast('Sent to display. Check your pixels!');return true;}catch(error){report(new Error('Send failed: '+error.message));return false;}finally{state.busy=false;$('send').innerHTML='Send to display <span>→</span>';updateConnection();}
}
$('connect').onclick=connect;$('connectionTop').onclick=()=>{if(connected())toast('Your display is connected directly to Matrix Studio.');else $('helpDialog').showModal();};
$('disconnect').onclick=()=>{stopLive();state.device?.gatt?.disconnect();updateConnection();};
$('send').onclick=()=>{stopLive();sendFrames();};
async function power(on){if(state.busy||!connected())return;state.busy=true;updateConnection();if(!on)stopLive();try{await write(command([0xff,on?1:0]));toast(on?'Power-on command sent.':'Power-off command sent.');log(on?'Power-on command sent.':'Power-off command sent.');}catch(error){report(error);}finally{state.busy=false;updateConnection();}}
$('powerOn').onclick=()=>power(true);$('powerOff').onclick=()=>power(false);
$('gamma').oninput=event=>{state.gamma=Number(event.target.value);$('gammaValue').textContent=state.gamma.toFixed(2);saveDraft();};
$('helpButton').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();$('helpDialog').addEventListener('click',event=>{if(event.target===$('helpDialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
$('openStandalone').href=location.href;
let clockPreferences={};try{clockPreferences=JSON.parse(localStorage.getItem('matrix-studio-clock-v1'))||{};}catch{}
const setupParams=new URLSearchParams(location.search);if(setupParams.has('zip'))clockPreferences.location=setupParams.get('zip').slice(0,80);if(setupParams.get('unit')==='F'||setupParams.get('unit')==='C')clockPreferences.unit=setupParams.get('unit');
if(typeof clockPreferences.location==='string')$('weatherLocation').value=clockPreferences.location.slice(0,80);
if(['F','C'].includes(clockPreferences.unit))$('weatherUnit').value=clockPreferences.unit;
if(['dashboard','large'].includes(clockPreferences.layout))$('clockLayout').value=clockPreferences.layout;
if(['12','24'].includes(clockPreferences.format))$('clockFormat').value=clockPreferences.format;
if(/^#[0-9a-f]{6}$/i.test(clockPreferences.color))$('clockColor').value=clockPreferences.color;
saveClockSettings();clockLegend();
state.frames=makePreset('check');
try{const draft=JSON.parse(localStorage.getItem('matrix-studio-draft-v1'));if(draft){const valid=validateProject(draft);state.frames=valid.frames;state.title=valid.title;if(Number.isFinite(draft.gamma)&&draft.gamma>=.2&&draft.gamma<=1)state.gamma=draft.gamma;}}catch{}
try{const shelf=JSON.parse(localStorage.getItem('matrix-studio-shelf-v1'));if(Array.isArray(shelf))state.shelf=shelf.slice(0,50).map(validateProject);}catch{}
$('gamma').value=state.gamma;$('gammaValue').textContent=state.gamma.toFixed(2);render();renderShelf();updateConnection();
if(setupParams.has('zip')){setMode('clock');paintClock();refreshWeather();}
if(!window.isSecureContext||!navigator.bluetooth)$('connectionHelp').textContent='Bluetooth requires a normal desktop Edge or Chrome tab. The editor works here; open this URL in your browser to connect.';
window.addEventListener('pagehide',()=>{stopLive();state.device?.gatt?.disconnect();});
