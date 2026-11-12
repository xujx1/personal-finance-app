const str={type:'string'},money={type:'string',pattern:'^[0-9]+(\\.[0-9]{1,2})?$',description:'人民币元十进制字符串，例如400万元为4000000.00，不能传分'},date={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},nullableDate={...date,type:['string','null']};
type JsonSchema=Record<string,unknown>;
const object=(properties:Record<string,JsonSchema>,required=Object.keys(properties))=>({type:'object',additionalProperties:false,properties,required});
const section=(name:string,data:JsonSchema)=>object({section:{type:'string',const:name},data,analysis:{type:'string',minLength:1,maxLength:6000}});
export const setupDraftSchemas=[
 section('members',object({members:{type:'array',minItems:1,maxItems:20,items:object({name:{type:'string',minLength:1,maxLength:60}})}})),
 section('asset_types',object({additions:{type:'array',minItems:1,maxItems:10,items:object({id:{type:'string',pattern:'^[a-z][a-z0-9_-]{0,63}$'},name:{type:'string',minLength:1,maxLength:40},baseCategory:{type:'string',enum:['cash','term_deposit','fund','stock','property','loan','other']},goalBucket:{type:['string','null'],enum:['stock','deposits','broadIndex','preciousMetals',null]}})}})),
 section('goals',object({name:{type:'string',minLength:1,maxLength:100},targets:{type:'array',minItems:1,maxItems:20,items:object({scope:{...str,description:'从真实goalScopeOptions/资产类别取得group:组合ID或type:资产类型ID；不选择重叠范围'},target:money})},monthlyTarget:{...money,type:['string','null']},deadline:nullableDate})),
 section('recurring',object({name:{type:'string',minLength:1,maxLength:100},type:{type:'string',enum:['income','expense','loan','investment']},accountId:str,cashMemberId:str,amount:money,day:{type:'integer',minimum:1,maximum:31},start:{...date,description:'今天或将来的开始日期，必须是用户明确提供的规则，不可从历史推断'},end:nullableDate,loanId:str,assetId:str},['name','type','accountId','cashMemberId','amount','day','start','end']))
];
