import test from 'node:test';
import assert from 'node:assert/strict';
import {openTestDatabase} from './helpers/d1.mjs';
import {familyCommand,familyContext} from '../src/server/family-service.ts';
import {scopeDb} from '../src/server/ledger-scope.ts';
import {executeCommand,snapshot} from '../src/server/finance-store.ts';
import {createMcpHandler} from '../src/server/mcp-http.ts';
import {createFinanceHandlers} from '../src/server/finance-http.ts';
import {createSkillHandlers} from '../src/server/skill-http.ts';
import {createReviewHandlers} from '../src/server/review-http.ts';
import {getMonthlyContext} from '../src/server/mcp-queries.ts';
import {DEFAULT_SKILLS} from '../src/domain/skill-catalog.mjs';

const config={restrictCreation:false};
const request=(path)=>new Request('https://fixture.test'+path);
const rpc=async(handler,name,args={})=>(await(await handler(new Request('https://fixture.test/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}))).json()).result;
async function setup(t){
 const x=openTestDatabase();t.after(()=>x.sqlite.close());
 async function create(label,amount,versions){
  const user={userId:'migration-'+label,email:label+'@example.test',displayName:label};
  await familyCommand(x.db,user,{action:'create',name:label+'家庭'},config);
  const scope=await familyContext(x.db,user,config),db=scopeDb(x.db,scope);
  const send=async(action,body)=>executeCommand(db,{key:crypto.randomUUID(),revision:(await snapshot(db)).book.revision,action,body},user.userId);
  const bank=await send('account.save',{name:label+'私有现金',category:'cash',currency:'CNY',amount});
  await send('transaction.add',{type:'income',accountId:bank.id,amount:'10.00',date:'2026-11-02',note:label+'私有收入'});
  const research={title:label+'私有研究',summary:label+'结论',content:label+'详细内容',sources:[],missing:[],ownerMemberId:'family'};
  const reviewDraft=await send('mcp.draft.submit',{kind:'investment',payload:research});
  const review=await send('mcp.draft.accept',{draftId:reviewDraft.id,confirmed:true,reviewedPayload:research});
  const context=await getMonthlyContext(db,await snapshot(db),'2026-11');
  const monthly={month:'2026-11',title:label+'私有月报',summary:label+'月度结论',sections:[{heading:'依据',body:label+'真实本站分录'}],limitations:[],nextActions:[],basisFingerprint:context.basisFingerprint,ownerMemberId:'family'};
  const monthDraft=await send('mcp.draft.submit',{kind:'monthly_review',payload:monthly});
  const monthReview=await send('mcp.draft.accept',{draftId:monthDraft.id,confirmed:true,reviewedPayload:monthly});
  for(let v=1;v<=versions;v++){const skills=structuredClone(DEFAULT_SKILLS);skills[0].body+='\n'+label+'私有工作流版本'+v;await send('skills.save',{skills,note:label+'私有版本'+v,baseVersion:v-1});}
  const pending=await send('mcp.draft.submit',{kind:'investment',payload:{...research,title:label+'待核对研究'}});
  const deps={getUser:async()=>user,getDb:()=>db,getOwner:()=>user.userId};
  return {user,scope,db,send,bank,research,review,monthReview,pending,deps,mcp:createMcpHandler({getIdentity:async()=>({id:user.userId,canWrite:true}),getDb:()=>db})};
 }
 const a=await create('甲', '1000.00',2),b=await create('乙','2000.00',1);
 const durable=()=>JSON.stringify({books:x.sqlite.prepare('SELECT * FROM books ORDER BY id').all(),accounts:x.sqlite.prepare('SELECT * FROM accounts ORDER BY dataset_id,id').all(),transactions:x.sqlite.prepare('SELECT * FROM transactions ORDER BY dataset_id,id').all(),entries:x.sqlite.prepare('SELECT * FROM entries ORDER BY dataset_id,transaction_id,account_id').all(),documents:x.sqlite.prepare('SELECT * FROM documents ORDER BY dataset_id,id').all(),commands:x.sqlite.prepare('SELECT * FROM commands ORDER BY book_id,idempotency_key').all(),audit:x.sqlite.prepare('SELECT * FROM audit_events ORDER BY dataset_id,id').all()});
 return {...x,a,b,durable};
}
async function postFinance(family,action,body){return createFinanceHandlers(family.deps).POST(new Request('https://fixture.test/api/finance',{method:'POST',body:JSON.stringify({key:crypto.randomUUID(),revision:(await snapshot(family.db)).book.revision,action,body})}));}

test('M012 two populated real families isolate account/transaction/review/monthly/skill reads',async t=>{
 const x=await setup(t),{a,b}=x;assert.notEqual(a.scope.bookId,b.scope.bookId);
 for(const [self,foreign]of [[a,b],[b,a]]){
  const s=await snapshot(self.db);assert.ok(s.accounts.some(r=>r.id===self.bank.id));assert.ok(!s.accounts.some(r=>r.id===foreign.bank.id));
  const context=await rpc(self.mcp,'get_financial_context');assert.ok(!context.isError);assert.ok(!JSON.stringify(context).includes(foreign.bank.id));
  const rows=await rpc(self.mcp,'list_transactions',{accountId:self.bank.id});assert.ok(!rows.isError);assert.ok(rows.structuredContent.rows.some(r=>r.note===self.user.displayName+'私有收入'));
  assert.equal((await rpc(self.mcp,'list_transactions',{accountId:foreign.bank.id})).isError,true);
  const reviews=await rpc(self.mcp,'list_reviews');assert.ok(!reviews.isError);assert.deepEqual(new Set(reviews.structuredContent.rows.map(r=>r.id)),new Set([self.review.id,self.monthReview.id]));
  const draftList=await rpc(self.mcp,'list_finance_drafts');assert.ok(!JSON.stringify(draftList).includes(foreign.pending.id));
  const monthlyResponse=await createReviewHandlers(self.deps).GET(request('/api/reviews?month=2026-11'));assert.equal(monthlyResponse.status,200);
  const monthly=await monthlyResponse.json();assert.ok(monthly.accounts.some(r=>r.id===self.bank.id));assert.ok(!monthly.accounts.some(r=>r.id===foreign.bank.id));assert.equal(monthly.memberCashflow.find(r=>r.memberId==='user:'+self.user.userId).incomeMinor,1000);
  const skillsResponse=await createSkillHandlers(self.deps).GET(request('/api/skills?version=1'));assert.equal(skillsResponse.status,200);const skills=await skillsResponse.json();assert.ok(skills.skills[0].body.includes(self.user.displayName+'私有工作流版本1'));assert.ok(!skills.skills[0].body.includes(foreign.user.displayName+'私有工作流版本1'));
  const bundle=await rpc(self.mcp,'get_skill_bundle');assert.ok(!bundle.isError);assert.ok(!JSON.stringify(bundle).includes(foreign.user.displayName+'私有工作流'));
  assert.equal((await createReviewHandlers(self.deps).GET(request('/api/reviews?month=2026-11&dataset_id='+encodeURIComponent(foreign.scope.bookId)))).status,403);
 }
 assert.equal((await createSkillHandlers(b.deps).GET(request('/api/skills?version=2'))).status,403);
 assert.equal((await createSkillHandlers(b.deps).GET(request('/api/skills?download=1&version=2'))).status,403);
});

test('M012 cross-family IDs, foreign skill version restore and forged identities cannot mutate either populated ledger',async t=>{
 const x=await setup(t),{a,b}=x,before=x.durable();
 for(const [self,foreign]of [[a,b],[b,a]]){
  const r=await rpc(self.mcp,'submit_finance_draft',{request_id:'foreign-account',expected_revision:(await snapshot(self.db)).book.revision,kind:'cashflow',payload:{type:'expense',accountId:foreign.bank.id,cashMemberId:'user:'+foreign.user.userId,amount:'1.00',date:'2026-11-03',note:'跨家庭应拒绝',balanceIncluded:false}});assert.equal(r.isError,true);
  assert.equal((await postFinance(self,'mcp.draft.accept',{draftId:foreign.pending.id,confirmed:true,reviewedPayload:foreign.research})).status,422);
  assert.equal((await postFinance(self,'account.save',{id:foreign.bank.id,name:'跨家庭应拒绝',category:'cash',currency:'CNY',amount:'999.00'})).status,403);
  const forgedDeps={...foreign.deps,getUser:async()=>self.user};
  assert.equal((await createSkillHandlers(forgedDeps).GET(request('/api/skills'))).status,403);
  assert.equal((await createReviewHandlers(forgedDeps).GET(request('/api/reviews?month=2026-11'))).status,403);
  const forgedMcp=createMcpHandler({getIdentity:async()=>({id:self.user.userId,canWrite:true}),getDb:()=>foreign.db});assert.equal((await rpc(forgedMcp,'get_financial_context')).isError,true);
 }
 assert.equal((await postFinance(b,'skills.restore',{version:2})).status,422);
 assert.equal(x.durable(),before,'all failed probes leave both families’ durable financial and audit records unchanged');
});

test('M012 ordinary family member reads own family only, cannot adopt/edit workflows, and cached HTTP/MCP access fails after removal',async t=>{
 const x=await setup(t),{a,b}=x,member={userId:'migration-reader',email:'reader@example.test',displayName:'只读家人'};
 let scope=await familyContext(x.db,a.user,config);const invite=await familyCommand(x.db,a.user,{action:'invite',revision:scope.revision},config);await familyCommand(x.db,member,{action:'accept',token:invite.token},config);
 const md=scopeDb(x.db,await familyContext(x.db,member,config)),deps={getUser:async()=>member,getDb:()=>md,getOwner:()=>a.user.userId},readonly={db:md,deps};
 const mcp=createMcpHandler({getIdentity:async()=>({id:member.userId,canWrite:false}),getDb:()=>md}),skills=createSkillHandlers(deps),reviews=createReviewHandlers(deps),before=x.durable();
 assert.equal((await skills.GET(request('/api/skills?download=1'))).status,200);assert.equal((await reviews.GET(request('/api/reviews?month=2026-11'))).status,200);assert.equal((await rpc(mcp,'get_skill_bundle')).isError,undefined);
 assert.equal((await rpc(mcp,'list_transactions',{accountId:b.bank.id})).isError,true);
 assert.equal((await postFinance(readonly,'skills.save',{skills:DEFAULT_SKILLS,baseVersion:2})).status,403);
 assert.equal((await postFinance(readonly,'skills.restore',{version:0})).status,403);
 assert.equal((await postFinance(readonly,'mcp.draft.accept',{draftId:a.pending.id,confirmed:true,reviewedPayload:a.research})).status,403);
 assert.equal((await rpc(mcp,'submit_finance_draft',{request_id:'reader-write',expected_revision:(await snapshot(md)).book.revision,kind:'investment',payload:a.research})).isError,true);assert.equal(x.durable(),before);
 scope=await familyContext(x.db,a.user,config);await familyCommand(x.db,a.user,{action:'remove',userId:member.userId,revision:scope.revision},config);
 assert.equal((await skills.GET(request('/api/skills?download=1'))).status,403);assert.equal((await reviews.GET(request('/api/reviews?month=2026-11'))).status,403);
 for(const name of ['get_financial_context','list_reviews','get_skill_bundle','list_finance_drafts'])assert.equal((await rpc(mcp,name)).isError,true,name);
 assert.equal(await familyContext(x.db,member,config),null);
});

test('N003 populated families cannot cancel one another’s plans or retrieve private handoff tasks',async t=>{
 const x=await setup(t),{a,b}=x;
 for(const f of [a,b]){f.plan=await f.send('plan.save',{name:f.user.displayName+'旅行',category:'国内旅行',date:'2026-11-14',end:'2026-11-15',budget:'100.00',approve:true});await f.send('research.request',{kind:'monthly',title:f.user.displayName+'私有任务',question:f.user.displayName+'只在本家庭可见的月份上下文'});}
 const before=x.durable();for(const [self,foreign]of [[a,b],[b,a]]){assert.equal((await postFinance(self,'plan.cancel',{planId:foreign.plan.id,version:1,confirmed:true})).status,422);const tasks=await rpc(self.mcp,'list_research_requests');assert.ok(!tasks.isError);assert.ok(JSON.stringify(tasks).includes(self.user.displayName+'只在本家庭'));assert.ok(!JSON.stringify(tasks).includes(foreign.user.displayName+'只在本家庭'));}assert.equal(x.durable(),before);
});
