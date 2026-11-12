import test from 'node:test';
import assert from 'node:assert/strict';
import {redactFinancialText} from '../src/domain/financial-privacy.mjs';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),cache=new Map();
async function componentUrl(url){
 if(cache.has(url.href))return cache.get(url.href);
 let source=(await readFile(url,'utf8')).replace(/import\s+['"][^'"]+\.css['"];?/g,'');
 for(const match of [...source.matchAll(/from\s+(['"])(\.[^'"]+)\1/g)]){const target=new URL(match[2],url),href=/\.(mjs|js)$/.test(target.pathname)?target.href:await componentUrl(new URL(target.href+'.tsx'));source=source.replace(match[0],`from '${href}'`);}
 let code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 code=code.replace(/from ["'](react(?:\/jsx-runtime)?)["']/g,(_,name)=>`from '${new URL('file://'+require.resolve(name)).href}'`);
 const result='data:text/javascript;base64,'+Buffer.from(code).toString('base64');cache.set(url.href,result);return result;
}
const component=path=>componentUrl(new URL(path,import.meta.url)).then(url=>import(url));

test('financial prose masks amounts, holdings and percentages while preserving dates and ordinary titles',()=>{
 for(const value of ['余额12345.67元','本金 18万元，利息260.91元','持仓25股，收益率-2.5%','USD 123.45','银行现金 57532.02 CNY','月供1500，数量123.456份','**预算**：300','**¥ 123.45**','单价：**456.78** 元'])assert.doesNotMatch(redactFinancialText(value),/12345|260.91|25股|2.5%|123.45|57532|1500|123.456|300|456.78/);
 for(const value of ['2026-11-12 · 家庭旅行','2026年11月报告','纳斯达克100指数','查看预算与大型支出','报价来源与缓存详情','计划11月14日出发，2位成人'])assert.equal(redactFinancialText(value),value);
});

test('default hidden values omit sensitive children and aria labels while explicit reveal restores them',async()=>{
 const {FinancialPrivacyProvider:Provider,SensitiveValue:Value,SensitiveText:Text,PrivacyEditNotice:Notice}=await component('../components/FinancialPrivacy.tsx');
 const values=()=>h('section',null,h('h2',null,'2026年11月报告'),h(Value,null,h('span',{'aria-label':'资产12345.67'},'12345.67')),h(Text,null,'预算 ',12345.67,'元；2026-11-12'),h('input',{defaultValue:'12345.67','aria-label':'核对金额'}),h(Notice));
 const hidden=renderToStaticMarkup(values());
 assert.doesNotMatch(hidden,/aria-label="资产12345.67"|>12345.67</);assert.match(hidden,/预算 ••••元；2026-11-12/);assert.match(hidden,/value="12345.67"/);assert.match(hidden,/输入框仍显示原值/);
 const shown=renderToStaticMarkup(h(Provider,{hidden:false},values()));assert.match(shown,/aria-label="资产12345.67"/);assert.match(shown,/预算 12345.67元/);assert.doesNotMatch(shown,/输入框仍显示原值/);
});

test('positions default hidden values preserve holding names, dates and quote source without quantities or prices',async()=>{
 const {Positions}=await component('../components/PlanningPanels.tsx');
 const html=renderToStaticMarkup(h(Positions,{state:{accounts:[{id:'stock',name:'隐私样本股票',category:'stock',kind:'ASSET',currency:'CNY',balance:2484649,metadata:{quantity:'37',cost:'123.45',price:'671.53',market:'CN',code:'600000',asOf:'2026-11-12'}}]},quotes:{stock:{price:'701.23',currency:'CNY',source:'公开样本报价来源',asOf:'2026-11-12'}},fx:null,onRefresh(){}}));
 for(const value of ['隐私样本股票','2026-11-12','公开样本报价来源','检查基金 / 美股报价'])assert.ok(html.includes(value));
 assert.doesNotMatch(html,/123\.45|671\.53|701\.23|>37</);assert.match(html,/财务数值已隐藏/);
});

test('rich research text redacts markdown financial values before inline markup separates their context',async()=>{
 const {RichText}=await component('../components/AssistantPresentation.tsx');
 const html=renderToStaticMarkup(h(RichText,{text:'# 2026年11月研究\n**预算**：300\n**持仓**：37份，单价**123.45**元\n2026-11-12核对，不执行交易。'}));
 assert.doesNotMatch(html,/300|37份|123\.45/);assert.match(html,/2026年11月研究/);assert.match(html,/2026-11-12核对/);assert.match(html,/预算/);
});
