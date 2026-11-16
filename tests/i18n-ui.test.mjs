import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import ts from 'typescript';
import {i18nFixture} from '../local/i18n-fixture.mjs';
import {getAssetTypes} from '../src/domain/asset-types.mjs';
import {englishMessages} from '../src/domain/i18n.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
let modulePromise;
async function renderer(){return modulePromise??=(async()=>{
 const modules={FinanceApp:'default',MemberSelect:'MemberSelect',MemberAccountFields:'MemberAccountFields',AssetTypeSelect:'AssetTypeSelect',SecurityTrade:'default',SavingsGoals:'default',GoalOverview:'default',LifeCalendar:'default',AnnualBudget:'default',PlanDetails:'default',MembershipEditor:'MembershipEditor',HouseholdSetupStart:'HouseholdSetupStart',ForecastPanel:'ForecastPanel',RecurringCashflow:'default',FamilyPanel:'default',ChatGPTEntry:'default',AssetTypeManager:'default',PensionAccount:'default',PensionInvestment:'default',PensionClassification:'default',SkillPanel:'default',ResearchRecords:'default',McpDraftInbox:'default',ExternalWorkflowDraftReview:'default',MonthlyReport:'default',ExpenseDraftEditor:'default',MembershipBenefits:'default',InvestmentFollowups:'default',Positions:'Positions',CurrencySwitch:'CurrencySwitch',DisplayCurrencyNotice:'DisplayCurrencyNotice',MonthlySummary:'MonthlySummary'};
 const fileFor={MemberSelect:'MemberControls',MemberAccountFields:'MemberControls',AssetTypeSelect:'AssetTypeControls',MembershipEditor:'MembershipBenefits',HouseholdSetupStart:'HouseholdSetup',ForecastPanel:'PlanningPanels',Positions:'PlanningPanels',AssetTypeManager:'AssetTypeControls',ResearchRecords:'ExternalReviews',CurrencySwitch:'I18n',DisplayCurrencyNotice:'I18n',MonthlySummary:'MonthlyReport'};
 const imports=Object.entries(modules).map(([name,exp])=>`import ${exp==='default'?name:'{'+exp+' as '+name+'}'} from './components/${fileFor[name]??name}';`).join('\n');
 const contents=`import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {I18nProvider,useI18n} from './components/I18n';import {FinancialPrivacyProvider} from './components/FinancialPrivacy';${imports}\nfunction CurrencyProbe(){const i=useI18n();return React.createElement('output',null,i.displayCurrency+'|'+i.displayMoney(710000)+'|'+i.money(710000,'CNY'))};const components={${Object.keys(modules).join(',')},CurrencyProbe};export function render(name,props,locale,settings={}){return renderToStaticMarkup(React.createElement(I18nProvider,{initialLocale:locale,...settings},React.createElement(FinancialPrivacyProvider,{hidden:!settings.showAmounts},React.createElement(components[name],props))))}`;
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'finance-i18n-')),outfile=path.join(dir,'render.mjs');
 try{await build({stdin:{contents,loader:'tsx',resolveDir:root},outfile,bundle:true,format:'esm',platform:'node',jsx:'automatic',loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});return await import(pathToFileURL(outfile).href)}finally{await fs.rm(dir,{recursive:true,force:true})}
 })();}
const plain=html=>html.replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ').replace(/\s+/g,' ').trim();

