const number='[+-]?\\d[\\d,]*(?:\\.\\d+)?';
const markup='[\\s*_`]*';
const financialNumber=new RegExp('(?:[¥￥$]'+markup+'|(?:CNY|USD|HKD|RMB)'+markup+')'+number+'|'+number+markup+'(?:万?元|万元|亿元|美元|港元|CNY|USD|HKD|RMB|股|份|%|％)|(?:余额|本金|利息|月供|总额|预算|收益|成本|净值|单价|数量|金额|现金|实付|预付|付款|消费|备款|差额|资金缺口|已缴|投资本金)'+markup+'[:：]?'+markup+'[¥￥$]?'+markup+number,'gi');
export function redactFinancialText(value){return String(value??'').replace(financialNumber,match=>match.replace(new RegExp(number,'g'),'••••'));}
