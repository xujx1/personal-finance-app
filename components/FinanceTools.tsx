"use client";
import {useState,FormEvent} from 'react';
import RecurringCashflow from './RecurringCashflow';
import {MemberAccountFields,accountDisplay} from './MemberControls';
import {accountMember} from '../src/domain/member-ownership.mjs';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date());
export function AssetTrade({state,onSave,asset,transfer=false,busy=false}:{state:any;onSave:any;asset:any;transfer?:boolean;busy?:boolean}){
 const [side,setSide]=useState(transfer?'transfer':'sell');
 const cash=state.accounts.filter((account:any)=>!account.archived&&account.kind==='ASSET'&&account.category==='cash'&&account.currency===asset.currency&&(!transfer||account.id!==asset.id));
 return <section aria-label={transfer?'所选现金账户转账':'所选资产买卖记录'}>
  <p className="contextual-selection">当前{transfer?'转出账户':'资产'}：<strong>{accountDisplay(state,asset)}</strong></p>
  <p className="help-text">仅记录已经核实的真实到账，不操作银行或券商。收付款账户须与当前资产使用同一币种。</p>
  <form onSubmit={(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const body=Object.fromEntries(new FormData(event.currentTarget));onSave(transfer?'cash.transfer':'asset.trade',{...body,...(transfer?{fromId:asset.id}:{assetId:asset.id,side})});}}>
   <fieldset className="contextual-fields" disabled={busy||state.viewer?.canWrite===false}><div className="form-grid">
    {!transfer&&<label className="field">操作<select aria-label="资产交易操作" value={side} onChange={event=>setSide(event.target.value)}><option value="sell">出售 / 赎回到账</option><option value="buy">买入已到账</option></select></label>}
    <label className="field">{transfer?'转出现金账户':'已登记资产'}<input aria-label={transfer?'转出现金账户':'已登记资产'} readOnly value={accountDisplay(state,asset)}/></label>
    {transfer&&<input type="hidden" name="cashMemberId" value={accountMember(asset,state).id}/>}
    <MemberAccountFields state={state} name={transfer?'toId':'accountId'} label={transfer?'转入现金账户':'收付款现金账户'} memberName={transfer?'toMemberId':'cashMemberId'} memberLabel={transfer?'转入成员':'收付款成员'} currency={asset.currency} excludeAccountId={transfer?asset.id:undefined}/>
    <Input name="amount" label={transfer?'转账金额（原币）':'实际成交总额（不含手续费，原币）'}/>
    {!transfer&&side==='sell'&&<Input name="carrying" label="本次转出账面金额（原币）"/>}
    {!transfer&&<><Input name="fee" label="手续费（原币）" value="0.00"/><Input name="quantity" label="本次数量（持仓有数量时必填）" required={Boolean(asset.metadata?.quantity)}/></>}
    <Input name="date" label="真实发生日期" type="date" value={today()}/><Input name="note" label="核实说明" value="本人核实实际到账"/>
   </div>
   {!cash.length&&<p className="notice neutral">请先登记{transfer?'另一个':''}{asset.currency}现金账户，才能记录本次{transfer?'转账':'收付款'}。</p>}
   <button className="btn primary section-space" disabled={!cash.length||busy||state.viewer?.canWrite===false}>{busy?'正在保存…':'确认记录到账'}</button></fieldset>
  </form>
 </section>;
}
export default function FinanceTools({state,onSave}:{state:any,onSave:any}){
 return <RecurringCashflow state={state} onSave={onSave}/>;
}
function Input({name,label,value='',required=true,type='text'}:any){return <label className="field">{label}<input name={name} defaultValue={value} required={required} type={type}/></label>}

export function ScheduledLoanBudget({state,onSave}:{state:any;onSave:(action:string,body:any)=>Promise<any>}){
 const [saving,setSaving]=useState(false);
 return <form className="scheduled-budget-form" onSubmit={async event=>{event.preventDefault();const form=event.currentTarget,body:any=Object.fromEntries(new FormData(form));for(const field of ['loanId','principal','interest'])if(body[field]==='')delete body[field];setSaving(true);try{await onSave('plan.schedule',{...body,confirmed:true})}finally{setSaving(false)}}}><p className="help-text">仅登记未来预算与备款，不扣现金，不减少贷款本金。金额与银行最终扣款存在差异时，再按实际本金和利息记账。</p><fieldset disabled={state.viewer?.canWrite===false||saving} className="contextual-fields"><div className="form-grid"><Input name="name" label="未来还款计划名称"/><Input name="date" label="预计还款日期" type="date" value={today()}/><Input name="budget" label="预计总付款 CNY"/><label className="field">关联贷款（可选）<select name="loanId" defaultValue=""><option value="">暂不关联</option>{state.accounts.filter((account:any)=>account.kind==='LIABILITY'&&!account.archived&&account.currency==='CNY').map((account:any)=><option value={account.id} key={account.id}>{accountDisplay(state,account)}</option>)}</select></label><Input name="principal" label="预计本金 CNY（可空）" required={false}/><Input name="interest" label="预计利息 CNY（可空）" required={false}/></div><div className="recurring-rule-footer"><label className="help-text"><input type="checkbox" required/>我确认这是未来预算，尚未发生实际付款</label><button className="btn primary">{saving?'正在保存…':'保存未来还款预算'}</button></div></fieldset></form>;
}
