import { randomInt, randomUUID } from 'node:crypto';
import { readings, topics } from '../frontend/readings.js';

export class ModelError extends Error {
  constructor(code) { super(code); this.code=code; }
}
const limits={name:16,title:80,action:240,time:20,seal:8};
function shortText(value,max) {
  return typeof value==='string' && value.trim().length>0 && value.length<=max && !/[<>\u0000-\u0008]/.test(value);
}
export function validateReading(value) {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new ModelError('INVALID_OUTPUT');
  for(const [key,max] of Object.entries(limits)) if(!shortText(value[key],max)) throw new ModelError('INVALID_OUTPUT');
  for(const [key,count,max] of [['poem',2,30],['body',2,400]]) {
    if(!Array.isArray(value[key]) || value[key].length!==count || !value[key].every(x=>shortText(x,max))) throw new ModelError('INVALID_OUTPUT');
  }
  return Object.fromEntries([...Object.keys(limits),'poem','body'].map(key=>[key,value[key]]));
}
export function curatedReading(topic) {
  const pool=readings.filter(r=>r.topic===topic);
  return {...pool[randomInt(pool.length)]};
}
export const SYSTEM_PROMPT=`你是一签的中文签文作者。为用户选中的主题写一段温柔、具体、有陪伴感的今日签。签文是娱乐与自省，不是真实预测。
不要宣称知道用户未提供的经历、性格或他人的内心。不要保证未来、制造灾祸或焦虑，不给医疗、法律、投资决策，不诱导付费消灾。尊重用户自主性，避免空洞夸赞和说教。
只输出一个 JSON 对象，不要 Markdown 或 HTML。字段：name（2-8字签名）、title（温柔短句，可含换行，最多60字）、poem（恰好两句短诗，每句5-12字）、body（恰好两段，每段40-100字，先接住感受，再提供可选择的视角）、action（今天可做、低门槛的一件小事，最多100字）、time（例如3 分钟）、seal（2-4字）。不得输出额外字段。`;
async function boundedJson(response) {
  const reader=response.body?.getReader();
  if(!reader) throw new ModelError('INVALID_OUTPUT');
  const chunks=[];let size=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();throw new ModelError('OUTPUT_TOO_LARGE');}chunks.push(value);}}
  finally {reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ModelError('INVALID_OUTPUT');}
}
export async function generateReading(topic,config,{fetchImpl=fetch}={}) {
  const base=new URL(config.baseUrl.endsWith('/')?config.baseUrl:config.baseUrl+'/');
  const endpoint=new URL('chat/completions',base);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),config.timeoutMs);timer.unref?.();
  try {
    const body={model:config.model,messages:[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:JSON.stringify({topic:topics[topic],date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date()),instruction:'请为此主题写一支今日签。'})}],stream:false};
    if(config.jsonMode)body.response_format={type:'json_object'};
    body[config.tokenParameter]=config.maxTokens;
    const response=await fetchImpl(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+config.apiKey},body:JSON.stringify(body),signal:controller.signal,redirect:'error'});
    if(!response.ok){await response.body?.cancel();throw new ModelError('UPSTREAM_UNAVAILABLE');}
    const envelope=await boundedJson(response);
    const content=envelope?.choices?.[0]?.message?.content;
    if(typeof content!=='string')throw new ModelError('INVALID_OUTPUT');
    let parsed;try{parsed=JSON.parse(content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw new ModelError('INVALID_OUTPUT');}
    return {...validateReading(parsed),id:'ai-'+randomUUID(),topic,number:'今日'};
  } catch(error) {
    if(error instanceof ModelError)throw error;
    throw new ModelError(controller.signal.aborted?'MODEL_TIMEOUT':'UPSTREAM_UNAVAILABLE');
  } finally {clearTimeout(timer);}
}
