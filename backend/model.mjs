import { randomInt, randomUUID } from 'node:crypto';
import { topics } from '../frontend/readings.js';
import { qians, composeReading } from '../frontend/qian.js';

export class ModelError extends Error {
  constructor(code) { super(code); this.code=code; }
}
const limits={title:80,action:240,time:20};
function shortText(value,max) {
  return typeof value==='string' && value.trim().length>0 && value.length<=max && !/[<>\u0000-\u0008]/.test(value);
}
// The model only writes the interpretation. Name, poem, level and seal always come from the qian library.
export function validateReading(value) {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new ModelError('INVALID_OUTPUT');
  for(const [key,max] of Object.entries(limits)) if(!shortText(value[key],max)) throw new ModelError('INVALID_OUTPUT');
  if(!Array.isArray(value.body) || value.body.length!==2 || !value.body.every(x=>shortText(x,400))) throw new ModelError('INVALID_OUTPUT');
  return {title:value.title,body:[...value.body],action:value.action,time:value.time};
}
export function curatedReading(qian,aspect) {
  return composeReading(qian,aspect,randomInt);
}
export const SYSTEM_PROMPT=`你是一签的解签人。用户摇到一支签，并选了想问的方面。请结合这支签的签名、签诗和签意，围绕所问方面写一段温柔、具体、有陪伴感的解签。签文是娱乐与自省，不是真实预测。
不要宣称知道用户未提供的经历、性格或他人的内心。不要保证未来、制造灾祸或焦虑，不给医疗、法律、投资决策，不诱导付费消灾。尊重用户自主性，避免空洞夸赞和说教。签等只有上上、上、中、平，不要说成凶签。
只输出一个 JSON 对象，不要 Markdown 或 HTML。字段：title（温柔短句，可含换行，最多40字）、body（恰好两段，每段50-110字：第一段把签诗的意象和所问方面连起来，第二段提供可选择的视角）、action（与所问方面相关、今天可做的低门槛小事，最多80字）、time（例如3 分钟）。不得输出额外字段。`;
async function boundedJson(response) {
  const reader=response.body?.getReader();
  if(!reader) throw new ModelError('INVALID_OUTPUT');
  const chunks=[];let size=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new ModelError('OUTPUT_TOO_LARGE');}chunks.push(value);}}
  finally {reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ModelError('INVALID_OUTPUT');}
}
export async function generateReading(qian,aspect,config,{fetchImpl=fetch}={}) {
  const q=qians[qian-1];
  const base=new URL(config.baseUrl.endsWith('/')?config.baseUrl:config.baseUrl+'/');
  const endpoint=new URL('chat/completions',base);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),config.timeoutMs);timer.unref?.();
  try {
    const body={model:config.model,messages:[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:JSON.stringify({签号:'第'+qian+'签',签名:q.name,签等:q.level,签诗:q.poem.join('，'),签意:q.meaning,所问方面:topics[aspect],日期:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date()),指令:'请为这支签解签。'})}],stream:false};
    if(config.jsonMode)body.response_format={type:'json_object'};
    body[config.tokenParameter]=config.maxTokens;
    const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+config.apiKey},body:JSON.stringify(body),signal:controller.signal,redirect:'error'});
    if(!response.ok){await response.body?.cancel();throw new ModelError('UPSTREAM_UNAVAILABLE');}
    const envelope=await boundedJson(response);
    const content=envelope?.choices?.[0]?.message?.content;
    if(typeof content!=='string')throw new ModelError('INVALID_OUTPUT');
    let parsed;try{parsed=JSON.parse(content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw new ModelError('INVALID_OUTPUT');}
    const base=composeReading(qian,aspect,()=>0);
    return {...base,...validateReading(parsed),id:'ai-'+randomUUID()};
  } catch(error) {
    if(error instanceof ModelError)throw error;
    throw new ModelError(controller.signal.aborted?'MODEL_TIMEOUT':'UPSTREAM_UNAVAILABLE');
  } finally {clearTimeout(timer);}
}
