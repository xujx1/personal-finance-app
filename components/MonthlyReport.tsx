"use client";
import {useState} from 'react';
import {buildMonthlyReport} from '../src/domain/monthly-report.mjs';
import './MonthlyReport.css';
import {MonthlySummary} from './ExternalReviews';

const currentMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date());
const formattedAmount=(value:unknown)=>{
 if(typeof value!=='number'||!Number.isSafeInteger(value))return '未知';
 const minor=BigInt(value),absolute=minor<0n?-minor:minor;
 return (minor<0n?'-':'')+(absolute/100n).toLocaleString('zh-CN')+'.'+String(absolute%100n).padStart(2,'0');
};

const amount=(value:unknown)=><span className="money">{formattedAmount(value)}</span>;

export default function MonthlyReport({state,onSave}:{state:any;onSave?:any}){
 const [month,setMonth]=useState(currentMonth),report=buildMonthlyReport(state,month);
 return <section className="card section-space monthly-report" aria-label="月度报告">
  <div className="monthly-report-heading"><div><h2>月度报告</h2><p className="help-text">本站现金流水与资产、负债和净资产的账面增减。</p></div><label className="field">月份<input aria-label="月份" type="month" value={month} onChange={event=>setMonth(event.target.value)}/></label></div>
  <MonthlySummary state={state} month={month} onSave={onSave}/>
  <p className="help-text">{report.basisNote}</p>
  {!report.available?<p className="notice neutral" role="status">{report.reason}</p>:report.currencies.map((currency:any)=><section className="monthly-report-currency" key={currency.currency} aria-label={currency.currency+'月报'}>
   <h3>{currency.currency} 原币月报</h3>
   <p className="help-text">各币种独立核对，不用今天汇率倒算历史，也不合并成虚构的人民币总额。已归档账户的历史分录仍保留。</p>
   {!currency.hasRecordedHistory?<p className="notice neutral">该月及之前本站暂无已入账记录，真实期初余额未知；不能据此断言资产、负债或消费为零。</p>:<>
    {!currency.hasPriorRecordedHistory&&<p className="notice neutral">本月是该币种在本站的首个记账月。表中期初为本站分录起算值，真实历史期初余额未知；本月开账登记不视为赚到的收益。</p>}
    {!currency.hasMonthRecords&&<p className="notice neutral">本月暂无新增分录；期初与期末按本站前期已入账余额结转，不代表已经核对银行对账单。</p>}
    <div className="monthly-report-metrics">
     <div className="card metric"><small>业务现金流入</small><strong>{currency.currency} {amount(currency.businessCashInflowMinor)}</strong></div>
     <div className="card metric"><small>业务现金流出</small><strong>{currency.currency} {amount(currency.businessCashOutflowMinor)}</strong></div>
     <div className="card metric"><small>业务现金净流量</small><strong>{currency.currency} {amount(currency.businessCashNetMinor)}</strong></div>
     <div className="card metric"><small>资产账面增减</small><strong>{currency.currency} {amount(currency.assetChangeMinor)}</strong></div>
     <div className="card metric"><small>负债账面增减</small><strong>{currency.currency} {amount(currency.liabilityChangeMinor)}</strong></div>
     <div className="card metric"><small>净资产账面增减</small><strong>{currency.currency} {amount(currency.netWorthChangeMinor)}</strong></div>
    </div>
    <p className="help-text">业务现金流量剔除开账、余额校正和内部转账；资产买卖、预付款、实际还贷及退款仍按真实现金分录列示，不能全称为收入或消费。资产增减包含新登记、现金收入、消费、资产转换和校正；净资产增减＝资产增减－负债增减，不代表投资利润。</p>
    <h4>期初与期末账面余额</h4>
    <div className="monthly-report-table"><table aria-label={currency.currency+'资产负债月度变动'}><thead><tr><th>项目</th><th>期初账面</th><th>期末账面</th><th>本月增减</th></tr></thead><tbody>{[
     ['资产',currency.openingAssetsMinor,currency.closingAssetsMinor,currency.assetChangeMinor],
     ['负债',currency.openingLiabilitiesMinor,currency.closingLiabilitiesMinor,currency.liabilityChangeMinor],
     ['净资产',currency.openingNetWorthMinor,currency.closingNetWorthMinor,currency.netWorthChangeMinor]
    ].map(([label,opening,closing,change])=><tr key={String(label)}><th>{String(label)}</th><td>{amount(opening)}</td><td>{amount(closing)}</td><td>{amount(change)}</td></tr>)}</tbody></table></div>
    <h4>现金变动核对</h4>
    <p className="help-text">期初现金 {amount(currency.openingCashMinor)} ＋ 业务净流量 {amount(currency.businessCashNetMinor)} ＋ 开账/校正现金变动 {amount(currency.openingCorrectionCashMinor)} ＋ 内部转账净变动 {amount(currency.transferCashMinor)} ＝ 期末现金 {amount(currency.closingCashMinor)}（{currency.currency}）。</p>
    <p className="help-text">分录已确认收入 {amount(currency.journalIncomeMinor)}；分录已确认费用 {amount(currency.journalExpenseMinor)}。确认收入/费用与现金流不是同一口径：预付款转消费可能产生费用而不再扣现金，贷款还本降低负债而不计费用。</p>
    <h4>本月分录事项汇总</h4>
    {currency.activities.length===0?<p className="help-text">本月无新增事项。</p>:<div className="monthly-report-table"><table aria-label={currency.currency+'本月分录事项'}><thead><tr><th>事项</th><th>现金流入</th><th>现金流出</th><th>资产变动</th><th>负债变动</th><th>净资产变动</th><th>已确认收入</th><th>已确认费用</th></tr></thead><tbody>{currency.activities.map((activity:any)=><tr key={activity.kind}><td>{activity.label}</td><td>{amount(activity.cashInflowMinor)}</td><td>{amount(activity.cashOutflowMinor)}</td><td>{amount(activity.assetChangeMinor)}</td><td>{amount(activity.liabilityChangeMinor)}</td><td>{amount(activity.netWorthChangeMinor)}</td><td>{amount(activity.journalIncomeMinor)}</td><td>{amount(activity.journalExpenseMinor)}</td></tr>)}</tbody></table></div>}
    <p className="help-text">事项表保留开账/校正与转账两端流向，便于核对；不会把内部转账两端重复计入上方业务收支。来源为当前账本全部已过账分录，不受最近300条流水列表限制。</p>
   </>}
  </section>)}
 </section>;
}
