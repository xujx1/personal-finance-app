import {normalizePension,isPensionAccount,validatePensionProductTypes} from '../domain/pension.mjs';
import {getAssetTypes} from '../domain/asset-types.mjs';
import {decimal} from '../domain/finance.mjs';
export function extendPensionClassification(c:any){
 if(c.action!=='pension.holding.classify')return false;
 const {body,state,account,rows,db,ds,result,writeDoc,actor}=c;
 if(!body||Object.keys(body).some(k=>!['assetId','holdingId','kind','assetTypeId'].includes(k))||typeof body.holdingId!=='string'||typeof body.kind!=='string'||typeof body.assetTypeId!=='string')throw Error('只可修改养老金持仓分类');
 const a=account(body.assetId);if(!isPensionAccount(a)||a.archived||a.kind!=='ASSET'||a.currency!=='CNY')throw Error('请选择有效个人养老金账户');
 const p=normalizePension(a.metadata.pension,decimal(a.balance)),h=p.holdings.find((x:any)=>x.id===body.holdingId);if(!h)throw Error('请选择本养老金账户的持仓');
 const before={kind:h.kind??null,assetTypeId:h.assetTypeId??null};h.kind=body.kind;h.assetTypeId=body.assetTypeId;
 const pension=normalizePension(p,decimal(a.balance));validatePensionProductTypes(pension,getAssetTypes(state));
 const id=crypto.randomUUID();writeDoc(id,'pension_classification',{assetId:a.id,holdingId:h.id,productName:h.name,before,after:{kind:h.kind,assetTypeId:h.assetTypeId},createdAt:new Date().toISOString(),createdBy:actor});
 rows.push(db.prepare('UPDATE accounts SET metadata=? WHERE dataset_id=? AND id=?').bind(JSON.stringify({...a.metadata,pension}),ds,a.id));result.id=id;result.assetId=a.id;return true;
}
