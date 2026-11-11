// Provider-specific switches stay server-side; credentials and user input are never logged here.
/** @param {any} config @param {{maxTokens?:number,schema?:any}} [options] */
export function generationOptions(config,{maxTokens=10000,schema=null}={}){
 let qwen=false;try{const host=new URL(config.baseUrl).hostname;qwen=(host==='maas.qianwenaiapi.com'||host.endsWith('.maas.qianwenaiapi.com')||host==='dashscope.aliyuncs.com'||host==='dashscope-intl.aliyuncs.com')&&/^qwen3\.(?:5|6|7|8)-(?:max|plus|flash)(?:-|$)/i.test(config.model)}catch{}
 return {stream:true,max_tokens:maxTokens,...(qwen?{enable_thinking:false,response_format:schema?{type:'json_schema',json_schema:{name:'family_research',strict:true,schema}}:{type:'json_object'}}:{})};
}
