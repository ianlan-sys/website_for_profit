import {readings,topics} from './readings.js';
import {landscape} from './art.js';
const $=id=>document.getElementById(id);
const config=window.YIQIAN_CONFIG||{mode:'demo',apiBase:''};
const STORAGE_KEY='yiqian.saved.v2';
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
let saved=[],current=null,busy=false,epoch=0,controller=null,animationTimers=[],toastTimer;
const buttons=[...document.querySelectorAll('[data-topic]')];
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
function validReading(r){return r&&typeof r==='object'&&typeof r.id==='string'&&r.id.length<=80&&Object.hasOwn(topics,r.topic)&&['name','title','action','time','seal','number'].every(k=>typeof r[k]==='string'&&r[k].length>0&&r[k].length<=500)&&['poem','body'].every(k=>Array.isArray(r[k])&&r[k].length===2&&r[k].every(t=>typeof t==='string'&&t.length>0&&t.length<=800));}
function cleanEntries(entries){if(!Array.isArray(entries))return [];return entries.filter(x=>x&&validReading(x.reading)&&typeof x.date==='string'&&Number.isFinite(Date.parse(x.date))).map(x=>({reading:x.reading,date:x.date,done:!!x.done,source:['ai','curated','fallback'].includes(x.source)?x.source:'curated'})).filter((x,i,a)=>a.findIndex(y=>y.reading.id===x.reading.id)===i).slice(0,80);}
function readSaved(){try{const v2=localStorage.getItem(STORAGE_KEY);if(v2!==null)return cleanEntries(JSON.parse(v2));const old=JSON.parse(localStorage.getItem('yiqian.saved.v1')||'[]');if(!Array.isArray(old))return [];return cleanEntries(old.map(x=>({reading:readings.find(r=>r.id===x?.id),date:x?.date,done:x?.done,source:'curated'})));}catch{return [];}}
function updateCount(){$('saved-count').textContent=saved.length;$('saved-count').hidden=!saved.length;}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function persist(next){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));saved=next;updateCount();return true;}catch{toast('浏览器暂时无法保存。这张签仍可以继续阅读。');return false;}}
function stopRitual(){animationTimers.forEach(clearTimeout);animationTimers=[];controller?.abort();controller=null;epoch++;busy=false;}
function setStatus(message,error=false){$('ritual-status').textContent=message;$('ritual-status').classList.toggle('error-status',error);}
function revealChoices(){animationTimers.forEach(clearTimeout);animationTimers=[];$('ritual-stage').classList.remove('is-shaking');$('ritual-stage').classList.add('is-ready');$('ritual-stage').setAttribute('aria-busy','false');buttons.forEach(b=>b.disabled=false);$('skip-animation').hidden=true;$('shake-again').hidden=false;$('shake-again').disabled=false;setStatus('四支心意已到，选一根你的今日签。');}
function beginRitual(){stopRitual();$('ritual-stage').classList.remove('is-shaking','is-ready','is-loading');buttons.forEach(b=>{b.disabled=true;b.classList.remove('is-selected');});$('ritual-stage').setAttribute('aria-busy','true');$('skip-animation').hidden=false;$('shake-again').hidden=true;setStatus('签筒轻摇，好好呼吸一下。');if(reduceMotion.matches){revealChoices();return;}animationTimers.push(setTimeout(()=>$('ritual-stage').classList.add('is-shaking'),150),setTimeout(revealChoices,2000));}
function showView(id,focusId){document.querySelectorAll('main>.view').forEach(view=>view.hidden=view.id!==id);window.scrollTo({top:0,behavior:'instant'});if(focusId)$(focusId).focus({preventScroll:true});}
function goHome(){showView('ritual-view','ritual-title');beginRitual();}
function demoReading(topic){const pool=readings.filter(r=>r.topic===topic&&r.id!==current?.reading.id);const n=new Uint32Array(1);crypto.getRandomValues(n);return {source:'curated',reading:pool[Math.floor(n[0]/4294967296*pool.length)],generatedAt:new Date().toISOString()};}
async function loadReading(topic,signal){
  if(config.mode==='demo')return demoReading(topic);
  const endpoint=new URL((config.apiBase||'').replace(/\/$/,'')+'/api/fortune',location.origin);
  if(endpoint.origin!==location.origin)throw Error('签文服务地址配置有误。');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic}),signal});
  let data;try{data=await response.json();}catch{throw Error('签文暂时没有送达，请稍后再试。');}
  if(!response.ok)throw Error(typeof data.error?.message==='string'?data.error.message.slice(0,120):'签文暂时没有送达，请稍后再试。');
  if(!validReading(data.reading)||data.reading.topic!==topic||!['ai','curated','fallback'].includes(data.source))throw Error('这次签文没有完整展开，请再试一次。');
  return data;
}
async function chooseTopic(button){if(busy||button.disabled)return;busy=true;const ticket=++epoch;const requestController=new AbortController();controller=requestController;const signal=requestController.signal;$('ritual-stage').classList.add('is-loading');$('ritual-stage').setAttribute('aria-busy','true');buttons.forEach(b=>{b.disabled=true;b.classList.toggle('is-selected',b===button);});$('shake-again').disabled=true;setStatus('正在为你展开「'+topics[button.dataset.topic]+'」的今日签……');const timeout=setTimeout(()=>requestController.abort(),35000);
  try{const [result]=await Promise.all([loadReading(button.dataset.topic,signal),new Promise(resolve=>setTimeout(resolve,reduceMotion.matches?0:650))]);if(ticket!==epoch)return;current=result;renderResult(result);}
  catch(error){if(ticket!==epoch)return;setStatus(error.name==='AbortError'?'这次等待有点久，请点一根签再试试。':error.message,true);$('ritual-stage').classList.remove('is-loading');buttons.forEach(b=>{b.disabled=false;b.classList.remove('is-selected');});}
  finally{clearTimeout(timeout);if(ticket===epoch){busy=false;controller=null;$('shake-again').disabled=false;$('ritual-stage').setAttribute('aria-busy','false');}}
}
function renderResult(result){current=result;const r=result.reading;const card=$('reading-card');card.replaceChildren(node('span','reading-number',r.number==='今日'?'今 日 签':'第 '+r.number+' 签'));const art=node('div','reading-art');art.innerHTML=landscape();card.append(art,node('h2','',r.name),node('p','poem',r.poem.join('\n')),node('span','reading-seal',r.seal));$('result-topic').textContent=topics[r.topic];$('result-title').textContent=r.title;$('reading-body').replaceChildren(...r.body.map(text=>node('p','',text)));$('action-text').textContent=r.action;$('action-time').textContent=r.time;const entry=saved.find(x=>x.reading.id===r.id);$('action-done').checked=entry?.done||false;$('done-note').hidden=!$('action-done').checked;$('source-note').textContent=result.source==='ai'?'AI 为这一刻写下的解读 · 留下对你有帮助的话。':result.source==='fallback'?'这次 AI 解读暂未送达，先送你一段温柔的主题签文。':'一签主题签文 · 留下对你有帮助的话。';updateSaveButton();showView('result-view','result-title');}
function updateSaveButton(){const exists=saved.some(x=>x.reading.id===current?.reading.id);$('save').classList.toggle('saved',exists);$('save').querySelector('span').textContent=exists?'已收进签笺':'收好这张签';$('save').setAttribute('aria-label',exists?'已收进签笺，点击打开我的签笺':'收好这张签');}
function formatDate(date){return new Date(date).toLocaleDateString('zh-CN',{month:'long',day:'numeric'});}
function renderJournal(){updateCount();const list=$('journal-list');list.replaceChildren();if(!saved.length){const empty=node('div','empty-journal');empty.append(node('h3','','这里，等一段温柔的回音。'),node('p','','读完签后，点「收好这张签」。想起时，随时回来看看。'));const start=node('button','text-button','去抽一支签 →');start.id='empty-start';empty.append(start);list.append(empty);return;}
  for(const entry of saved){const r=entry.reading,article=node('article','saved-reading'),open=node('button','saved-open');open.dataset.open=r.id;open.setAttribute('aria-label','重读'+r.name);open.append(node('small','',topics[r.topic]+' · '+formatDate(entry.date)+(entry.source==='ai'?' · AI 解读':'')+(entry.done?' · 已许下小小一步':'')),node('h3','',r.name),node('p','',r.poem.join('，')));const remove=node('button','delete-button','删除');remove.dataset.remove=r.id;remove.setAttribute('aria-label','删除'+r.name);article.append(open,remove);list.append(article);}}
