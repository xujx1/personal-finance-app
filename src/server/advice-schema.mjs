const texts={type:'array',maxItems:12,items:{type:'string',maxLength:500}};
export function adviceResponseSchema({reviewedDraft=false}={}){
 const properties={summary:{type:'string',maxLength:3000},verdict:{type:'string',enum:['可考虑','需缩减','建议推迟','信息不足']},missing_inputs:texts,risk_reasons:texts,assumptions:texts,options:{type:'array',maxItems:reviewedDraft?0:3,items:{type:'object',properties:{title:{type:'string',maxLength:100},description:{type:'string',maxLength:600}},required:['title','description'],additionalProperties:false}},budget_items:{type:'array',maxItems:reviewedDraft?0:20,items:{type:'object',properties:{name:{type:'string',maxLength:100},amount:{type:'string',pattern:'^\\d+(?:\\.\\d{1,2})?$'}},required:['name','amount'],additionalProperties:false}},total_budget:reviewedDraft?{type:'null'}:{type:['string','null']}};
 return {type:'object',properties,required:Object.keys(properties),additionalProperties:false};
}
