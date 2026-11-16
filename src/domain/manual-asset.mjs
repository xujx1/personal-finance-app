import {minor} from './finance.mjs';
import {resolveFinanceMember} from './member-ownership.mjs';
import {assetTypeForWrite} from './asset-types.mjs';

// Opening an existing asset is separate from recording a purchase or income.
export function validateManualAsset(body,state,actor){
 const allowed=['confirmed','name','category','assetTypeId','currency','amount','ownerMemberId','asOf','note','bank','startDate','annualRate','maturityDate','market','code','quantity','cost','price','monthly','rate','day','repricingDate','pension'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!allowed.includes(key)))throw Error('手动新增资产字段无效');
 if(body.confirmed!==true)throw Error('请确认这是已有资产的开账登记');
 const member=state.householdMembers?.find(member=>member.userId===actor&&member.active);
 if(!member)throw Error('仅有效家庭成员可新增资产');
 if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>100)throw Error('请填写资产名称');
 if(!['CNY','USD'].includes(body.currency)||typeof body.amount!=='string')throw Error('请填写正确的币种与原币金额');
 minor(body.amount);
 const owner=resolveFinanceMember(state,body.ownerMemberId??'user:'+actor,{write:true});
 if(member.role!=='owner'&&owner.userId!==actor)throw Error('家庭成员只能手动新增本人名下的资产');
 assetTypeForWrite(state,body.assetTypeId,{category:body.category,kind:body.category==='loan'?'LIABILITY':'ASSET',name:body.name,metadata:{}});
 if(!['cash','term_deposit','fund','stock','property','loan','other'].includes(body.category))throw Error('资产类型无效');
 if(typeof body.asOf!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.asOf)||!Number.isFinite(Date.parse(body.asOf))||new Date(body.asOf).toISOString().slice(0,10)!==body.asOf)throw Error('请填写有效的余额核对日期');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
 if(body.asOf>today)throw Error('已有资产的核对日期不能在未来');
 return owner.id;
}
