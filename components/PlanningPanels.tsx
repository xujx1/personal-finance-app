"use client";
import {useState,FormEvent} from 'react';
import {annualForecast,compareMortgageScenarios,loanSimulationDefaults} from '../src/domain/planning.mjs';
import {minor,decimal,convert} from '../src/domain/finance.mjs';
import {positionValue,reconcilePositionSnapshot} from '../src/domain/market.mjs';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export function ForecastPanel({state}:any){
 const [months,setMonths]=useState(12);
 const f=annualForecast(state,today(),months);
 return <>
  <section className="card section-space"><div className="card-title"><h2>未来现金流与年度支出</h2><select aria-label="预测月份" value={months} onChange={event=>setMonths(Number(event.target.value))}>{[3,6,12].map(value=><option key={value} value={value}>{value}个月</option>)}</select></div><p className="help-text">从当前可用人民币银行现金出发，加入周期收入，扣除周期支出和未来计划尚需现金；证券、房产及定期存款不作为可花现金。预留与已付预付款不重复扣除，未批准预算保守纳入并单列风险。未设置规则的生活开支和收入未纳入，预测不是保证。</p><div className="table-wrap"><table><thead><tr><th>月份</th><th>预计收入</th><th>周期支出</th><th>大型支出尚需</th><th>待家庭审批风险</th><th>预计期末现金</th></tr></thead><tbody>{f.map((row:any)=><tr key={row.month}><td>{row.month}{row.unknown>0?' · 有未知预算':''}</td><td>¥{decimal(row.income)}</td><td>¥{decimal(row.fixed)}</td><td>¥{decimal(row.planned)}</td><td>{row.pending>0?'¥'+decimal(row.pending):'—'}</td><td className={row.negative?'negative':''}>¥{decimal(row.closing)}{row.negative?' · 资金缺口':''}</td></tr>)}</tbody></table></div></section>
 </>;
}

