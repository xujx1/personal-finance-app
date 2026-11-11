import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../src/domain/finance-ui.mjs';

test('read-only family member can only approve their own required active vote',()=>{
 const state={viewer:{subject:'member',canWrite:false},householdMembers:[{userId:'member',active:true}],documents:[{id:'plan',kind:'plan',payload:{familyApproval:{version:2,required:['owner','member'],approvals:[{userId:'owner'}],status:'PENDING_APPROVAL'}}}]};
 assert.equal(ui.canSubmitFinanceAction(state,'plan.approve',{planId:'plan',version:2}),true);
 assert.equal(ui.canSubmitFinanceAction(state,'account.save',{}),false);
 assert.equal(ui.canSubmitFinanceAction(state,'plan.approve',{planId:'plan',version:1}),false);
 assert.equal(ui.canSubmitFinanceAction({...state,viewer:{subject:'outsider',canWrite:false}},'plan.approve',{planId:'plan',version:2}),false);
 assert.equal(ui.canSubmitFinanceAction({...state,householdMembers:[{userId:'member',active:false}]},'plan.approve',{planId:'plan',version:2}),false);
});

test('candidate review preserves account/member and converts cents without authorizing posting',()=>{
 const candidate={id:'suggestion',name:'固定收入',type:'income',accountId:'cash-two',cashMemberId:'person-two',amount:123456,day:12,start:'2026-11-12',autoPost:true};
 assert.deepEqual(ui.recurringCandidateBody(candidate),{name:'固定收入',type:'income',accountId:'cash-two',cashMemberId:'person-two',amount:'1234.56',day:12,start:'2026-11-12',autoPost:false,confirmed:true});
});
