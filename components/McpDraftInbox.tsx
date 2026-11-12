"use client";
import {PrivacyEditNotice} from './FinancialPrivacy';
import ActivityImages,{ActivityImageFields} from './ActivityImages';
import CostBasisPanel from './CostBasisPanel';
import {PensionFields,pensionValue} from './PensionAccount';
import HouseholdSetupReview from './HouseholdSetup';
import {useState} from 'react';
import {AssetTypeSelect} from './AssetTypeControls';
import {getAssetTypes,accountAssetType} from '../src/domain/asset-types.mjs';
import {mcpDraftAcceptBody} from '../src/domain/mcp-draft-ui.mjs';
import {decimal} from '../src/domain/finance.mjs';
import {normalizeExpenseDraft} from '../src/domain/expense-plan.mjs';
import {MemberSelect,MemberAccountFields} from './MemberControls';
import ExternalWorkflowDraftReview from './ExternalWorkflowDraftReview';
import './McpDraftInbox.css';
import {historicalAnalysisFacts} from '../src/domain/research-records.mjs';
import {draftInbox,DRAFT_KINDS} from '../src/domain/draft-inbox.mjs';

type Props={state:any;onSave:(action:string,body:any)=>Promise<unknown>};
const kindNames:Record<string,string>={setup:'家庭财务建档',budget:'消费预算与行程',cashflow:'实际现金流水',asset:'已有资产登记',investment:'投资研究',monthly_review:'月度总结',recurring:'周期规则'};
const statusNames:Record<string,string>={PENDING:'待本人核对',ACCEPTED:'已采用',REJECTED:'已拒绝 · 保留历史'};
const assetCategories:Record<string,string>={cash:'银行现金',term_deposit:'银行定期存款',fund:'基金',stock:'股票证券',property:'房产',loan:'住房贷款',other:'其他资产'};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const safeLink=(value:unknown)=>{try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:undefined}catch{return undefined}};

export default function McpDraftInbox({state,onSave}:Props){
 const [status,setStatus]=useState('PENDING'),[kind,setKind]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(1);
 const view=draftInbox(state,{kind,query,status,page});
 return <section className="card mcp-draft-inbox" aria-label="ChatGPT外部分析草稿">
  <div className="mcp-inbox-heading"><h2>同步草稿</h2><span className="badge gray">待处理 {view.pendingCount}</span></div>
  <p className="help-text">统一核对ChatGPT同步的资料。展开待处理草稿可编辑、采纳或拒绝；采纳后按对应业务规则保存，预算仍需家庭审批。</p>
  <div className="tabs-row" role="group" aria-label="草稿状态">{[['PENDING','待处理',view.pendingCount],['PROCESSED','已处理',view.processedCount]].map(([id,label,count])=><button type="button" key={id} className={'filter '+(status===id?'active':'')} aria-pressed={status===id} onClick={()=>{setStatus(String(id));setPage(1)}}>{label}（{count}）</button>)}</div>
  <div className="record-filters"><label className="field">搜索同步草稿<input aria-label="搜索同步草稿" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/></label><label className="field">草稿类型<select aria-label="草稿类型" value={kind} onChange={e=>{setKind(e.target.value);setPage(1)}}><option value="all">全部类型</option>{DRAFT_KINDS.map(id=><option key={id} value={id}>{kindNames[id]}</option>)}</select></label></div>
  {!view.shown.length&&<p className="mcp-inbox-empty">{query||kind!=='all'?'没有匹配的草稿。':status==='PENDING'?'当前没有待处理草稿。':'当前没有已处理草稿。'}</p>}
  {status==='PENDING'&&view.shown.some((d:any)=>(d.payload.draftVersion??1)>1)&&<p className="help-text" role="status">草稿已在ChatGPT续改并保存，请按当前版本重新核对；旧版本确认不沿用。</p>}
  {status==='PENDING'?view.shown.map((d:any)=>d.payload.kind==='setup'?<HouseholdSetupReview key={d.id+':'+(d.payload.draftVersion??1)} document={d} state={state} onSave={onSave}/>:['investment','monthly_review','recurring'].includes(d.payload.kind)?<ExternalWorkflowDraftReview key={d.id+':'+(d.payload.draftVersion??1)} document={d} state={state} onSave={onSave}/>:<DraftReview key={d.id+':'+(d.payload.draftVersion??1)} document={d} state={state} onSave={onSave}/>):<div className="mcp-draft-history">{view.shown.map((d:any)=><article key={d.id} className="mcp-history-row" data-processed-draft-id={d.id}><div><strong>{d.payload.reviewedPayload?.name??d.payload.reviewedPayload?.title??d.payload.payload?.name??d.payload.payload?.title??d.payload.payload?.note??kindNames[d.payload.kind]}</strong><small>{kindNames[d.payload.kind]} · {d.payload.source}</small>{d.payload.destinationKind==='plan'&&<small>已提交家庭审批，可在预算详情查看当前审批与计划。</small>}{d.payload.rejectionReason&&<small>拒绝原因：{d.payload.rejectionReason}</small>}<details><summary>查看处理记录</summary><p className="help-text">{d.payload.reviewedPayload?.analysis??d.payload.reviewedPayload?.summary??d.payload.payload?.analysis??d.payload.payload?.summary??'已保留核对与处理记录。'}</p></details></div><span className="badge gray">{statusNames[d.payload.status]??d.payload.status}</span></article>)}</div>}
  <div className="actions section-space" aria-label="草稿分页"><button type="button" className="btn" disabled={view.page<=1} onClick={()=>setPage(view.page-1)}>上一页草稿</button><span>第 {view.page} / {view.pages} 页 · {view.total} 条</span><button type="button" className="btn" disabled={view.page>=view.pages} onClick={()=>setPage(view.page+1)}>下一页草稿</button></div>
 </section>;
}