test('actual product components render both locales without mutating ledger records or form values',async t=>{
 const {render}=await renderer(),fixture=await i18nFixture(),state=fixture.state,before=JSON.stringify(state),noop=()=>{},plan={...state.documents.find(d=>d.kind==='plan').payload,id:'i18n-plan'};
 const pension={id:'pension',name:'模拟养老金',category:'other',kind:'ASSET',currency:'CNY',balance:15000,metadata:{asOf:fixture.day,ownerMemberId:'user:i18n-fixture',assetTypeId:'personal_pension',pension:{annualLimit:'12000',withdrawalAge:70,cashBalance:'50',contributions:[],holdings:[{id:'h1',name:'模拟养老产品',kind:'fund',assetTypeId:'fund',value:'100',cost:'90'}]}}};
 const cases=[['FinanceApp',{displayName:'模拟成员'}],['MemberSelect',{state}],['MemberAccountFields',{state,defaultMemberId:'user:i18n-fixture'}],['AssetTypeSelect',{state,category:'cash',value:'cash'}],['SecurityTrade',{state,onSave:noop,busy:false}],['SavingsGoals',{state,onSave:noop,valueCNY:a=>a.balance}],['GoalOverview',{state,valueCNY:a=>a.balance}],['LifeCalendar',{plans:[plan],onPlan:noop,onNew:noop}],['AnnualBudget',{state,onOpenPlan:noop}],['PlanDetails',{state,plan,onSave:noop,onBack:noop,onReview:noop}],['MembershipEditor',{state,record:null,onSave:noop,onClose:noop}],['HouseholdSetupStart',{state,onSave:noop}],['ForecastPanel',{state}],['RecurringCashflow',{state,onSave:noop}],['FamilyPanel',{joinOnly:true,loggedIn:false}],['ChatGPTEntry',{}],['AssetTypeManager',{state,onSave:noop,busy:false}],['PensionAccount',{state,asset:pension,onSave:noop,busy:false}],['PensionInvestment',{state,asset:pension,mode:'buy',onSave:noop,busy:false}],['PensionInvestment',{state,asset:pension,mode:'sell',onSave:noop,busy:false}],['PensionClassification',{state,asset:pension,holding:{name:'模拟养老产品',productKind:'fund',assetTypeId:'fund'},onSave:noop,busy:false}],['SkillPanel',{state,onSave:noop}],['ResearchRecords',{state,onSave:noop}],['McpDraftInbox',{state,onSave:noop}],['ExternalWorkflowDraftReview',{state,onSave:noop,document:{id:'draft',payload:{kind:'investment',payload:{title:'模拟研究',summary:'模拟结论',content:'模拟分析',sources:[],followUps:[],ownerMemberId:'family'}}}}],['MonthlyReport',{state,onSave:noop}],['ExpenseDraftEditor',{draft:{kind:'shopping',date:fixture.day,end:fixture.day,items:[],itinerary:[]},onChange:noop}],['MembershipBenefits',{state,onSave:noop}],['InvestmentFollowups',{state,onSave:noop,document:{id:'review',payload:{followUps:[]}}}],['Positions',{state,asset:state.accounts.find(a=>a.category==='fund'),quotes:{},fx:{},onRefresh:noop}]];
 for(const [name,props] of cases)await t.test(name,()=>{
  const zh=render(name,props,'zh-CN'),en=render(name,props,'en-US');assert.notEqual(en,zh,name+' must change its display language');
  // All input names, values and option values are business fields, except locale itself.
  const values=html=>[...html.matchAll(/<(?:input|option)\b[^>]*>/g)].map(m=>m[0]).filter(s=>!s.includes('lang=')).map(s=>[s.match(/name="([^"]*)"/)?.[1],s.match(/value="([^"]*)"/)?.[1]]);
  assert.deepEqual(values(en),values(zh),name+' must preserve form payload fields');
  const userTexts=['模拟成员','模拟美元账户','模拟基金','模拟住房贷款','模拟家庭旅行','模拟工资','我的中文储蓄目标','模拟午餐，保留中文原文','旅行备注保持原文','银行现金','我的家庭','模拟养老金','模拟养老产品','模拟研究','模拟结论','模拟分析'];
  let text=plain(en).replaceAll('文/A','');for(const x of userTexts)text=text.replaceAll(x,'');text=text.replaceAll('中文','LANGUAGE').replaceAll('模','');
  assert.doesNotMatch(text,/[\u3400-\u9fff]/,name+': '+text);
 });
 assert.equal(JSON.stringify(state),before,'rendering and locale changes must never rewrite saved data');
 const renamed={...state,documents:[{id:'types',kind:'asset_type_catalog',payload:{version:1,types:getAssetTypes(state).map(type=>type.id==='cash'?{...type,name:'财务总览'}:type)}},{id:'legacy-goal',kind:'savings_goal',payload:{schemaVersion:3,name:'旧目标',targets:[{scope:'type:cash',target:100000}],monthlyTarget:null}}]};
 assert.match(render('GoalOverview',{state:renamed,valueCNY:a=>a.balance},'en-US'),/财务总览/,'legacy selectable goals preserve a renamed built-in type');
 const englishSelect=render('AssetTypeSelect',{state,category:'cash',value:'cash'},'en-US');assert.match(englishSelect,/value="cash"/);assert.match(englishSelect,/Bank cash/);
 const account=render('MemberAccountFields',{state,defaultMemberId:'user:i18n-fixture'},'en-US');assert.match(account,/银行现金/,'a user account name equal to a UI label must remain original');
});

