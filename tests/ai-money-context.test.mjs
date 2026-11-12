import test from 'node:test';import assert from 'node:assert/strict';
import * as context from '../src/server/financial-context.ts';
import {financialTools} from '../src/server/financial-tools.ts';
import {snapshot} from '../src/server/finance-store.ts';import {openTestDatabase} from './helpers/d1.mjs';
test('research and reviewed receipt amounts have major-unit names in the AI context',()=>{
 const receipt={kind:'travel',totalMinor:250000,items:[{id:'hotel',name:'模拟住宿',amount:60000,quantity:'2',unitPrice:'300.00',selected:true}],itinerary:[]};
 const research={title:'模拟旅行',budget:230000,expenseDraft:receipt,content:'模拟研究，仅为测试'};const original=JSON.stringify(research);
 const draft=context.expenseDraftForAI(receipt),proposal=context.researchContextForAI(research);
 assert.equal(draft.totalYuan,'2500.00');assert.equal(draft.items[0].amountYuan,'600.00');assert.equal(draft.items[0].unitPrice,'300.00');assert.equal('totalMinor' in draft,false);assert.equal('amount' in draft.items[0],false);
 assert.equal(proposal.budgetYuan,'2300.00');assert.equal('budget' in proposal,false);assert.equal(proposal.expenseDraft.totalYuan,'2500.00');assert.equal(JSON.stringify(research),original);
});
test('model savings goal is four million yuan, never 400 million unsuffixed minor units',async t=>{
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());const s=await snapshot(db),value=await financialTools(db,s).get_savings_goals();
 assert.equal(value.amount_unit,'CNY_yuan');assert.equal(value.goals[0].totalTargetYuan,'4000000.00');assert.equal(value.goals[0].bucketTargetsYuan.stock,'1000000.00');assert.equal(Object.hasOwn(value.goals[0],'totalTarget'),false);
});
test('known future salary is supplied as monthly planning income, never credited as cash',async t=>{
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());const s=await snapshot(db);s.accounts=[{id:'bank',kind:'ASSET',category:'cash',currency:'CNY',balance:5753202,metadata:{}}];s.documents=[['salary',2300000,'2026-12-10'],['provident',336000,'2026-11-15']].map(([id,amount,start])=>({id,kind:'recurring_rule',payload:{name:id,type:'income',accountId:'bank',amount,start,day:10,confirmedAt:'2026-11-12',paused:false}}));
 const c=await context.getFinancialContext(db,s,'2026-11-12');assert.equal(c.values.monthlyIncome,null);assert.equal(c.planningInputs.monthlyIncome,'26360.00');assert.match(c.sources.planningIncome,/预计|计划/);
 const ai=context.financialContextForAI(c);assert.equal(ai.amount_unit,'CNY_yuan');assert.equal(ai.monthlyPlanningIncomeYuan,'26360.00');assert.equal(ai.plannedRecurring[0].amountYuan,'23000.00');assert.equal(Object.hasOwn(ai,'values'),false);assert.equal(s.accounts[0].balance,5753202);
});
test('AI inputs and cash metrics label every yuan amount without ambiguous raw numbers',()=>{
 const ai=context.advisorAmountsForAI({inputs:{question:'旅行',budgetMinor:290000,monthlyIncome:2636000,livingExpense:null,emergencyReserve:null,monthlyLoan:952800},metrics:{cash:5753202,otherPlans:18000000,freeAfter:-13420598}});
 assert.equal(ai.inputs.monthlyIncome,'26360.00');assert.equal(ai.inputs.monthlyLoan,'9528.00');assert.equal(ai.metrics.cash,'57532.02');assert.equal(ai.metrics.otherPlans,'180000.00');assert.equal(ai.amount_unit,'CNY_yuan');
});
test('asset review keeps original currency labels while formatting only numeric metrics',()=>{
 const ai=context.advisorAmountsForAI({inputs:{asset:{currency:'USD',amountMinor:12345}},metrics:{cash:0,registeredAmount:12345,registeredCurrency:'USD'}});
 assert.equal(ai.metrics.registeredAmount,'123.45');assert.equal(ai.metrics.registeredCurrency,'USD');assert.equal(ai.inputs.asset.amountMinor,12345);
});
test('monthly planning never adds mutually exclusive current and replacement salary schedules',async t=>{
 const {db,sqlite}=openTestDatabase();t.after(()=>sqlite.close());const s=await snapshot(db);s.accounts=[{id:'bank',kind:'ASSET',category:'cash',currency:'CNY',balance:10000,metadata:{}}];
 s.documents=[['old',2300000,'2026-01-01','2026-11-30'],['new',2500000,'2026-12-01',null]].map(([id,amount,start,end])=>({id,kind:'recurring_rule',payload:{name:id,type:'income',accountId:'bank',amount,start,end,day:10,confirmedAt:'2026-11-12',paused:false}}));
 const c=await context.getFinancialContext(db,s,'2026-11-12');assert.equal(c.values.monthlyIncome,2300000);assert.equal(c.planningInputs.monthlyIncome,'25000.00');assert.equal(c.planningMonth,'2026-12');assert.match(c.sources.planningIncome,/2026-12/);
 s.documents=s.documents.filter(d=>d.id==='old');assert.equal((await context.getFinancialContext(db,s,'2026-11-12')).planningInputs.monthlyIncome,'');
});