function DraftReview({document,state,onSave}:{document:any;state:any;onSave:Props['onSave']}){
 const meta=document.payload,kind=meta.kind;
 const [payload,setPayload]=useState<any>(()=>({...meta.payload}));
 const [reviewed,setReviewed]=useState(false),[actual,setActual]=useState(false),[coverage,setCoverage]=useState('');
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[reason,setReason]=useState(''),[rejecting,setRejecting]=useState(false);
 const writable=state?.viewer?.canWrite===true;
 function update(patch:any){setPayload((current:any)=>({...current,...patch}));setReviewed(false);setActual(false);setError('');}
 function field(name:string,label:string,type='text',required=true){return <label className="field">{label}<input aria-label={label} type={type} step={type==='number'?'any':undefined} max={type==='date'&&(name==='asOf'||kind==='cashflow'&&name==='date')?today():undefined} value={payload[name]??''} required={required} onChange={e=>update({[name]:e.target.value})}/></label>}
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!writable||saving)return;setError('');
  try{const body=mcpDraftAcceptBody(state,document,{...payload,...(kind==='cashflow'?{balanceIncluded:payload.prepaymentId?false:coverage==='uncovered'?false:coverage==='included'?true:undefined,...(coverage==='included'?{snapshotDate:payload.snapshotDate??state.accounts.find((a:any)=>a.id===payload.accountId)?.metadata?.asOf}:{})}:{}),...(kind==='asset'?{owned:actual}:{})},{reviewed,actual});setSaving(true);await onSave('mcp.draft.accept',body);}catch(e){setError(e instanceof Error?e.message:'无法采用草稿，请核对后重试')}finally{setSaving(false)}
 }
 async function reject(){if(!writable||saving)return;setSaving(true);try{await onSave('mcp.draft.reject',{draftId:document.id,reason});setRejecting(false)}catch(e){setError(e instanceof Error?e.message:'无法拒绝草稿')}finally{setSaving(false)}}
 return <article className="mcp-draft-card" data-draft-id={document.id} data-draft-kind={kind}>
  <details><summary className="mcp-draft-summary"><span><strong>{meta.payload.name??meta.payload.note??kindNames[kind]}</strong><small>{kindNames[kind]} · {meta.createdAt?new Date(meta.createdAt).toLocaleString('zh-CN'): '提交时间待核实'}</small></span><span className="badge">待本人核对 · v{meta.draftVersion??1}</span></summary>
   <p className="mcp-source-label">来源：{meta.source??'ChatGPT/MCP，外部分析待本人核对'}</p>
   {!writable&&<p className="notice neutral">家庭成员可查看草稿；仅账本本人可核对采用。预算提交后，每位有效家庭成员需单独确认。</p>}
   <form onSubmit={submit} onInvalidCapture={e=>{let node=(e.target as HTMLElement).parentElement;while(node&&node!==e.currentTarget){if(node instanceof HTMLDetailsElement)node.open=true;node=node.parentElement}}} aria-label={kindNames[kind]+'草稿核对'}>
    <PrivacyEditNotice/><fieldset disabled={!writable||saving} className="mcp-review-fields">
     {kind==='budget'&&<>
      <div className="form-grid">{field('name','外部预算名称')}<MemberSelect state={state} label="外部预算归属成员" value={payload.ownerMemberId??''} onChange={(id:string)=>update({ownerMemberId:id})}/>{field('category','外部预算类别')}{field('date','外部预算开始日期','date')}{field('end','外部预算结束日期','date')}</div>
      {payload.planId&&<p className="notice neutral">更新原预算：{state.documents.find((d:any)=>d.id===payload.planId)?.payload?.name??'原计划'}；采用后重新发起家庭审批，不重复新增。</p>}<BudgetDraftFields draft={payload.expenseDraft} original={meta.payload} onChange={expenseDraft=>update({expenseDraft})}/>
      <p className="notice neutral">采用后进入家庭审批，金额与行程仍属待审批草案，待审批阶段不进入日历。全体有效家庭成员确认后进入正式预算并同步生活日历；不扣款、不记流水。</p>
     </>}
     {kind==='cashflow'&&<>
      {payload.planId&&<section className="notice neutral" aria-label="关联预算实际消费"><strong>关联预算：{state.documents.find((d:any)=>d.kind==='plan'&&d.id===payload.planId)?.payload.name??'原计划待重新读取'}</strong><p>{payload.prepaymentId?'本次抵扣原预付款，减少预付资产，不再扣银行现金。':'本次是原预算的实际付款，确认后计入计划实付与消费，并按余额覆盖情况更新所选成员账户。'}</p><p>原预算 ¥{decimal(state.documents.find((d:any)=>d.id===payload.planId)?.payload.budget??0)} · 已支付 ¥{decimal(state.planSummaries.find((p:any)=>p.planId===payload.planId)?.paid??0)} · 已消费 ¥{decimal(state.planSummaries.find((p:any)=>p.planId===payload.planId)?.consumed??0)}</p><small>计划与原预付款关联固定；金额、日期与账户仍须核实。关联错误请拒绝并重新整理草稿。</small></section>}
      <div className="form-grid"><label className="field">实际流水类型<select aria-label="外部实际流水类型" disabled={Boolean(payload.planId)} value={payload.type??''} required onChange={e=>update({type:e.target.value})}><option value="">请选择</option><option value="income">实际收入到账</option><option value="expense">实际消费支出</option></select></label><MemberAccountFields state={state} disabled={Boolean(payload.prepaymentId)} defaultAccountId={payload.accountId??''} defaultMemberId={payload.cashMemberId??''} memberLabel="外部流水收付款成员" label="外部流水实际现金账户" onAccountChange={(id:string)=>{const account=state.accounts.find((a:any)=>a.id===id);update({accountId:id,cashMemberId:account?.metadata?.ownerMemberId??''})}}/>{field('amount','外部流水实际金额 CNY')}{field('date','外部流水实际发生日期','date')}</div>
      {!payload.prepaymentId&&<><label className="field">当前余额覆盖情况<select aria-label="当前余额覆盖情况" value={coverage} required onChange={e=>{setCoverage(e.target.value);setReviewed(false);setActual(false)}}><option value="">请核对银行余额后选择</option><option value="uncovered">该笔未包含在当前已登记余额中</option><option value="included">该笔已包含在当前余额中</option><option value="unknown">暂不确定</option></select></label>
      {coverage==='included'?<p className="notice">此笔按已含余额的历史补记，不再扣银行现金；日期须在该账户已登记的余额核实日期内。</p>:<p className="help-text">未来工资、预计收益及尚未付款的计划不能记为实际流水。日期须晚于该账户最近余额核实日期；已含余额或无法确认时请保留草稿。</p>}</>}
     </>}
     {kind==='asset'&&<>
      {payload.pension&&<PensionFields state={state} value={payload.pension} onChange={pension=>{let amount=payload.amount;try{amount=pensionValue(pension)}catch{}update({pension,amount})}}/>}
      <p className="notice neutral">这里只登记本人已经持有、尚未登记的资产。投资建议和未来购买计划不能计入已有资产；已登记资产请在资产列表核对，勿重复新增。</p>
      <div className="form-grid">{field('name','外部已有资产名称')}<MemberSelect state={state} label="外部资产归属成员" value={payload.ownerMemberId??''} onChange={(id:string)=>update({ownerMemberId:id})}/><AssetTypeSelect state={state} value={payload.assetTypeId??accountAssetType({...payload,kind:payload.category==='loan'?'LIABILITY':'ASSET'},state)?.id} label="外部已有资产类型" onChange={id=>{const type=getAssetTypes(state).find((t:any)=>t.id===id);update({assetTypeId:id,category:type?.baseCategory??''})}}/><label className="field">原币<select aria-label="外部资产原币" value={payload.currency??''} onChange={e=>update({currency:e.target.value})} required><option value="">请选择</option><option>CNY</option><option>USD</option></select></label>{field('amount',payload.category==='loan'?'外部贷款剩余本金（原币）':'外部资产当前余额或市值（原币）')}{field('asOf','外部资产余额核实日期','date')}</div>
      {['stock','fund'].includes(payload.category)&&<div className="form-grid">{field('code','外部资产代码','text',false)}{field('market','外部资产市场','text',false)}{field('quantity','外部已有持仓数量','text',false)}{field('price','外部资产核实单价（原币）','text',false)}{field('cost','外部资产单位成本（原币）','text',false)}</div>}
      {['cash','term_deposit'].includes(payload.category)&&<div className="form-grid">{field('bank','外部资产银行','text',payload.category==='term_deposit')}{field('startDate','外部存款起存日期','date',payload.category==='term_deposit')}{field('annualRate','外部存款年利率 %','text',payload.category==='term_deposit')}{payload.category==='term_deposit'&&field('maturityDate','外部定期到期日期','date')}</div>}
      {payload.category==='loan'&&<div className="form-grid">{field('monthly','外部贷款月供（原币）','text',false)}{field('startDate','外部贷款开始日期','date',false)}{field('maturityDate','外部贷款到期日期','date',false)}{field('rate','外部贷款年利率 %','text',false)}{field('day','外部贷款每月扣款日','number',false)}</div>}
     </>}
     <details className="mcp-review-group" id={'draft-analysis-'+document.id}><summary>分析依据与核对备注</summary>
     {kind==='budget'&&<p className="help-text">以下为原始分析，可手动补充；修改费用或行程不会自动重新评估原文，请核对其中旧金额与执行建议。</p>}
     <label className="field">外部分析依据<textarea aria-label="外部分析依据" value={payload.analysis??''} required={kind==='budget'} onChange={e=>update({analysis:e.target.value})}/></label>
     <label className="field">核对备注<textarea aria-label="外部草稿核对备注" value={payload.note??''} onChange={e=>update({note:e.target.value})}/></label></details>
     <div className="mcp-confirmation-area">
     {kind!=='budget'&&<label className="mcp-confirmation"><input type="checkbox" checked={actual} onChange={e=>setActual(e.target.checked)}/>{kind==='asset'?'我已确认这是已经实际持有的资产，归属与原币金额正确，且未重复登记':'我已确认收入已到账或支出已支付，实际日期、成员与现金账户正确'}</label>}
     <label className="mcp-confirmation"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>我已逐项核对外部分析、金额、来源及{kind==='budget'?'费用和行程':'实际事实'}，同意采用当前填写内容</label>
     {error&&<p className="notice" role="alert">{error}</p>}
     <div className="mcp-review-actions"><button className="btn primary" type="submit" disabled={!reviewed||kind!=='budget'&&!actual||kind==='cashflow'&&!payload.prepaymentId&&(coverage!=='uncovered'&&(coverage!=='included'||!state.accounts.find((a:any)=>a.id===payload.accountId)?.metadata?.asOf||payload.date>(payload.snapshotDate??state.accounts.find((a:any)=>a.id===payload.accountId)?.metadata?.asOf)))}>{saving?'正在保存…':kind==='budget'?'采用并提交家庭审批':kind==='cashflow'?'采用并记录实际流水':'采用并登记已有资产'}</button><button className="btn" type="button" onClick={()=>setRejecting(!rejecting)}>{rejecting?'取消拒绝':'拒绝此草稿'}</button></div>
     </div>
     {rejecting&&<div className="mcp-reject"><label className="field">拒绝原因（可选）<input aria-label="外部草稿拒绝原因" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label><p className="help-text">拒绝会保留原稿与处理记录；可回到 ChatGPT 修改分析后重新提交。</p><button className="btn" type="button" onClick={reject}>确认拒绝并保留历史</button></div>}
    </fieldset>
   </form>
  </details>
 </article>;
}

