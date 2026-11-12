import {calculateInvestmentScenario} from '../domain/investment-scenario.mjs';
import {financialToolSummary} from '../domain/analysis-flow.mjs';
import {snapshot} from './finance-store.ts';
import {financialTools} from './financial-tools.ts';
import {createResearchHandlers} from './research-http.ts';
import {createMarketHandlers} from './market-http.ts';

type Input={key:string;question:string;provider:'compatible'|'chatgpt';searchQuery?:string};
type Event={type:string;[key:string]:unknown};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});

export function createInvestmentHandlers(deps:any){
 return {async POST(req:Request){
  try{
   req.signal.throwIfAborted();
   const user=await deps.getUser();if(!user)return json({error:'请先登录'},401);
   const owner=deps.getOwner();if(owner&&owner!==user.userId)return json({error:'当前分享访问只读'},403);
   const origin=req.headers.get('origin');if(origin&&new URL(origin).origin!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
   const raw=await req.text();if(raw.length>12000)return json({error:'输入过长'},413);
   const value:unknown=JSON.parse(raw);
   if(!value||typeof value!=='object'||Array.isArray(value))return json({error:'投资问题格式无效'},422);
   const p=value as Partial<Input>;
   if(typeof p.key!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(p.key)||typeof p.question!=='string'||!p.question.trim()||p.question.length>3000)return json({error:'投资问题或请求标识无效'},422);
   if(!['compatible','chatgpt'].includes(p.provider??''))return json({error:'请选择有效的研究提供方'},422);
   if(p.searchQuery!==undefined&&typeof p.searchQuery!=='string')return json({error:'检索关键词格式无效'},422);
   const input=p as Input,config=deps.getConfig();
   if(input.provider==='compatible'){
    if(!config?.baseUrl||!config?.key||!config?.model)return json({error:'请配置研究模型，或选择已授权的ChatGPT'},503);
    if(!config.searchKey)return json({error:'联网研究需配置搜索服务并填写检索关键词'},503);
   }else{
    if(!deps.chatgpt)return json({error:'请先连接ChatGPT并选择授权模型'},503);
    const status=await deps.chatgpt.status(user.userId);
    if(!status.connected||!status.model)return json({error:'请先连接ChatGPT并选择授权模型'},503);
   }
   const db=deps.getDb();if(!db)return json({error:'数据库未配置'},503);
   const cancelled=new AbortController();
   const signal=AbortSignal.any([req.signal,cancelled.signal,AbortSignal.timeout(deps.timeoutMs??240000)]);
   const run=async(emit:(event:Event)=>void)=>{
    signal.throwIfAborted();
    const state=await snapshot(db),tools:Record<string,()=>Promise<unknown>>=financialTools(db,state),facts:Record<string,unknown>={};
    let refreshedQuotes:Record<string,{status?:string;message?:string}>={};
    for(const [name,read] of Object.entries(tools)){
     signal.throwIfAborted();emit({type:'tool',name,status:'running'});
     if(name==='get_market_quotes'){
      const market=await createMarketHandlers({...deps,getUser:async()=>user,getDb:()=>db}).GET(new Request(req.url,{signal}));
      if(market.ok)refreshedQuotes=(await market.json() as {quotes?:typeof refreshedQuotes}).quotes??{};
     }
     const value=await read();
     facts[name]=name==='get_market_quotes'?{...(value as object),quotes:((value as {quotes?:{accountId:string;status:string}[]}).quotes??[]).map(quote=>({...quote,status:refreshedQuotes[quote.accountId]?.status??quote.status,message:refreshedQuotes[quote.accountId]?.message??null})),refreshAttempted:true,note:'已检查报价源与短期缓存，保留原报价日期；更新失败时标注stale或unavailable，不保证实时成交价'}:value;
     signal.throwIfAborted();emit({type:'tool',name,status:'completed',summary:financialToolSummary(name,facts[name])});
    }
    const calculation={...calculateInvestmentScenario(input.question,{state,quotes:(facts.get_market_quotes as any)?.quotes??[],cashflowForecast:(facts.get_cashflow_context as any)?.forecast??null}),factsRevision:state.book.revision};
    const fetcher=async(target:any,options:RequestInit={})=>{
     const combined=options.signal?AbortSignal.any([signal,options.signal]):signal;combined.throwIfAborted();
     const response=await(deps.fetcher??fetch)(target,{...options,signal:combined});combined.throwIfAborted();return response;
    };
    const chatgpt=deps.chatgpt?{...deps.chatgpt,infer:async(owner:string,instructions:string,question:string,options:Record<string,unknown>={})=>{
     signal.throwIfAborted();const response=await deps.chatgpt.infer(owner,instructions,question,{...options,signal});signal.throwIfAborted();return response;
    }}:undefined;
    let streamed=false;const delegated=createResearchHandlers({...deps,getUser:async()=>user,getDb:()=>db,getConfig:()=>config,fetcher,chatgpt,financialFacts:facts,investmentCalculation:calculation,onEvent:(event:Event)=>{if(event.type==='tool'&&event.name!=='classify_expense')emit({...event,...(event.name==='public_research'?{name:'market_research'}:{})})},onDelta:(text:string)=>{streamed=true;emit({type:'delta',text,mode:'stream'})}});
    emit({type:'tool',name:'investment_research',status:'running',mode:'complete_result'});
    const response=await delegated.POST(new Request(req.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:input.key,kind:'wealth',question:input.question,provider:input.provider,...(input.searchQuery?{searchQuery:input.searchQuery}:{})}),signal}));
    const result=await response.json() as {id?:unknown;proposal?:{kind?:unknown;budget?:unknown;content?:unknown};error?:unknown};
    signal.throwIfAborted();
    if(!response.ok)return {response:json({error:typeof result.error==='string'?result.error:'投资研究未完成'},response.status),error:result.error};
    if(typeof result.id!=='string'||result.proposal?.kind!=='wealth'||result.proposal.budget!==null||typeof result.proposal.content!=='string')throw Error('投资研究返回无效');
    emit({type:'tool',name:'investment_research',status:'completed',summary:'投资研究已完成，保留引用与待核实事项',mode:'complete_result'});
    if(!streamed)emit({type:'delta',text:result.proposal.content,mode:'complete_result'});
    return {response:json(result),value:result};
   };
   if(!req.headers.get('accept')?.includes('text/event-stream')){
    try{return (await run(()=>{})).response}catch(error){return json({error:signal.aborted?'投资分析已取消或超时，未生成完成结果':error instanceof Error?error.message:'投资研究未完成'},signal.aborted?499:502)}
   }
   let closed=false;const encoder=new TextEncoder();
   const stream=new ReadableStream<Uint8Array>({start(controller){
    const emit=(event:Event)=>{if(!closed)controller.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\n\n'));};
    void(async()=>{try{const result=await run(emit);signal.throwIfAborted();if(result.value)emit({type:'result',value:result.value});else emit({type:'error',error:result.error??'投资研究未完成'});}catch(error){if(!closed)emit({type:'error',error:signal.aborted?'投资分析已取消或超时，未生成完成结果':error instanceof Error?error.message:'投资研究未完成'});}finally{if(!closed){closed=true;controller.close();}}})();
   },cancel(){closed=true;cancelled.abort();}});
   return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'}});
  }catch(error){return json({error:req.signal.aborted?'投资分析已取消':error instanceof Error?error.message:'投资问题无效'},req.signal.aborted?499:422)}
 }};
}
