import {buildLifeCalendar} from './life-calendar.mjs';
import {investmentCalendarEntries} from './investment-followups.mjs';
import {getAssetTypes} from './asset-types.mjs';
import {expandAssetAccounts} from './asset-view.mjs';
import {accountMember,buildFinanceMembers} from './member-ownership.mjs';

// Business context only: never expose invite tokens, credentials, audit payloads,
// full attachment contents, or unrelated pending draft bodies to monthly reports.
export function monthlySiteContext(state,month){
 const plans=state.documents.filter(d=>d.kind==='plan').map(d=>({id:d.id,...d.payload}));
 const calendar=buildLifeCalendar([...plans,...investmentCalendarEntries(state.documents)],{anchor:month+'-01'});
 const days=calendar.days.filter(day=>day.date.startsWith(month)).map(({date,events})=>({date,events}));
 const members=state.household?state.financeMembers:buildFinanceMembers({...state,financeMembers:undefined,householdMembers:[]},[]);
 const inMonth=value=>typeof value==='string'&&value.startsWith(month);
 const reviews=state.documents.filter(d=>d.kind==='investment_review'&&(inMonth(d.payload.date)||inMonth(d.payload.acceptedAt)||(d.payload.followUps??[]).some(f=>inMonth(f.date)))).map(d=>({id:d.id,title:d.payload.title,summary:d.payload.summary,content:d.payload.content,sources:d.payload.sources,followUps:d.payload.followUps,acceptedAt:d.payload.acceptedAt})).sort((a,b)=>a.id.localeCompare(b.id));
 const memberships=state.documents.filter(d=>d.kind==='membership').map(d=>({id:d.id,...d.payload})).sort((a,b)=>a.id.localeCompare(b.id));
 const accounts=state.accounts.filter(a=>a.category!=='system').map(a=>({id:a.id,name:a.name,kind:a.kind,category:a.category,currency:a.currency,balanceMinor:a.balance,archived:Boolean(a.archived),ownerMemberId:accountMember(a,state).id,metadata:a.metadata})).sort((a,b)=>a.id.localeCompare(b.id));
 const exposures=expandAssetAccounts(state).filter(a=>a.category!=='system'&&a.kind==='ASSET'&&!a.archived).map(a=>({id:a.id,name:a.name,kind:a.kind,category:a.category,assetTypeId:a.metadata?.assetTypeId??null,currency:a.currency,balanceMinor:a.balance,ownerMemberId:accountMember(a,state).id,restricted:Boolean(a.projection||a.metadata?.pension),holdingAccountId:a.projection?.parentAccountId??null})).sort((a,b)=>a.id.localeCompare(b.id));
 return {schemaVersion:1,units:{balanceMinor:'integer original-currency cents',calendarBudget:'CNY cents',accountMetadata:'quantity is shares; cost/price and pension sub-amounts are major-currency strings',membershipPrices:'CNY major strings'},calendar:{month,timeZone:'Asia/Shanghai',days,note:'与生活日历同口径：家庭审批通过的计划及已保存投资复核安排；计划不代表实际出游或成交，取消不展示。'},accounts,assetExposures:exposures,assetTypes:getAssetTypes(state),members:(members??[]).map(m=>({id:m.id,name:m.name,active:m.active,kind:m.kind})),memberships,reviews,financialProfile:state.documents.find(d=>d.kind==='financial_profile')?.payload??null,coverage:{calendar:'complete_current_projection_for_month',accounts:'current_book_snapshots_not_historical_quotes',assetExposures:'disjoint_leaves_do_not_add_account_totals',reviews:'accepted_investment_research_for_month',memberships:'current_recorded_membership_rules',excluded:'登录凭据、邀请令牌、审计原文、其他家庭、附件二进制及无关待处理草稿；本站以外未录入记录未知。'}};
}
