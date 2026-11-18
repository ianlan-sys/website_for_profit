import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isIP } from 'node:net';
import { randomInt } from 'node:crypto';
import { curatedReading,generateReading,curatedDeep,generateDeep } from './model.mjs';
import { qians } from '../frontend/qian.js';
import { topics } from '../frontend/readings.js';
const ROOT=fileURLToPath(new URL('../frontend/',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.json':'application/json; charset=utf-8'};
// Cloudflare Web Analytics (optional, enabled in the Cloudflare dashboard) injects its beacon from these two hosts.
const CSP="default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' data:; connect-src 'self' https://cloudflareinsights.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'";
function integer(value,fallback,min,max){if(value===undefined||value==='')return fallback;const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw Error('Invalid numeric server configuration');return n;}
export function configFromEnv(env=process.env) {
  const config={host:env.HOST||'127.0.0.1',port:integer(env.PORT,3000,0,65535),apiKey:env.MODEL_API_KEY||'',baseUrl:env.MODEL_BASE_URL||'https://api.openai.com/v1',model:env.MODEL_NAME||'',jsonMode:env.MODEL_JSON_MODE!=='false',tokenParameter:env.MODEL_TOKEN_PARAMETER||'max_tokens',maxTokens:integer(env.MODEL_MAX_TOKENS,1400,200,8000),deepMaxTokens:integer(env.MODEL_DEEP_MAX_TOKENS,2400,200,8000),deepTimeoutMs:integer(env.MODEL_DEEP_TIMEOUT_MS,45000,1000,90000),disableThinking:env.MODEL_DISABLE_THINKING==='true',reasoningEffort:env.MODEL_REASONING_EFFORT||'',timeoutMs:integer(env.MODEL_TIMEOUT_MS,25000,100,30000),fallback:env.MODEL_FALLBACK!=='false',publicOrigin:env.PUBLIC_ORIGIN||'',trustProxy:env.TRUST_PROXY==='true',rateWindowMs:integer(env.RATE_WINDOW_MS,60000,1000,3600000),rateMax:integer(env.RATE_MAX,8,1,1000),maxConcurrent:integer(env.MODEL_MAX_CONCURRENT,3,1,20),hourlyBudget:integer(env.MODEL_HOURLY_LIMIT,120,1,10000)};
  if(!['max_tokens','max_completion_tokens'].includes(config.tokenParameter))throw Error('MODEL_TOKEN_PARAMETER must be max_tokens or max_completion_tokens');
  config.models=config.model.split(',').map(x=>x.trim()).filter(Boolean);config.model=config.models[0]||'';
  if(config.models.length>4||config.models.some(x=>!/^[\w.:/-]{1,80}$/.test(x)))throw Error('MODEL_NAME must be up to 4 model names separated by commas');
  if(config.apiKey&&!config.model)throw Error('MODEL_NAME is required when MODEL_API_KEY is set');
  if(config.reasoningEffort&&!/^[a-z]{2,12}$/.test(config.reasoningEffort))throw Error('MODEL_REASONING_EFFORT must be a single lowercase word such as low');
  const u=new URL(config.baseUrl);
  if(u.username||u.password||u.search||u.hash||!['https:','http:'].includes(u.protocol))throw Error('MODEL_BASE_URL must be an API base URL without credentials, query or fragment');
  if(u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('Remote model endpoints require HTTPS');
  if(config.publicOrigin){const origin=new URL(config.publicOrigin);if(origin.origin!==config.publicOrigin||!['http:','https:'].includes(origin.protocol))throw Error('PUBLIC_ORIGIN must be an origin without trailing slash');}
  return config;
}
// Accepts {qian:1-100, aspect}. Older pages sent {topic}; they still get a random qian for that aspect.
export function parseFortuneRequest(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const keys=Object.keys(input);
  if(keys.length===1&&keys[0]==='topic')return Object.hasOwn(topics,input.topic)?{qian:randomInt(1,qians.length+1),aspect:input.topic}:null;
  if(keys.length!==2||!keys.includes('qian')||!keys.includes('aspect'))return null;
  if(!Number.isInteger(input.qian)||input.qian<1||input.qian>qians.length||!Object.hasOwn(topics,input.aspect))return null;
  return {qian:input.qian,aspect:input.aspect};
}
export function createApp(config=configFromEnv(),{fetchImpl=fetch,now=Date.now}={}) {
  const buckets=new Map();let active=0,budgetHour=0,budgetUsed=0;
  function json(res,status,data,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(data));}
  function allowedRate(ip){const time=now();if(buckets.size>5000)for(const [key,val]of buckets)if(val.until<=time)buckets.delete(key);let value=buckets.get(ip);if(!value||value.until<=time){if(buckets.size>=10000&&!buckets.has(ip))return false;value={used:0,until:time+config.rateWindowMs};buckets.set(ip,value);}return ++value.used<=config.rateMax;}
  // One line per failed model call so `docker compose logs app` shows why a fallback happened. The key is scrubbed.
  function logModelError(endpoint,error){let detail=String(error?.detail||'');if(config.apiKey)detail=detail.split(config.apiKey).join('***');console.warn(JSON.stringify({event:'model_error',endpoint,code:error?.code||'UNKNOWN',detail}));}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',CSP);res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,mode:config.apiKey?'ai':'curated',version:'2.0.0'});
      if(url.pathname==='/api/fortune'||url.pathname==='/api/deep') {
        const deep=url.pathname==='/api/deep';
        if(req.method!=='POST')return json(res,405,{error:{code:'METHOD_NOT_ALLOWED',message:'请使用 POST 请求。'}},{Allow:'POST'});
        const expected=config.publicOrigin||'http://'+req.headers.host;
        if((req.headers.origin&&req.headers.origin!==expected)||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:{code:'ORIGIN_DENIED',message:'请从网站页面发起请求。'}});
        if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return json(res,415,{error:{code:'JSON_REQUIRED',message:'请发送 JSON 数据。'}});
        let ip=req.socket.remoteAddress||'unknown';
        if(config.trustProxy){const forwarded=req.headers['x-forwarded-for'];const candidate=typeof forwarded==='string'?forwarded.split(',').at(-1).trim():'';if(isIP(candidate))ip=candidate;}
        if(!allowedRate(ip))return json(res,429,{error:{code:'RATE_LIMITED',message:'先让这一签陪你一会儿，稍后再来。'}},{'Retry-After':String(Math.ceil(config.rateWindowMs/1000))});
        if(Number(req.headers['content-length'])>2048){req.resume();return json(res,413,{error:{code:'BODY_TOO_LARGE',message:'请求内容过长。'}});}
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>2048){req.resume();return json(res,413,{error:{code:'BODY_TOO_LARGE',message:'请求内容过长。'}});}chunks.push(chunk);}
        let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(res,400,{error:{code:'INVALID_JSON',message:'请求格式不正确。'}});}
        const request=deep&&!Object.hasOwn(input??{},'qian')?null:parseFortuneRequest(input);
        if(!request)return json(res,400,{error:{code:'INVALID_TOPIC',message:'请先摇出一支签，再选择想问的方面。'}});
        const {qian,aspect}=request,generatedAt=new Date(now()).toISOString();
        const curated=()=>deep?{deep:curatedDeep(qian,aspect)}:{reading:curatedReading(qian,aspect)};
        if(!config.apiKey)return json(res,200,{source:'curated',generatedAt,...curated()});
        const hour=Math.floor(now()/3600000);if(hour!==budgetHour){budgetHour=hour;budgetUsed=0;}
        if(active>=config.maxConcurrent||budgetUsed>=config.hourlyBudget)return json(res,429,{error:{code:'MODEL_BUSY',message:'此刻来求签的人有些多，请稍后再试。'}},{'Retry-After':'60'});
        active++;budgetUsed++;
        try {const result=deep?{deep:await generateDeep(qian,aspect,config,{fetchImpl})}:{reading:await generateReading(qian,aspect,config,{fetchImpl})};return json(res,200,{source:'ai',generatedAt,...result});}
        catch(error){logModelError(deep?'deep':'fortune',error);if(config.fallback)return json(res,200,{source:'fallback',generatedAt,notice:'这次 AI 解签暂时没有送达，先送你一段一签的内置解签。',...curated()});return json(res,502,{error:{code:error.code||'MODEL_UNAVAILABLE',message:'签文暂时没有送达，请稍后再试。'}});}
        finally {active--;}
      }
      if(url.pathname.startsWith('/api/'))return json(res,404,{error:{code:'NOT_FOUND',message:'接口不存在。'}});
      if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:{code:'METHOD_NOT_ALLOWED',message:'不支持此请求方法。'}},{Allow:'GET, HEAD'});
      const decoded=decodeURIComponent(url.pathname);
      if(decoded.includes('\0')||decoded.split(/[\\/]/).some(p=>p.startsWith('.')))return json(res,404,{error:{code:'NOT_FOUND',message:'页面不存在。'}});
      const file=path.resolve(ROOT,'.'+(decoded==='/'?'/index.html':decoded));
      if(!file.startsWith(ROOT)||!MIME[path.extname(file)])return json(res,404,{error:{code:'NOT_FOUND',message:'页面不存在。'}});
      let bytes;try{bytes=await fs.readFile(file);}catch{return json(res,404,{error:{code:'NOT_FOUND',message:'页面不存在。'}});}
      // Link previews need absolute URLs; only the configured PUBLIC_ORIGIN is used, never the Host header.
      if(file===path.join(ROOT,'index.html'))bytes=Buffer.from(bytes.toString('utf8').replaceAll('__ORIGIN__',config.publicOrigin));
      res.writeHead(200,{'Content-Type':MIME[path.extname(file)],'Content-Length':bytes.length,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
    } catch {if(!res.headersSent)json(res,500,{error:{code:'SERVER_ERROR',message:'暂时没能展开这支签，请稍后再试。'}});else res.end();}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const config=configFromEnv();const server=createApp(config);server.listen(config.port,config.host,()=>console.log(`一签: http://${config.host}:${config.port} · ${config.apiKey?'AI enabled':'curated readings'}`));const stop=()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();};process.on('SIGTERM',stop);process.on('SIGINT',stop);}
  catch(error){console.error('Configuration error: '+error.message);process.exitCode=1;}
}

