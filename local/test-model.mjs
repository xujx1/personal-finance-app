import {createInterface} from 'node:readline';
if(process.stdin.isTTY&&process.stdin.setRawMode)process.stdin.setRawMode(true);
console.log('Ready for model connection JSON on stdin. Credentials are not logged.');
const input=await new Promise(resolve=>{const rl=createInterface({input:process.stdin});rl.once('line',line=>{rl.close();resolve(JSON.parse(line))});});
const endpoint=input.baseUrl.replace(/\/$/,'');
const operation=input.model?'chat':'models';
try{
 const response=await fetch(endpoint+(input.model?'/chat/completions':'/models'),{method:input.model?'POST':'GET',headers:{Authorization:'Bearer '+input.key,'Content-Type':'application/json'},...(input.model?{body:JSON.stringify({model:input.model,messages:[{role:'user',content:'只回复OK'}],max_tokens:16,stream:false})}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});
 const value=await response.json().catch(()=>({}));
 console.log(JSON.stringify({operation,status:response.status,model:value.model??input.model,reply:value.choices?.[0]?.message?.content?.slice(0,100),models:Array.isArray(value.data)?value.data.map(x=>({id:x.id,owned_by:x.owned_by})):[],errorCode:value.error?.code??value.code??null,errorMessage:String(value.error?.message??value.message??'').replaceAll(input.key,'[redacted]').slice(0,250)}));
}catch(e){console.log(JSON.stringify({operation,networkError:e.cause?.code??e.code??e.name,message:e.message}));process.exitCode=1;}