function openJournal(){renderJournal();$('journal-modal').showModal();}
buttons.forEach(button=>button.addEventListener('click',()=>chooseTopic(button)));
$('skip-animation').addEventListener('click',()=>{revealChoices();buttons[0].focus();});$('shake-again').addEventListener('click',beginRitual);$('home').addEventListener('click',goHome);$('restart').addEventListener('click',goHome);$('another').addEventListener('click',goHome);
$('save').addEventListener('click',()=>{if(!current)return;if(saved.some(x=>x.reading.id===current.reading.id)){openJournal();return;}if(saved.length>=80){toast('签笺已经收满 80 张，请先移除一些旧签。');return;}if(persist([{reading:current.reading,date:new Date().toISOString(),source:current.source,done:$('action-done').checked},...saved])){updateSaveButton();toast('已收好。想起时，来「我的签笺」看看。');}});
$('action-done').addEventListener('change',()=>{$('done-note').hidden=!$('action-done').checked;if(saved.some(x=>x.reading.id===current?.reading.id)){if(!persist(saved.map(x=>x.reading.id===current.reading.id?{...x,done:$('action-done').checked}:x))){$('action-done').checked=!$('action-done').checked;$('done-note').hidden=!$('action-done').checked;}}});
$('journal-open').addEventListener('click',openJournal);$('about-open').addEventListener('click',()=>$('about-modal').showModal());$('tip-open').addEventListener('click',()=>$('tip-modal').showModal());
for(const dialog of document.querySelectorAll('dialog')){dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});}
$('journal-list').addEventListener('click',event=>{const open=event.target.closest('[data-open]'),remove=event.target.closest('[data-remove]');if(open){const entry=saved.find(x=>x.reading.id===open.dataset.open);if(entry){stopRitual();$('journal-modal').close();renderResult({reading:entry.reading,source:entry.source});}}else if(remove){if(persist(saved.filter(x=>x.reading.id!==remove.dataset.remove))){renderJournal();updateSaveButton();$('journal-modal').querySelector('[data-close]').focus();toast('已从这台设备移除这张签。');}}else if(event.target.closest('#empty-start')){$('journal-modal').close();goHome();}});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY||event.key===null){saved=readSaved();updateCount();updateSaveButton();if($('journal-modal').open)renderJournal();}});
reduceMotion.addEventListener?.('change',event=>{if(event.matches&&!busy&&!$('ritual-view').hidden)revealChoices();});
$('today-date').textContent=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());$('today-date').dateTime=new Date().toISOString().slice(0,10);
saved=readSaved();updateCount();beginRitual();

