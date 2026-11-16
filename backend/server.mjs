import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isIP } from 'node:net';
import { curatedReading,generateReading } from './model.mjs';
import { topics } from '../frontend/readings.js';
const ROOT=fileURLToPath(new URL('../frontend/',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.json':'application/json; charset=utf-8'};
const CSP="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'";
function integer(value,fallback,min,max){if(value===undefined||value==='')return fallback;const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw Error('Invalid numeric server configuration');return n;}
export function configFromEnv(env=process.env) {
  const config={host:env.HOST||'127.0.0.1',port:integer(env.PORT,3000,0,65535),apiKey:env.MODEL_API_KEY||'',baseUrl:env.MODEL_BASE_URL||'https://api.openai.com/v1',model:env.MODEL_NAME||'',jsonMode:env.MODEL_JSON_MODE!=='false',tokenParameter:env.MODEL_TOKEN_PARAMETER||'max_tokens',maxTokens:integer(env.MODEL_MAX_TOKENS,1400,200,8000),timeoutMs:integer(env.MODEL_TIMEOUT_MS,25000,100,30000),fallback:env.MODEL_FALLBACK!=='false',publicOrigin:env.PUBLIC_ORIGIN||'',trustProxy:env.TRUST_PROXY==='true',rateWindowMs:integer(env.RATE_WINDOW_MS,60000,1000,3600000),rateMax:integer(env.RATE_MAX,8,1,1000),maxConcurrent:integer(env.MODEL_MAX_CONCURRENT,3,1,20),hourlyBudget:integer(env.MODEL_HOURLY_LIMIT,120,1,10000)};
  if(!['max_tokens','max_completion_tokens'].includes(config.tokenParameter))throw Error('MODEL_TOKEN_PARAMETER must be max_tokens or max_completion_tokens');
  if(config.apiKey&&!config.model)throw Error('MODEL_NAME is required when MODEL_API_KEY is set');
  const u=new URL(config.baseUrl);
  if(u.username||u.password||u.search||u.hash||!['https:','http:'].includes(u.protocol))throw Error('MODEL_BASE_URL must be an API base URL without credentials, query or fragment');
  if(u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('Remote model endpoints require HTTPS');
  if(config.publicOrigin){const origin=new URL(config.publicOrigin);if(origin.origin!==config.publicOrigin||!['http:','https:'].includes(origin.protocol))throw Error('PUBLIC_ORIGIN must be an origin without trailing slash');}
  return config;
}
export function createApp(config=configFromEnv(),{fetchImpl=fetch,now=Date.now}={}) {
  const buckets=new Map();let active=0,budgetHour=0,budgetUsed=0;
  function json(res,status,data,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(data));}
  function allowedRate(ip){const time=now();if(buckets.size>5000)for(const [key,val]of buckets)if(val.until<=time)buckets.delete(key);let value=buckets.get(ip);if(!value||value.until<=time){if(buckets.size>=10000&&!buckets.has(ip))return false;value={used:0,until:time+config.rateWindowMs};buckets.set(ip,value);}return ++value.used<=config.rateMax;}
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',CSP);res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/health'&&req.method==='GET')return json(res,200,{ok:true,mode:config.apiKey?'ai':'curated',version:'2.0.0'});
      if(url.pathname==='/api/fortune') {
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
        if(!input||typeof input!=='object'||Array.isArray(input)||!Object.hasOwn(topics,input.topic)||Object.keys(input).some(k=>k!=='topic'))return json(res,400,{error:{code:'INVALID_TOPIC',message:'请选择爱情、事业、迷茫或成长。'}});
        const topic=input.topic,generatedAt=new Date(now()).toISOString();
        if(!config.apiKey)return json(res,200,{source:'curated',generatedAt,reading:curatedReading(topic)});
        const hour=Math.floor(now()/3600000);if(hour!==budgetHour){budgetHour=hour;budgetUsed=0;}
        if(active>=config.maxConcurrent||budgetUsed>=config.hourlyBudget)return json(res,429,{error:{code:'MODEL_BUSY',message:'此刻来求签的人有些多，请稍后再试。'}},{'Retry-After':'60'});
        active++;budgetUsed++;
        try {const reading=await generateReading(topic,config,{fetchImpl});return json(res,200,{source:'ai',generatedAt,reading});}
        catch(error){if(config.fallback)return json(res,200,{source:'fallback',generatedAt,notice:'这次 AI 解读暂时没有送达，先送你一段温柔的主题签文。',reading:curatedReading(topic)});return json(res,502,{error:{code:error.code||'MODEL_UNAVAILABLE',message:'签文暂时没有送达，请稍后再试。'}});}
        finally {active--;}
      }
      if(url.pathname.startsWith('/api/'))return json(res,404,{error:{code:'NOT_FOUND',message:'接口不存在。'}});
      if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:{code:'METHOD_NOT_ALLOWED',message:'不支持此请求方法。'}},{Allow:'GET, HEAD'});
      const decoded=decodeURIComponent(url.pathname);
      if(decoded.includes('\0')||decoded.split(/[\\/]/).some(p=>p.startsWith('.')))return json(res,404,{error:{code:'NOT_FOUND',message:'页面不存在。'}});
      const file=path.resolve(ROOT,'.'+(decoded==='/'?'/index.html':decoded));
      if(!file.startsWith(ROOT)||!MIME[path.extname(file)])return json(res,404,{error:{code:'NOT_FOUND',message:'页面不存在。'}});
      let bytes;try{bytes=await fs.readFile(file);}catch{return json(res,404,{error:{code:'NOT_FOUND',message:'页面不存在。'}});}
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

