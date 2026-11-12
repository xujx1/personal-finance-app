import {normalizePension,isPensionAccount,pensionSummary} from '../domain/pension.mjs';
import {minor,decimal,MAX_MINOR} from '../domain/finance.mjs';
import {accountMember} from '../domain/member-ownership.mjs';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function extendPension(c:any){
 if(c.action!=='pension.contribute')return false;
 const {body,state,account,rows,db,ds,journal,entry,result,assertCashMember}=c;
 if(Object.keys(body).some(k=>!['assetId','accountId','cashMemberId','amount','date','actualConfirmed','balanceUncovered','note'].includes(k))||body.actualConfirmed!==true||body.balanceUncovered!==true)throw Error('请核对充值已实际完成且未包含在登记余额中');
 const a=account(body.assetId),bank=account(body.accountId),date=body.date;
 if(!isPensionAccount(a)||a.archived||bank.archived||bank.category!=='cash'||bank.currency!=='CNY'||a.currency!=='CNY')throw Error('请选择有效养老金与人民币银行现金账户');assertCashMember(bank,body.cashMemberId);if(accountMember(a,state).id!==accountMember(bank,state).id)throw Error('个人养老金必须从同一成员的银行账户充值');
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today())throw Error('请填写已经实际充值的日期');
 if(date<=(bank.metadata.asOf??'')||date<=(a.metadata.asOf??'')||date<(a.metadata.lastContributionAt??''))throw Error('充值日期已被余额快照覆盖，不能重复记账');
 const year=Number(date.slice(0,4)),p=normalizePension(a.metadata.pension,decimal(a.balance)),sum=pensionSummary(a,year),used=state.accounts.filter((x:any)=>isPensionAccount(x)&&accountMember(x,state).id===accountMember(a,state).id).reduce((n:number,x:any)=>n+pensionSummary(x,year).contributed,0),n=minor(String(body.amount));if(n<=0||n>Math.max(0,sum.annualLimit-used)||a.balance+n>MAX_MINOR)throw Error('充值金额无效或超过该年度剩余额度');
 if(bank.balance<n)throw Error('所选银行现金不足');
 const contributions=p.contributions.some((x:any)=>x.year===year)?p.contributions.map((x:any)=>x.year===year?{year,amount:decimal(minor(x.amount)+n)}:x):[...p.contributions,{year,amount:decimal(n)}];
 const pension=normalizePension({...p,cashBalance:decimal(minor(p.cashBalance)+n),contributions},decimal(a.balance+n));
 journal('ASSET_BUY',n,[entry(bank,-n),entry(a,n)],{assetId:a.id,accountId:bank.id,pensionContribution:true,contributionYear:year,businessDate:date,note:typeof body.note==='string'?body.note.slice(0,300):'个人养老金实际充值；资产内部转换，非消费'});
 rows.push(db.prepare('UPDATE accounts SET metadata=? WHERE dataset_id=? AND id=?').bind(JSON.stringify({...a.metadata,pension,lastContributionAt:date}),ds,a.id));result.assetId=a.id;return true;
}
