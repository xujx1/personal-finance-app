import {MAX_MINOR,decimal} from './finance.mjs';
const known=value=>Number.isSafeInteger(value)&&Math.abs(value)<=MAX_MINOR;
const money=value=>known(value)?decimal(value)+'元':'待核实';
/** Canonical internal metrics use integer CNY cents; model prose is never a numeric fallback. */
export function spendingCalculationSummary(advice){
 if(advice?.intent==='asset')return String(advice.summary??'');
 const metrics=advice?.metrics??{},inputs=advice?.inputs??{};
 const parts=[
  '账本资金核算（仅已知人民币项目）：银行现金'+money(metrics.cash),
  '其他计划待备款'+money(metrics.otherPlans),
  '本计划总预算'+money(inputs.budgetMinor)+'，尚需现金'+money(metrics.proposedRemaining),
  '一期贷款月供'+money(metrics.loanMonthly),
  '扣除上述已知项目后的现金余额'+money(metrics.cashAfter),
  known(inputs.emergencyReserve)?'应急保留'+money(inputs.emergencyReserve)+'后余额'+money(metrics.freeAfter):'应急保留待核实，未额外推定应急金；当前已知项目余额'+money(metrics.freeAfter)
 ];
 if(known(metrics.freeAfter)&&metrics.freeAfter<0)parts.push('存在资金缺口'+money(-metrics.freeAfter));
 else if(known(metrics.cashAfter)&&metrics.cashAfter<0)parts.push('存在已知现金缺口'+money(-metrics.cashAfter));
 if(known(metrics.monthlySurplus))parts.push('已核实的月度收支情景结余'+money(metrics.monthlySurplus));
 return parts.join('；')+'。这是静态资金测算，不把未来收入、证券、房产或赎回中资金计入当前可用人民币现金；未确认的资料仍需核实，确认预算不付款。';
}
export function spendingCalculationRisks(advice){
 if(advice?.intent==='asset')return [...(advice.risk_reasons??[])];
 const metrics=advice?.metrics??{},inputs=advice?.inputs??{},risks=[];
 const balance=known(metrics.freeAfter)?metrics.freeAfter:known(metrics.cashAfter)?metrics.cashAfter:null;
 if(balance!==null&&balance<0)risks.push('按当前已知现金与预算，资金缺口为'+money(-balance)+'；存在未核实支出时缺口还可能扩大，不能认定资金充足。');
 if(known(metrics.monthlySurplus)&&metrics.monthlySurplus<0)risks.push('已核实的月度收入减生活费和贷款月供后为'+money(metrics.monthlySurplus)+'，存在月度收支缺口。');
 if(!['cash','otherPlans','proposedRemaining','cashAfter','freeAfter'].every(key=>known(metrics[key]))||!known(inputs.budgetMinor))risks.push('部分资金测算指标待核实；未依据模型正文猜测现金、预算或可支出额度。');
 if(!known(metrics.loanMonthly))risks.push('贷款月供待核实，不能把未知月供当成已确认的零支出。');
 if(!known(inputs.emergencyReserve))risks.push('应急保留金额待核实，当前已知项目余额不代表可放心使用的资金。');
 return risks;
}