function BudgetDraftFields({draft,original,onChange}:{draft:any;original:any;onChange:(draft:any)=>void}){
 const value=draft??{kind:'general',items:[],itinerary:[],comparisons:[]};
 const change=(patch:any)=>onChange({...value,...patch,reviewed:false});
 const item=(index:number,patch:any)=>change({items:(value.items??[]).map((x:any,i:number)=>i===index?{...x,...patch,...(['unitPrice','quantity','merchant','name','version'].some(key=>Object.hasOwn(patch,key)&&patch[key]!==x[key])?{sourceType:'user_quote',sourceUrl:null,checkedAt:null,priceEvidence:null,pricing:undefined}:{})}:x)});
 const info=historicalAnalysisFacts({original,reviewed:{...original,expenseDraft:value}});
 let total='待补齐';try{total=decimal(normalizeExpenseDraft(value,{requireReview:false}).totalMinor)+' CNY'}catch{}
 return <section className="mcp-budget-items" aria-label="外部预算费用和行程"><div className="mcp-inbox-heading"><h3>核对费用与行程</h3><strong className="money">{total}</strong></div>
  <div className="mcp-budget-overview"><p className="help-text">当前填写结构化合计 · {value.items?.length??0} 项费用 · {value.itinerary?.length??0} 项行程 · 原分析需逐项核对</p>{info.reviewChanged&&<p className="notice neutral sensitive-text" role="status">原稿金额 {info.original?.amount??'待补齐'} → 当前填写 {info.reviewed?.amount??'待补齐'} CNY。费用或行程已修改，原分析与行程备注尚未重新评估。</p>}<div className="mcp-section-shortcuts" aria-label="草稿分组导航">{[['costs','费用'],['itinerary','行程'],['images','图片与地点']].map(([group,label])=><button key={group} type="button" className="btn" onClick={e=>openReviewGroup(e.currentTarget,group)}>{label}</button>)}<button type="button" className="btn" onClick={e=>{const target=e.currentTarget.closest('form')?.querySelector<HTMLDetailsElement>('[id^="draft-analysis-"]');if(target){target.open=true;target.scrollIntoView({block:'start'})}}}>分析与备注</button><button type="button" className="btn" onClick={e=>e.currentTarget.closest('form')?.querySelector('.mcp-confirmation-area')?.scrollIntoView({block:'center'})}>核对并提交</button></div>{(value.items??[]).some((x:any)=>!x.name||!x.unitPrice)&&<p className="notice" role="status">待补齐：部分费用缺少名称或单价，请展开费用核对。</p>}{(value.itinerary??[]).some((x:any)=>!x.date||!x.title)&&<p className="notice" role="status">待补齐：部分行程缺少日期或安排。</p>}</div><CostBasisPanel draft={value}/><p className="help-text">参考报价不代表成交价。无可核验来源的金额属于情景估算；更改商家、名称或价格后按本人填写参考处理。</p>
  <label className="field">消费场景<select aria-label="外部预算消费场景" value={value.kind??'general'} onChange={e=>change({kind:e.target.value})}><option value="travel">旅行</option><option value="shopping">购物</option><option value="dining">餐饮</option><option value="general">其他消费</option></select></label>
  <details className="mcp-review-group" data-review-group="costs"><summary>费用明细（{value.items?.length??0} 项） · 逐项核对数量、单价与来源</summary>
  {(value.items??[]).map((x:any,i:number)=><details className="mcp-budget-item" key={x.id??i} open={(value.items??[]).length<=3}><summary>{i+1}. {x.name||'费用名称待补齐'} <span className="money">{x.quantity??1} × ¥{x.unitPrice??(x.amount!=null?decimal(x.amount):'待补齐')}</span></summary>
   <div className="mcp-item-heading"><label className="mcp-confirmation"><input type="checkbox" aria-label={'外部预算纳入项目 '+(i+1)} checked={x.selected!==false} onChange={e=>item(i,{selected:e.target.checked})}/>计入预算 {i+1}</label><button type="button" className="text-button" onClick={()=>change({items:value.items.filter((_:any,j:number)=>j!==i)})}>移除费用 {i+1}</button></div>
   <div className="form-grid"><label className="field">项目<input aria-label={'外部费用名称 '+(i+1)} value={x.name??''} required onChange={e=>item(i,{name:e.target.value})}/></label><label className="field">数量<input aria-label={'外部费用数量 '+(i+1)} value={x.quantity??'1'} required onChange={e=>item(i,{quantity:e.target.value})}/></label><label className="field">单价 CNY<input aria-label={'外部费用单价 '+(i+1)} value={x.unitPrice??(x.amount!=null?decimal(x.amount):'')} required onChange={e=>item(i,{unitPrice:e.target.value})}/></label><label className="field">商家<input aria-label={'外部费用商家 '+(i+1)} value={x.merchant??''} onChange={e=>item(i,{merchant:e.target.value})}/></label><label className="field">类别<input aria-label={'外部费用类别 '+(i+1)} value={x.category??'其他'} onChange={e=>item(i,{category:e.target.value})}/></label><label className="field">关联行程<select aria-label={'外部费用关联行程 '+(i+1)} value={x.itineraryId??''} onChange={e=>item(i,{itineraryId:e.target.value||null})}><option value="">独立费用</option>{(value.itinerary??[]).map((a:any,j:number)=><option key={a.id??j} value={a.id??'activity-'+j}>{a.date} · {a.title}</option>)}</select></label></div>
   <p className="mcp-price-boundary">{x.sourceType==='retrieved_reference'&&safeLink(x.sourceUrl)&&x.checkedAt&&x.priceEvidence?'检索参考 · 非实时成交价':x.sourceType==='user_quote'?'本人填写 · 参考报价':'情景估算 · 未核验报价'}{safeLink(x.sourceUrl)&&<> · <a href={safeLink(x.sourceUrl)} target="_blank" rel="noreferrer">查看来源</a></>}{x.checkedAt&&<> · 查询时间 {x.checkedAt}</>}</p>{x.priceEvidence&&<blockquote>{x.priceEvidence}</blockquote>}
   <label className="field">费用备注<input aria-label={'外部费用备注 '+(i+1)} value={x.note??''} onChange={e=>item(i,{note:e.target.value})}/></label>
  </details>)}
  <button className="text-button" type="button" disabled={(value.items??[]).length>=50} onClick={()=>change({items:[...(value.items??[]),{id:crypto.randomUUID(),name:'',quantity:'1',unitPrice:'',category:'其他',selected:true,sourceType:'user_quote'}]})}>添加外部预算费用</button>
  </details><details className="mcp-review-group" data-review-group="itinerary"><summary>行程安排（{value.itinerary?.length??0} 项） · 日期、地点与历史备注</summary>
  <p className="help-text">行程备注保留原始表述；调整费用后，其中金额与执行建议须本人重新核对。</p>
  {(value.itinerary??[]).map((a:any,i:number)=><details className="mcp-budget-item" key={a.id??i} open={(value.itinerary??[]).length<=3}><summary>行程 {i+1} · {a.date||'日期待补齐'} · {a.title||'安排待补齐'}</summary><label className="field">阶段<select aria-label={'外部行程阶段 '+(i+1)} value={a.phase??'trip'} onChange={e=>change({itinerary:value.itinerary.map((x:any,j:number)=>i===j?{...x,phase:e.target.value}:x)})}><option value="preparation">出发前准备</option><option value="trip">出游</option><option value="follow_up">后续安排</option></select></label>{(['date','time','title','location','notes'] as const).map(key=><label className="field" key={key}>{{date:'日期',time:'时间',title:'安排',location:'具体地点',notes:'备注'}[key]}<input aria-label={'外部行程'+{date:'日期',time:'时间',title:'安排',location:'具体地点',notes:'备注'}[key]+' '+(i+1)} type={key==='date'?'date':'text'} value={a[key]??''} required={key==='date'||key==='title'} onChange={e=>change({itinerary:value.itinerary.map((x:any,j:number)=>i===j?{...x,[key]:e.target.value}:x)})}/></label>)}<button className="text-button" type="button" onClick={()=>change({itinerary:value.itinerary.filter((_:any,j:number)=>i!==j),items:value.items.map((x:any)=>x.itineraryId===a.id?{...x,itineraryId:null}:x)})}>移除行程 {i+1}并解除费用关联</button></details>)}
  <button className="text-button" type="button" disabled={(value.itinerary??[]).length>=80} onClick={()=>change({itinerary:[...(value.itinerary??[]),{id:crypto.randomUUID(),date:'',time:'',title:'',notes:''}]})}>添加外部行程安排</button>
  </details><details className="mcp-review-group" data-review-group="images"><summary>行程图片与参考地点（{value.itinerary?.length??0} 项）</summary>{(value.itinerary??[]).map((a:any,i:number)=><details className="mcp-budget-item" key={a.id??i}><summary>{a.title||'行程 '+(i+1)} · {a.location||'地点待补齐'}</summary><ActivityImages activity={a}/><ActivityImageFields activity={a} prefix={'外部行程'+(i+1)} onChange={images=>change({itinerary:value.itinerary.map((x:any,j:number)=>i===j?{...x,images}:x)})}/></details>)}</details>
  {value.comparisons?.length>0&&<details className="mcp-analysis"><summary>原始商品比价参考</summary>{value.comparisons.map((c:any,i:number)=><p key={i}>{c.title} · {c.merchant} · {c.version} · {c.price??'未核价'} · {c.checkedAt??'查询时间未提供'}{safeLink(c.url)&&<> · <a href={safeLink(c.url)} target="_blank" rel="noreferrer">参考来源</a></>} · {c.note}</p>)}</details>}
 </section>;
}

function openReviewGroup(button:HTMLButtonElement,group:string){const target=button.closest('form')?.querySelector<HTMLDetailsElement>(`[data-review-group="${group}"]`);if(target){target.open=true;target.scrollIntoView({block:'start'});target.querySelector('summary')?.focus();}}
