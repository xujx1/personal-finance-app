export const ASSET_GOAL_GROUPS=[
 {id:'stock',label:'股票',hint:'个股与已明确的股票资产',color:'#356d58'},
 {id:'deposits',label:'银行存款＋国债',hint:'活期、定期存款及明确的国债',color:'#8d9d65'},
 {id:'broadIndex',label:'宽基指数',hint:'纳斯达克等已明确的宽基指数',color:'#789caa'},
 {id:'preciousMetals',label:'黄金与贵金属',hint:'实物贵金属及对应基金',color:'#c9a65f'}
];
const ids=ASSET_GOAL_GROUPS.map(x=>x.id),excluded=['property','prepayment','system'];

export function legacyGoalBucket(account){
 const category=account.category,metadata=account.metadata??{},name=String(account.name??'');
 if(excluded.includes(category)||account.kind!=='ASSET')return null;
 if(category==='cash'||category==='term_deposit'||category==='treasury')return 'deposits';
 // Individual mining shares remain stocks; only clearly named ETFs can use a special bucket.
 if(category==='stock'&&!/ETF|指数基金/i.test(name))return 'stock';
 if(/生物科技|生物医药|矿业|采矿|金矿|黄金股|贵金属股|gold miners|gold mining/i.test(name))return null;
 if(/黄金|白银|铂金|钯金|贵金属|\b(gold|silver|platinum|palladium)\b/i.test(name))return 'preciousMetals';
 if(/纳斯达克(?:100|一百)?|纳指|nasdaq[ -]?100|标普[ -]?500|s\s*&\s*p[ -]?500|沪深[ -]?300|中证(?:[ -]?(?:500|1000|2000)|全指)|上证[ -]?50|全市场指数|全球股票指数/i.test(name))return 'broadIndex';
 if(/(?:储蓄|记账式)?国债|\btreasury\b/i.test(name))return 'deposits';
 if(category==='stock')return 'stock';
 if(ids.includes(metadata.goalBucket))return metadata.goalBucket;
 return null;
}

export const BASE_ASSET_CATEGORIES={cash:'银行现金账户',term_deposit:'银行定期存款',fund:'基金',stock:'股票证券',property:'房产',loan:'住房贷款',other:'其他资产',prepayment:'预付款（系统管理）'};
const defaults=[
 ['cash','银行现金','cash','deposits'],['term_deposit','银行定期存款','term_deposit','deposits'],['treasury','国债','other','deposits'],
 ['stock','股票证券','stock','stock'],['stock_index','证券指数ETF','stock','broadIndex'],['fund','基金','fund',null],['broad_index','宽基指数基金','fund','broadIndex'],['treasury_fund','国债基金','fund','deposits'],['metals_fund','贵金属基金','fund','preciousMetals'],['metals','黄金与贵金属','other','preciousMetals'],
 ['property','房产','property',null],['loan','住房贷款','loan',null],['other','其他资产','other',null],['prepayment','预付款资产','prepayment',null]
].map(([id,name,baseCategory,goalBucket])=>({id,name,baseCategory,goalBucket,enabled:true,builtin:true}));
export function assetTypeCatalogue(state){return (state?.documents??[]).find(d=>d.kind==='asset_type_catalog')?.payload??{version:0,types:defaults};}
export function getAssetTypes(state){return assetTypeCatalogue(state).types.map(t=>({...t}));}
export const goalEligibleType=type=>type&&type.enabled&&!['property','loan','prepayment'].includes(type.baseCategory);
// Untyped legacy assets can use an explicit old goal group without having a
// matching subtype. Include those possible groups when checking target overlap.
export function assetTypeGoalGroups(type){
 const original=defaults.find(t=>t.id===type.id),groups=[type.goalBucket,original?.goalBucket].filter(Boolean);
 if(defaults.some(t=>t.id===type.id)&&type.id===type.baseCategory&&['fund','stock','other'].includes(type.baseCategory))for(const group of ids)if(!defaults.some(t=>t.baseCategory===type.baseCategory&&t.goalBucket===group))groups.push(group);
 return [...new Set(groups)];
}
export function accountAssetType(account,state){
 const list=getAssetTypes(state),id=account.metadata?.assetTypeId;
 if(id)return list.find(t=>t.id===id&&t.baseCategory===account.category)??null;
 const bucket=legacyGoalBucket(account),fallback=defaults.find(t=>t.baseCategory===account.category&&t.goalBucket===bucket)??defaults.find(t=>t.id===account.category);return list.find(t=>t.id===fallback?.id)??null;
}
export function assetTypeForWrite(state,id,account,existingTypeId){
 const type=id?getAssetTypes(state).find(t=>t.id===id):accountAssetType({...account,kind:account.kind??(account.category==='loan'?'LIABILITY':'ASSET')},state);
 if(!type||type.baseCategory!==account.category||!type.enabled&&type.id!==existingTypeId)throw Error('资产类型不存在、已停用或与账户性质不符');
 return type.id;
}
export function normalizeAssetTypes(input,state){
 if(!Array.isArray(input)||input.length<defaults.length||input.length>50)throw Error('资产类型数量无效（最多50项）');
 const previous=getAssetTypes(state),names=new Set(),seen=new Set();
 const types=input.map(t=>{
  if(!t||typeof t!=='object'||Object.keys(t).some(k=>!['id','name','baseCategory','goalBucket','enabled','builtin'].includes(k))||typeof t.id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(t.id)||seen.has(t.id))throw Error('资产类型标识重复或无效');seen.add(t.id);
  const name=typeof t.name==='string'?t.name.trim():'';if(!name||name.length>40||/[\u0000-\u001f\u007f]/.test(name)||names.has(name.normalize('NFKC').toLocaleLowerCase()))throw Error('资产类型名称为空、重复或过长');names.add(name.normalize('NFKC').toLocaleLowerCase());
  if(!Object.hasOwn(BASE_ASSET_CATEGORIES,t.baseCategory)||!['stock','deposits','broadIndex','preciousMetals',null].includes(t.goalBucket)||typeof t.enabled!=='boolean')throw Error('账户性质或目标组合无效');
  const old=previous.find(p=>p.id===t.id);if(old&&old.baseCategory!==t.baseCategory||!old&&t.baseCategory==='prepayment')throw Error('账户性质创建后不能修改，预付款由系统管理');
  if(['property','loan','prepayment'].includes(t.baseCategory)&&t.goalBucket!==null)throw Error('房产、贷款和预付款不计入非房产目标');
  if(!t.enabled){if((state?.accounts??[]).some(a=>a.category!=='system'&&accountAssetType(a,state)?.id===t.id))throw Error('该资产类型仍被账户使用，不能停用');if((state?.documents??[]).some(d=>d.kind==='savings_goal'&&(d.payload.schemaVersion===3&&d.payload.targets?.some(row=>row.scope==='type:'+t.id)||d.payload.schemaVersion===4&&d.payload.targets?.some(row=>row.assetTypeIds?.includes(t.id)))))throw Error('该资产类型仍被目标使用，不能停用');}
  return {id:t.id,name,baseCategory:t.baseCategory,goalBucket:t.goalBucket,enabled:t.enabled,builtin:defaults.some(d=>d.id===t.id)};
 });
 if(previous.some(t=>!seen.has(t.id)))throw Error('已有类型不可删除，可停用未使用的类型');
 return types;
}

