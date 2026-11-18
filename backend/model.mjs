import { randomInt, randomUUID } from 'node:crypto';
import { topics } from '../frontend/readings.js';
import { qians, composeReading, composeDeep } from '../frontend/qian.js';

export class ModelError extends Error {
  // detail is for server logs only (never sent to the browser): status, provider message or the field that failed.
  constructor(code,detail='') { super(code); this.code=code; this.detail=String(detail).slice(0,300); }
}
const limits={title:80,action:240,time:20};
function shortText(value,max) {
  return typeof value==='string' && value.trim().length>0 && value.length<=max && !/[<>\u0000-\u0008]/.test(value);
}
// The model only writes the interpretation. Name, poem, level and seal always come from the qian library.
export function validateReading(value) {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new ModelError('INVALID_OUTPUT','output is not a JSON object');
  for(const [key,max] of Object.entries(limits)) if(!shortText(value[key],max)) throw new ModelError('INVALID_OUTPUT','bad field '+key+': '+JSON.stringify(value[key])?.slice(0,80));
  if(!Array.isArray(value.body) || value.body.length!==2 || !value.body.every(x=>shortText(x,400))) throw new ModelError('INVALID_OUTPUT','bad field body: '+JSON.stringify(value.body)?.slice(0,120));
  return {title:value.title,body:[...value.body],action:value.action,time:value.time};
}
export function curatedReading(qian,aspect) {
  return composeReading(qian,aspect,randomInt);
}
export function curatedDeep(qian,aspect) {
  return composeDeep(qian,aspect);
}
// 深度解签: three sections, a four-week plan, one blessing. Strict shape so the page can render it as text only.
export function validateDeep(value) {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new ModelError('INVALID_OUTPUT','output is not a JSON object');
  const {sections,plan,blessing}=value;
  if(!Array.isArray(sections)||sections.length!==3||!sections.every(x=>x&&shortText(x.heading,16)&&shortText(x.text,400))) throw new ModelError('INVALID_OUTPUT','bad field sections: '+JSON.stringify(sections)?.slice(0,120));
  if(!Array.isArray(plan)||plan.length!==4||!plan.every(x=>x&&shortText(x.when,12)&&shortText(x.step,160))) throw new ModelError('INVALID_OUTPUT','bad field plan: '+JSON.stringify(plan)?.slice(0,120));
  if(!shortText(blessing,60)) throw new ModelError('INVALID_OUTPUT','bad field blessing: '+JSON.stringify(blessing)?.slice(0,80));
  return {sections:sections.map(x=>({heading:x.heading,text:x.text})),plan:plan.map(x=>({when:x.when,step:x.step})),blessing};
}
export const SYSTEM_PROMPT=`你是一签的解签人。用户摇到一支签，并选了想问的方面。请结合这支签的签名、签诗和签意，围绕所问方面写一段温柔、具体、有陪伴感的解签。签文是娱乐与自省，不是真实预测。
不要宣称知道用户未提供的经历、性格或他人的内心。不要保证未来、制造灾祸或焦虑，不给医疗、法律、投资决策，不诱导付费消灾。尊重用户自主性，避免空洞夸赞和说教。签等只有上上、上、中、平，不要说成凶签。
只输出一个 JSON 对象，不要 Markdown 或 HTML。字段：title（温柔短句，可含换行，最多40字）、body（恰好两段，每段50-110字：第一段把签诗的意象和所问方面连起来，第二段提供可选择的视角）、action（与所问方面相关、今天可做的低门槛小事，最多80字）、time（例如3 分钟）。不得输出额外字段。`;
export const DEEP_PROMPT=`你是一签的解签人，正在为请过茶的访客写「深度解签」。请结合这支签的签名、签诗、签意和所问方面，写得比普通解签更具体、更有层次，但仍然温柔、克制。签文是娱乐与自省，不是真实预测。
不要宣称知道用户未提供的经历、性格或他人的内心。不要保证未来、制造灾祸或焦虑，不给医疗、法律、投资决策，不诱导付费消灾。签等只有上上、上、中、平，不要说成凶签。
只输出一个 JSON 对象，不要 Markdown 或 HTML。字段：sections（恰好三项，每项含 heading（2-10字小标题）与 text（80-180字）；第一项解读签诗意象，第二项结合所问方面谈此刻的处境，第三项提供一个新的视角）、plan（恰好四项，对应接下来四周，每项含 when（如「第一周」）与 step（一件具体、低门槛的小行动，最多60字））、blessing（一句不超过30字的寄语）。不得输出额外字段。`;
function questionFor(qian,aspect,instruction) {
  const q=qians[qian-1];
  return JSON.stringify({签号:'第'+qian+'签',签名:q.name,签等:q.level,签诗:q.poem.join('，'),签意:q.meaning,所问方面:topics[aspect],日期:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date()),指令:instruction});
}
async function boundedJson(response) {
  const reader=response.body?.getReader();
  if(!reader) throw new ModelError('INVALID_OUTPUT','empty response body');
  const chunks=[];let size=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new ModelError('OUTPUT_TOO_LARGE');}chunks.push(value);}}
  finally {reader.releaseLock();}
  const text=Buffer.concat(chunks).toString('utf8');
  try{return JSON.parse(text);}catch{throw new ModelError('INVALID_OUTPUT','response is not JSON: '+text.slice(0,120));}
}
async function callModel(system,user,config,{fetchImpl=fetch,timeoutMs=config.timeoutMs,maxTokens=config.maxTokens}={}) {
  const base=new URL(config.baseUrl.endsWith('/')?config.baseUrl:config.baseUrl+'/');
  const endpoint=new URL('chat/completions',base);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);timer.unref?.();
  try {
    const body={model:config.model,messages:[{role:'system',content:system},{role:'user',content:user}],stream:false};
    if(config.jsonMode)body.response_format={type:'json_object'};
    if(config.disableThinking)body.thinking={type:'disabled'};
    body[config.tokenParameter]=maxTokens;
    const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+config.apiKey},body:JSON.stringify(body),signal:controller.signal,redirect:'error'});
    if(!response.ok){let text='';try{text=(await response.text()).slice(0,240);}catch{}throw new ModelError('UPSTREAM_UNAVAILABLE','HTTP '+response.status+' '+text);}
    const envelope=await boundedJson(response);
    const content=envelope?.choices?.[0]?.message?.content;
    if(typeof content!=='string')throw new ModelError('INVALID_OUTPUT','no choices[0].message.content; finish_reason='+envelope?.choices?.[0]?.finish_reason);
    try{return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw new ModelError('INVALID_OUTPUT','content is not JSON: '+content.slice(0,160));}
  } catch(error) {
    if(error instanceof ModelError)throw error;
    throw new ModelError(controller.signal.aborted?'MODEL_TIMEOUT':'UPSTREAM_UNAVAILABLE',controller.signal.aborted?'no answer within '+timeoutMs+'ms':(error?.cause?.code||error?.message||''));
  } finally {clearTimeout(timer);}
}
export async function generateReading(qian,aspect,config,{fetchImpl=fetch}={}) {
  const parsed=await callModel(SYSTEM_PROMPT,questionFor(qian,aspect,'请为这支签解签。'),config,{fetchImpl});
  return {...composeReading(qian,aspect,()=>0),...validateReading(parsed),id:'ai-'+randomUUID()};
}
export async function generateDeep(qian,aspect,config,{fetchImpl=fetch}={}) {
  const parsed=await callModel(DEEP_PROMPT,questionFor(qian,aspect,'请为这支签写深度解签。'),config,{fetchImpl,timeoutMs:config.deepTimeoutMs,maxTokens:config.deepMaxTokens});
  return {qian,topic:aspect,...validateDeep(parsed)};
}
