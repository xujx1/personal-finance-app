import {minor,decimal} from './finance.mjs';
export function securityTradeImpact(amount,fee,bankBalance,clearing){
 const gross=minor(amount),fees=minor(fee);
 if(gross<=0||clearing&&fees>gross)throw Error('成交额必须大于0，卖出手续费不能超过成交额');
 const delta=clearing?gross-fees:-gross-fees,after=bankBalance==null?null:bankBalance+delta;
 // Validate combined amounts as well as each input before the UI formats them.
 decimal(delta);if(after!==null)decimal(after);
 return {delta,after};
}
