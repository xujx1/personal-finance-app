"use client";
type Props={calculation:any};
export default function InvestmentCalculation({calculation:c}:Props){
 const negative=c.cashflowRisk?.months?.find((month:any)=>month.negative===true),targets=new Set(c.orders.filter((order:any)=>order.side==='buy').map((order:any)=>order.symbol));
 return <section className="investment-calculation" aria-label="服务器投资情景测算">
  <div className="card-title"><h3>换仓情景 · 服务器逐项核算</h3><span className="badge gray">USD 美元 · 只读假设</span></div>
  <p className="help-text">金额均为美元元额，单价为美元／股。统一采用以下同一组报价，未执行任何买卖。</p>
  {c.status==='complete'?<>
   <div className="investment-calculation-metrics"><div><small>卖出预计所得</small><strong>{c.sellProceeds}</strong></div><div><small>买入预计所需</small><strong>{c.buyCost}</strong></div><div><small>未计费用的差额</small><strong>{c.grossFundingGap}</strong></div></div>
   <p className="investment-calculation-gap">账内可用美元现金 <strong>{c.availableCash}</strong>；未计费用仍需补足 <strong>USD {c.additionalCashRequiredBeforeFees}</strong>。</p>
  </>:<div className="notice neutral"><strong>交易情景资料不完整</strong><ul>{c.missing.map((item:string,index:number)=><li key={index}>{item}</li>)}</ul></div>}
  <p className="investment-fee-note"><strong>手续费、税费、交易点差与汇兑成本：未知。</strong>费用未包含在差额内，不能当成最终下单金额。人民币基金及赎回中金额未计入可用美元现金。</p>
  {c.orders.length>0&&<div className="table-wrap"><table aria-label="投资情景报价与金额"><thead><tr><th>假设操作</th><th>股数</th><th>单价 USD</th><th>金额 USD</th><th>来源与原报价时间</th></tr></thead><tbody>{c.orders.map((order:any,index:number)=><tr key={index}><td>{order.side==='sell'?'卖出':'买入'} {order.symbol}</td><td>{order.quantity}</td><td>{order.unitPrice??'未取得'}</td><td>{order.amount??'未核算'}</td><td>{order.quote?<>{order.quote.source}<small>{order.quote.asOf} · {order.quote.status??'参考快照'}</small></>:'来源或报价未核实'}</td></tr>)}</tbody></table></div>}
  {c.portfolio&&<><p>本组美元证券按同一报价计算的市值：<strong>{c.portfolio.beforeValue} → {c.portfolio.afterValue} USD</strong>。变更后市值以补足所需差额为前提。</p>{c.portfolio.positions.filter((position:any)=>targets.has(position.symbol)).map((position:any)=><p className="investment-concentration" key={position.symbol}><strong>{position.symbol}</strong> 股数 {position.beforeQuantity} → {position.afterQuantity}；本组美元证券持仓占比 <strong>{position.beforeWeightPercent}% → {position.afterWeightPercent}%</strong></p>)}<details className="assistant-details"><summary>查看全部美元证券的同价仓位</summary><div className="table-wrap"><table><thead><tr><th>证券</th><th>前／后股数</th><th>前／后市值 USD</th><th>前／后占比</th></tr></thead><tbody>{c.portfolio.positions.map((position:any)=><tr key={position.symbol}><td>{position.symbol}</td><td>{position.beforeQuantity} / {position.afterQuantity}</td><td>{position.beforeValue} / {position.afterValue}</td><td>{position.beforeWeightPercent}% / {position.afterWeightPercent}%</td></tr>)}</tbody></table></div></details></>}
  {c.cashflowRisk&&<div className={'notice '+(negative?'':'neutral')}><strong>{negative?'人民币现金预测存在备款缺口':'人民币备款与现金预测'}</strong><p>当前人民币银行现金 {c.cashflowRisk.startingCashYuan} 元；当前预算备款缺口 {c.cashflowRisk.currentFundingGapYuan} 元。</p>{negative&&<p><strong>{negative.month} 月底预计现金 {negative.closingCashYuan} 元。</strong>提前还款备款存在缺口，不能据此认定资金充足；未来周期收入为预计安排。</p>}</div>}
  {c.warnings?.length>0&&<ul className="help-text">{c.warnings.map((warning:string,index:number)=><li key={index}>{warning}</li>)}</ul>}
 </section>;
}