test('every reachable UI translation key exists and Chinese JSX text cannot bypass the locale layer',async()=>{
 const seen=new Set(),missing=[];
 async function check(file){if(seen.has(file))return;seen.add(file);const source=await fs.readFile(path.join(root,file),'utf8'),sf=ts.createSourceFile(file,source,99,true,4),imports=[];
 function walk(n){if(ts.isImportDeclaration(n)&&ts.isStringLiteral(n.moduleSpecifier)&&n.moduleSpecifier.text.startsWith('./'))imports.push(path.posix.join(path.posix.dirname(file),n.moduleSpecifier.text+'.tsx'));
 if(ts.isJsxText(n)&&/[\u3400-\u9fff]/.test(n.text)&&!(file==='components/I18n.tsx'&&['文/A','中文'].includes(n.text.trim())))missing.push(file+': raw JSX '+n.text.trim());
 if(ts.isCallExpression(n)){
 const name=n.expression.getText(sf),args=name==='heading'?[n.arguments[1],n.arguments[2]]:name==='metric'?[n.arguments[0],n.arguments[2]]:['field','openAssetTool'].includes(name)?[n.arguments[1]]:[];
 function checkLabel(arg){if(!arg)return;if(ts.isStringLiteral(arg)&&/[\u3400-\u9fff]/.test(arg.text)&&!Object.hasOwn(englishMessages,arg.text))missing.push(file+': dynamic label '+arg.text);if(ts.isConditionalExpression(arg)){checkLabel(arg.whenTrue);checkLabel(arg.whenFalse)}}
 args.forEach(checkLabel);
 }
 if(ts.isCallExpression(n)&&['tr','t'].includes(n.expression.getText(sf))&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])&&/[\u3400-\u9fff]/.test(n.arguments[0].text)&&!Object.hasOwn(englishMessages,n.arguments[0].text))missing.push(file+': '+n.arguments[0].text);ts.forEachChild(n,walk)}walk(sf);
 for(const f of imports){try{await fs.access(path.join(root,f))}catch{continue}await check(f)}
 }
 await check('components/FinanceApp.tsx');await check('components/FamilyPanel.tsx');assert.ok(seen.size>=40);assert.deepEqual(missing,[]);
});


test('real currency context converts display amounts while native forms and saved budgets stay in CNY',async()=>{
 const {render}=await renderer(),fixture=await i18nFixture(),state=fixture.state,settings={initialFx:{rate:'10',date:'2026-11-13',source:'Synthetic reference',status:'ok'},showAmounts:true},before=JSON.stringify(state);
 assert.match(render('CurrencyProbe',{},'en-US',settings),/USD\|≈ \$710\.00\|CN¥7,100\.00/);
 assert.match(render('CurrencyProbe',{},'zh-CN',{...settings,initialCurrencyMode:'USD'}),/USD\|≈ US\$710\.00/);
 assert.match(render('CurrencyProbe',{},'en-US',{...settings,initialCurrencyMode:'CNY'}),/CNY\|CN¥7,100\.00/);
 const usd=render('AnnualBudget',{state,onOpenPlan:()=>{}},'en-US',settings),cny=render('AnnualBudget',{state,onOpenPlan:()=>{}},'en-US',{...settings,initialCurrencyMode:'CNY'});
 assert.match(usd,/\$200\.00/);assert.match(cny,/CN¥2,000\.00/);assert.equal(JSON.stringify(state),before);
 const original=render('SecurityTrade',{state,onSave:()=>{},busy:false},'en-US',settings);assert.match(original,/CNY/);assert.match(original,/type="date"/);const nativeForm=render('SecurityTrade',{state,onSave:()=>{},busy:false},'en-US',{...settings,initialCurrencyMode:'CNY'});const controls=html=>html.match(/<(?:input|option)\b[^>]*>/g);assert.deepEqual(controls(original),controls(nativeForm),'changing display currency must preserve the entire native form');
 const stale=render('DisplayCurrencyNotice',{},'en-US',{...settings,initialFx:{...settings.initialFx,status:'stale'}});assert.match(stale,/Stale rate/);assert.match(stale,/2026-11-13/);assert.match(stale,/Synthetic reference/);
 assert.match(render('DisplayCurrencyNotice',{},'en-US'),/No valid exchange rate/);
 const document={...fixture.report,aiReview:{title:'模拟币种月报',summary:'原文金额 CNY 2000',sections:[],nextActions:[],limitations:[],stale:false}};const history=JSON.stringify(document),monthly=render('MonthlySummary',{document,archived:true},'en-US',settings);assert.match(monthly,/\$8\.80/);assert.match(monthly,/CN¥88\.00/,'original-currency transaction evidence must remain CNY');assert.match(monthly,/原文金额 CNY 2000/);assert.equal(JSON.stringify(document),history);
});