export function LoanSimulator({state,asset}:any){
 const loans=(state?.accounts??[]).filter((loan:any)=>loan.kind==='LIABILITY'&&!loan.archived&&loan.currency==='CNY'&&(!asset||loan.id===asset.id));
 const [loanId,setLoanId]=useState(loans[0]?.id??''),[fields,setFields]=useState(()=>loanSimulationDefaults(loans[0])),[result,setResult]=useState<any>(null),[error,setError]=useState('');
 const selected=loans.find((loan:any)=>loan.id===loanId),recorded=loanSimulationDefaults(selected);
 const changeLoan=(id:string)=>{setLoanId(id);setFields(loanSimulationDefaults(loans.find((loan:any)=>loan.id===id)));setResult(null);setError('');};
 return <section className="card section-space"><h2>提前还贷情景测算</h2>
  <p className="help-text">资料核实日期：{recorded.asOf||'未记录'} · 重定价日期：{recorded.repricingDate||'未记录'} · 到期日期：{recorded.maturityDate||'未记录'} · 扣款日：{recorded.day?'每月'+recorded.day+'日':'未记录'}。这些记录不代表已发生扣款。</p>
  <form onSubmit={(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setError('');try{
   const body=Object.fromEntries(new FormData(event.currentTarget));if(!selected)throw Error('请选择人民币贷款');
   const payment=fields.monthly?minor(fields.monthly):null,input={principal:selected.balance,rate:fields.rate,months:Number(fields.months)};
   setResult(compareMortgageScenarios({...input,payment,prepayment:minor(String(body.prepayment)),mode:String(body.mode)}));
  }catch(error){setResult(null);setError(error instanceof Error?error.message:'测算参数无效');}}}>
   <div className="form-grid">
    <label className="field">贷款<select aria-label="贷款" name="loanId" value={loanId} disabled={Boolean(asset)} required onChange={event=>changeLoan(event.target.value)}><option value="">请选择贷款</option>{loans.map((loan:any)=><option key={loan.id} value={loan.id}>{loan.name} · 本金¥{decimal(loan.balance)}</option>)}</select></label>
    <label className="field">年利率 %<input aria-label="年利率 %" name="rate" required value={fields.rate} placeholder="未记录时按银行资料填写" onChange={event=>setFields({...fields,rate:event.target.value})}/></label>
    <label className="field">核对月供 CNY<input aria-label="核对月供 CNY" name="payment" value={fields.monthly} placeholder="未记录；留空按等额本息估算" onChange={event=>setFields({...fields,monthly:event.target.value})}/></label>
    <label className="field">剩余期数（月）<input aria-label="剩余期数（月）" name="months" type="number" min="1" max="600" required value={fields.months} onChange={event=>setFields({...fields,months:event.target.value})}/></label>
    <label className="field">拟归还本金 CNY<input name="prepayment" required defaultValue="0.00"/></label>
    <label className="field">还款方式<select aria-label="还款方式" name="mode"><option value="reduce_payment">期限不变，减少月供</option><option value="reduce_term">月供基本不变，缩短期限</option></select></label>
   </div>
   <p className="help-text">账本利率：{recorded.rate?recorded.rate+'%':'未记录'}；账本月供：{recorded.monthly?'¥'+recorded.monthly:'未记录'}；剩余期数：{recorded.months||'未记录，请按银行账单填写'}。到期日不会自动推定剩余期数。填写月供用于缩期比较；降月供比较双方均按填写期数计算。修改以上参数仅用于本次模拟，不更新真实贷款。</p>
   <button className="btn primary section-space">仅模拟，不修改贷款</button>
  </form>
  {error&&<p className="notice" role="alert">{error}</p>}
  {result&&<><p className="notice neutral">基准月供约¥{decimal(result.base.payment)} / {result.base.months}期；情景月供约¥{decimal(result.scenario.payment)} / {result.scenario.months}期。预计利息差（基准减情景）¥{decimal(result.base.interest-result.scenario.interest)}。{result.mode==='reduce_payment'?'降月供模式：基准与情景均按填写期数计算等额本息月供；账本月供仅作参考。':result.usedMonthly?'缩期模式：基准与情景均使用填写的相同月供。':'缩期模式未填写月供；基准与情景均使用同一估算月供。'}{result.scenario.disclaimer}</p><details><summary>测算还款计划</summary><div className="table-wrap"><table><thead><tr><th>期数</th><th>本金</th><th>利息</th><th>剩余本金</th></tr></thead><tbody>{result.scenario.rows.map((row:any)=><tr key={row.month}><td>{row.month}</td><td>{decimal(row.principal)}</td><td>{decimal(row.interest)}</td><td>{decimal(row.balance)}</td></tr>)}</tbody></table></div></details></>}
 </section>;
}
export function Positions({state,quotes,fx,onRefresh,asset}:any){
 const holdings=(state?.accounts??[]).filter((account:any)=>['fund','stock'].includes(account.category)&&!account.archived&&(!asset||account.id===asset.id));
 const cny=(value:number|null,currency:string|null)=>{if(value===null)return null;if(currency==='CNY')return value;if(currency!=='USD'||typeof fx?.rate!=='string')return null;try{return convert(value,fx.rate);}catch{return null;}};
 const original=(value:number|null,currency:string|null)=>value===null?'未核实':(currency??'币种未核实')+' '+decimal(value);
 const display=(value:number|null,currency:string|null)=>{const converted=cny(value,currency);return <>{converted===null?'CNY 待核实':'¥'+decimal(converted)}<small>原币 {original(value,currency)}</small></>;};
 return <section className="card section-space">
  <div className="card-title"><h2>持仓成本与当前报价</h2><button className="btn" onClick={onRefresh}>检查基金 / 美股报价</button></div>
  <p className="help-text">登记快照保留本人录入金额；快照对账仅比较存储数量×存储单价与登记金额，不拿新报价变动冒充旧快照差异。参考市值不是可用现金；查看与核对不修改资产或现金。</p>
  <p className="help-text">总成本按存储数量×单位成本一次精确计算，不先把单位价格舍入到分。行情按日缓存，手动刷新也遵守当日缓存；下方保留原始报价时间。公共行情不保证实时，基金公布净值与盘中估值分别标注。{fx?.rate?'CNY折算参考：1 USD = '+fx.rate+' CNY；来源 '+(typeof fx.source==='string'?fx.source:'未核实')+'；日期 '+(typeof fx.date==='string'?fx.date:typeof fx.asOf==='string'?fx.asOf:'未核实')+'；状态 '+(typeof fx.status==='string'?fx.status:'未提供'):'缺少可核验汇率时保留原币，不补零折算。'}</p>
  <div className="table-wrap" style={{overflowX:'auto'}}><table className="positions-table"><thead><tr><th>持仓 / 代码 / 市场</th><th>存储数量</th><th>单位成本 / 总成本</th><th>登记快照金额</th><th>存储数量×单价</th><th>快照对账</th><th>当前报价 / 净值</th><th>参考市值 / 浮动差额</th><th>报价来源与时间</th></tr></thead><tbody>{holdings.map((account:any)=>{
   const snapshot=reconcilePositionSnapshot(account),quote=quotes?.[account.id],rawPrice=quote?.price;
   const validQuote=typeof rawPrice==='string'&&rawPrice.length<=100&&/^\d+(\.\d{1,8})?$/.test(rawPrice)&&Number(rawPrice)>0;
   const sameCurrency=typeof quote?.currency==='string'&&quote.currency===snapshot.currency;
   let quoteUnit:number|null=null,referenceValue:number|null=null;
   if(validQuote&&sameCurrency){try{quoteUnit=positionValue('1',rawPrice);if(snapshot.quantity!==null)referenceValue=positionValue(snapshot.quantity,rawPrice);}catch{}}
   const difference=referenceValue!==null&&snapshot.totalCostMinor!==null?referenceValue-snapshot.totalCostMinor:null;
   const source=typeof quote?.source==='string'?quote.source:'尚未取得有效来源',quoteDate=typeof quote?.asOf==='string'?quote.asOf:'日期未核实';
   return <tr key={account.id}>
    <td>{account.name}<small>{account.metadata?.code||'代码待完善'} · {snapshot.currency??'原币未核实'}</small><small>市场：{snapshot.market}</small></td>
    <td>{snapshot.quantity??'未核实'}</td>
    <td>单位：{display(snapshot.unitCostMinor,snapshot.currency)}<small>存储原币单价 {snapshot.unitCost??'未核实'}</small><strong>总成本：{display(snapshot.totalCostMinor,snapshot.currency)}</strong></td>
    <td>{display(snapshot.registeredMinor,snapshot.currency)}<small>资料日期 {snapshot.asOf??'未核实'}</small></td>
    <td>{display(snapshot.calculatedSnapshotMinor,snapshot.currency)}<small>存储原币单价 {snapshot.storedPrice??'未核实'}</small></td>
    <td>{snapshot.status==='unknown'?<span>快照字段不足，待核实</span>:snapshot.status==='matched'?<span>快照金额一致</span>:<span className="negative">快照算术差异 {snapshot.discrepancyMinor!>0?'+':''}{original(snapshot.discrepancyMinor,snapshot.currency)}</span>}<small>存储数量×存储单价 − 登记快照</small>{snapshot.status==='discrepancy'&&<small>保留两项原值，待本人核对；未自动调账</small>}</td>
    <td>{validQuote&&sameCurrency?display(quoteUnit,snapshot.currency):'未取得可比报价'}<small>报价原币 {validQuote?String(quote.currency??'未核实')+' '+rawPrice:'未取得'}</small>{validQuote&&!sameCurrency&&<small>报价币种与登记币种不一致，待核实</small>}{typeof quote?.estimate?.price==='string'&&<small>另有盘中估值 {quote.estimate.price} · {typeof quote.estimate.asOf==='string'?quote.estimate.asOf:'日期未核实'}；不是最终净值</small>}</td>
    <td>{display(referenceValue,snapshot.currency)}<small>参考浮动差额</small>{display(difference,snapshot.currency)}<small>按已录成本计算，不含未录费用</small></td>
    <td><strong>{quoteDate}</strong><details><summary>行情来源与缓存详情</summary>{source}<small>{quoteDate} · {typeof quote?.kind==='string'?quote.kind:'未联网'} · {typeof quote?.status==='string'?quote.status:'未取得'}</small><small>{typeof quote?.message==='string'?quote.message:typeof quote?.delay==='string'?quote.delay:'不称实时价格'}</small></details></td>
   </tr>;
  })}</tbody></table>{holdings.length===0&&<p className="help-text">暂无已登记基金或股票持仓。</p>}</div>
 </section>;
}
