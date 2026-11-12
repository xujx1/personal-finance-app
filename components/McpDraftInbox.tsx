"use client";
import {useState} from 'react';
import {AssetTypeSelect} from './AssetTypeControls';
import {getAssetTypes,accountAssetType} from '../src/domain/asset-types.mjs';
import {mcpDraftAcceptBody} from '../src/domain/mcp-draft-ui.mjs';
import {decimal} from '../src/domain/finance.mjs';
import {normalizeExpenseDraft} from '../src/domain/expense-plan.mjs';
import {MemberSelect,MemberAccountFields} from './MemberControls';
import ExternalWorkflowDraftReview from './ExternalWorkflowDraftReview';
import './McpDraftInbox.css';

type Props={state:any;kinds?:string[];onSave:(action:string,body:any)=>Promise<unknown>};
const kindNames:Record<string,string>={budget:'消费预算与行程',cashflow:'实际现金流水',asset:'已有资产登记',investment:'投资研究',monthly_review:'月度总结',recurring:'周期规则'};
const statusNames:Record<string,string>={PENDING:'待本人核对',ACCEPTED:'已采用',REJECTED:'已拒绝 · 保留历史'};
const assetCategories:Record<string,string>={cash:'银行现金',term_deposit:'银行定期存款',fund:'基金',stock:'股票证券',property:'房产',loan:'住房贷款',other:'其他资产'};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const safeLink=(value:unknown)=>{try{const u=new URL(String(value));return u.protocol==='https:'&&!u.username&&!u.password?u.href:undefined}catch{return undefined}};

export default function McpDraftInbox({state,kinds=['budget','cashflow','asset','investment','monthly_review','recurring'],onSave}:Props){
 const [history,setHistory]=useState(false);
 const documents=(state?.documents??[]).filter((d:any)=>d.kind==='financial_draft'&&kinds.includes(d.payload?.kind));
 const pending=documents.filter((d:any)=>d.payload.status==='PENDING'),closed=documents.filter((d:any)=>d.payload.status!=='PENDING');
 return <section className="card mcp-draft-inbox" aria-label="ChatGPT外部分析草稿">
  <div className="mcp-inbox-heading"><div><div className="eyebrow">CHATGPT · MCP</div><h2>外部分析草稿 <span className="badge gray">待核对 {pending.length}</span></h2></div>{closed.length>0&&<button className="text-button" type="button" aria-expanded={history} onClick={()=>setHistory(!history)}>{history?'收起处理历史':'处理历史 '+closed.length}</button>}</div>
  <p className="help-text">在ChatGPT中选择家庭财务中心，分析后保存为相应草稿，再回这里核对。提交草稿不会批准预算或扣款；无需本站再次调用AI。</p>
  {!pending.length&&<p className="mcp-inbox-empty">当前没有待核对的外部{ kinds.length===1?kindNames[kinds[0]]:'' }草稿。</p>}
  {pending.map((d:any)=>['investment','monthly_review','recurring'].includes(d.payload.kind)?<ExternalWorkflowDraftReview key={d.id} document={d} state={state} onSave={onSave}/>:<DraftReview key={d.id} document={d} state={state} onSave={onSave}/>)}
  {history&&<div className="mcp-draft-history">{closed.map((d:any)=><article key={d.id} className="mcp-history-row"><div><strong>{d.payload.payload?.name??d.payload.payload?.title??d.payload.payload?.note??kindNames[d.payload.kind]}</strong><small>{kindNames[d.payload.kind]} · {d.payload.source}</small>{d.payload.destinationKind==='plan'&&<small>已提交家庭审批；全体有效家庭成员确认后才进入正式预算与生活日历。</small>}{d.payload.rejectionReason&&<small>拒绝原因：{d.payload.rejectionReason}</small>}</div><span className="badge gray">{statusNames[d.payload.status]??d.payload.status}</span></article>)}</div>}
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
  try{const body=mcpDraftAcceptBody(state,document,{...payload,...(kind==='cashflow'?{balanceIncluded:coverage==='uncovered'?false:coverage==='included'?true:undefined,...(coverage==='included'?{snapshotDate:payload.snapshotDate??state.accounts.find((a:any)=>a.id===payload.accountId)?.metadata?.asOf}:{})}:{}),...(kind==='asset'?{owned:actual}:{})},{reviewed,actual});setSaving(true);await onSave('mcp.draft.accept',body);}catch(e){setError(e instanceof Error?e.message:'无法采用草稿，请核对后重试')}finally{setSaving(false)}
 }
 async function reject(){if(!writable||saving)return;setSaving(true);try{await onSave('mcp.draft.reject',{draftId:document.id,reason});setRejecting(false)}catch(e){setError(e instanceof Error?e.message:'无法拒绝草稿')}finally{setSaving(false)}}
 return <article className="mcp-draft-card" data-draft-id={document.id} data-draft-kind={kind}>
  <details><summary className="mcp-draft-summary"><span><strong>{meta.payload.name??meta.payload.note??kindNames[kind]}</strong><small>{kindNames[kind]} · {meta.createdAt?new Date(meta.createdAt).toLocaleString('zh-CN'): '提交时间待核实'}</small></span><span className="badge">待本人核对</span></summary>
   <p className="mcp-source-label">来源：{meta.source??'ChatGPT/MCP，外部分析待本人核对'}</p>
   {payload.analysis&&<details className="mcp-analysis"><summary>查看外部分析依据</summary><p>{payload.analysis}</p></details>}
   {!writable&&<p className="notice neutral">家庭成员可查看草稿；仅账本本人可核对采用。预算提交后，每位有效家庭成员需单独确认。</p>}
   <form onSubmit={submit} aria-label={kindNames[kind]+'草稿核对'}>
    <fieldset disabled={!writable||saving} className="mcp-review-fields">
     {kind==='budget'&&<>
      <div className="form-grid">{field('name','外部预算名称')}<MemberSelect state={state} label="外部预算归属成员" value={payload.ownerMemberId??''} onChange={(id:string)=>update({ownerMemberId:id})}/>{field('category','外部预算类别')}{field('date','外部预算开始日期','date')}{field('end','外部预算结束日期','date')}</div>
      {payload.planId&&<p className="notice neutral">更新原预算：{state.documents.find((d:any)=>d.id===payload.planId)?.payload?.name??'原计划'}；采用后重新发起家庭审批，不重复新增。</p>}<BudgetDraftFields draft={payload.expenseDraft} onChange={expenseDraft=>update({expenseDraft})}/>
      <p className="notice neutral">采用后进入家庭审批，金额与行程仍属待审批草案。全体有效家庭成员确认后才进入正式预算和生活日历；不扣款、不记流水。</p>
     </>}
     {kind==='cashflow'&&<>
      <div className="form-grid"><label className="field">实际流水类型<select aria-label="外部实际流水类型" value={payload.type??''} required onChange={e=>update({type:e.target.value})}><option value="">请选择</option><option value="income">实际收入到账</option><option value="expense">实际消费支出</option></select></label><MemberAccountFields state={state} defaultAccountId={payload.accountId??''} defaultMemberId={payload.cashMemberId??''} memberLabel="外部流水收付款成员" label="外部流水实际现金账户" onAccountChange={(id:string)=>{const account=state.accounts.find((a:any)=>a.id===id);update({accountId:id,cashMemberId:account?.metadata?.ownerMemberId??''})}}/>{field('amount','外部流水实际金额 CNY')}{field('date','外部流水实际发生日期','date')}</div>
      <label className="field">当前余额覆盖情况<select aria-label="当前余额覆盖情况" value={coverage} required onChange={e=>{setCoverage(e.target.value);setReviewed(false);setActual(false)}}><option value="">请核对银行余额后选择</option><option value="uncovered">该笔未包含在当前已登记余额中</option><option value="included">该笔已包含在当前余额中</option><option value="unknown">暂不确定</option></select></label>
      {coverage==='included'?<p className="notice">此笔按已含余额的历史补记，不再扣银行现金；日期须在该账户已登记的余额核实日期内。</p>:<p className="help-text">未来工资、预计收益及尚未付款的计划不能记为实际流水。日期须晚于该账户最近余额核实日期；已含余额或无法确认时请保留草稿。</p>}
     </>}
     {kind==='asset'&&<>
      <p className="notice neutral">这里只登记本人已经持有、尚未登记的资产。投资建议和未来购买计划不能计入已有资产；已登记资产请在资产列表核对，勿重复新增。</p>
      <div className="form-grid">{field('name','外部已有资产名称')}<MemberSelect state={state} label="外部资产归属成员" value={payload.ownerMemberId??''} onChange={(id:string)=>update({ownerMemberId:id})}/><AssetTypeSelect state={state} value={payload.assetTypeId??accountAssetType({...payload,kind:payload.category==='loan'?'LIABILITY':'ASSET'},state)?.id} label="外部已有资产类型" onChange={id=>{const type=getAssetTypes(state).find((t:any)=>t.id===id);update({assetTypeId:id,category:type?.baseCategory??''})}}/><label className="field">原币<select aria-label="外部资产原币" value={payload.currency??''} onChange={e=>update({currency:e.target.value})} required><option value="">请选择</option><option>CNY</option><option>USD</option></select></label>{field('amount',payload.category==='loan'?'外部贷款剩余本金（原币）':'外部资产当前余额或市值（原币）')}{field('asOf','外部资产余额核实日期','date')}</div>
      {['stock','fund'].includes(payload.category)&&<div className="form-grid">{field('code','外部资产代码','text',false)}{field('market','外部资产市场','text',false)}{field('quantity','外部已有持仓数量','text',false)}{field('price','外部资产核实单价（原币）','text',false)}{field('cost','外部资产单位成本（原币）','text',false)}</div>}
      {['cash','term_deposit'].includes(payload.category)&&<div className="form-grid">{field('bank','外部资产银行','text',payload.category==='term_deposit')}{field('startDate','外部存款起存日期','date',payload.category==='term_deposit')}{field('annualRate','外部存款年利率 %','text',payload.category==='term_deposit')}{payload.category==='term_deposit'&&field('maturityDate','外部定期到期日期','date')}</div>}
      {payload.category==='loan'&&<div className="form-grid">{field('monthly','外部贷款月供（原币）','text',false)}{field('startDate','外部贷款开始日期','date',false)}{field('maturityDate','外部贷款到期日期','date',false)}{field('rate','外部贷款年利率 %','text',false)}{field('day','外部贷款每月扣款日','number',false)}</div>}
     </>}
     <label className="field">外部分析依据<textarea aria-label="外部分析依据" value={payload.analysis??''} required={kind==='budget'} onChange={e=>update({analysis:e.target.value})}/></label>
     <label className="field">核对备注<textarea aria-label="外部草稿核对备注" value={payload.note??''} onChange={e=>update({note:e.target.value})}/></label>
     {kind!=='budget'&&<label className="mcp-confirmation"><input type="checkbox" checked={actual} onChange={e=>setActual(e.target.checked)}/>{kind==='asset'?'我已确认这是已经实际持有的资产，归属与原币金额正确，且未重复登记':'我已确认收入已到账或支出已支付，实际日期、成员与现金账户正确'}</label>}
     <label className="mcp-confirmation"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/>我已逐项核对外部分析、金额、来源及{kind==='budget'?'费用和行程':'实际事实'}，同意采用当前填写内容</label>
     {error&&<p className="notice" role="alert">{error}</p>}
     <div className="mcp-review-actions"><button className="btn primary" type="submit" disabled={!reviewed||kind!=='budget'&&!actual||kind==='cashflow'&&(coverage!=='uncovered'&&(coverage!=='included'||!state.accounts.find((a:any)=>a.id===payload.accountId)?.metadata?.asOf||payload.date>(payload.snapshotDate??state.accounts.find((a:any)=>a.id===payload.accountId)?.metadata?.asOf)))}>{saving?'正在保存…':kind==='budget'?'采用并提交家庭审批':kind==='cashflow'?'采用并记录实际流水':'采用并登记已有资产'}</button><button className="btn" type="button" onClick={()=>setRejecting(!rejecting)}>{rejecting?'取消拒绝':'拒绝此草稿'}</button></div>
     {rejecting&&<div className="mcp-reject"><label className="field">拒绝原因（可选）<input aria-label="外部草稿拒绝原因" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label><p className="help-text">拒绝会保留原稿与处理记录；可回到 ChatGPT 修改分析后重新提交。</p><button className="btn" type="button" onClick={reject}>确认拒绝并保留历史</button></div>}
    </fieldset>
   </form>
  </details>
 </article>;
}

function BudgetDraftFields({draft,onChange}:{draft:any;onChange:(draft:any)=>void}){
 const value=draft??{kind:'general',items:[],itinerary:[],comparisons:[]};
 const change=(patch:any)=>onChange({...value,...patch,reviewed:false});
 const item=(index:number,patch:any)=>change({items:(value.items??[]).map((x:any,i:number)=>i===index?{...x,...patch,...(['unitPrice','merchant','name'].some(key=>Object.hasOwn(patch,key)&&patch[key]!==x[key])?{sourceType:'user_quote',sourceUrl:null,checkedAt:null,priceEvidence:null}:{})}:x)});
 let total='待补齐';try{total=decimal(normalizeExpenseDraft(value,{requireReview:false}).totalMinor)+' CNY'}catch{}
 return <section className="mcp-budget-items" aria-label="外部预算费用和行程"><div className="mcp-inbox-heading"><h3>核对费用与行程</h3><strong className="money">{total}</strong></div>
  <p className="help-text">参考报价不代表成交价。无可核验来源的金额属于情景估算；更改商家、名称或价格后按本人填写参考处理。</p>
  <label className="field">消费场景<select aria-label="外部预算消费场景" value={value.kind??'general'} onChange={e=>change({kind:e.target.value})}><option value="travel">旅行</option><option value="shopping">购物</option><option value="dining">餐饮</option><option value="general">其他消费</option></select></label>
  {(value.items??[]).map((x:any,i:number)=><article className="mcp-budget-item" key={x.id??i}>
   <div className="mcp-item-heading"><label className="mcp-confirmation"><input type="checkbox" aria-label={'外部预算纳入项目 '+(i+1)} checked={x.selected!==false} onChange={e=>item(i,{selected:e.target.checked})}/>计入预算 {i+1}</label><button type="button" className="text-button" onClick={()=>change({items:value.items.filter((_:any,j:number)=>j!==i)})}>移除费用 {i+1}</button></div>
   <div className="form-grid"><label className="field">项目<input aria-label={'外部费用名称 '+(i+1)} value={x.name??''} required onChange={e=>item(i,{name:e.target.value})}/></label><label className="field">数量<input aria-label={'外部费用数量 '+(i+1)} value={x.quantity??'1'} required onChange={e=>item(i,{quantity:e.target.value})}/></label><label className="field">单价 CNY<input aria-label={'外部费用单价 '+(i+1)} value={x.unitPrice??(x.amount!=null?decimal(x.amount):'')} required onChange={e=>item(i,{unitPrice:e.target.value})}/></label><label className="field">商家<input aria-label={'外部费用商家 '+(i+1)} value={x.merchant??''} onChange={e=>item(i,{merchant:e.target.value})}/></label><label className="field">类别<input aria-label={'外部费用类别 '+(i+1)} value={x.category??'其他'} onChange={e=>item(i,{category:e.target.value})}/></label><label className="field">关联行程<select aria-label={'外部费用关联行程 '+(i+1)} value={x.itineraryId??''} onChange={e=>item(i,{itineraryId:e.target.value||null})}><option value="">独立费用</option>{(value.itinerary??[]).map((a:any,j:number)=><option key={a.id??j} value={a.id??'activity-'+j}>{a.date} · {a.title}</option>)}</select></label></div>
   <p className="mcp-price-boundary">{x.sourceType==='retrieved_reference'&&safeLink(x.sourceUrl)&&x.checkedAt&&x.priceEvidence?'检索参考 · 非实时成交价':x.sourceType==='user_quote'?'本人填写 · 参考报价':'情景估算 · 未核验报价'}{safeLink(x.sourceUrl)&&<> · <a href={safeLink(x.sourceUrl)} target="_blank" rel="noreferrer">查看来源</a></>}{x.checkedAt&&<> · 查询时间 {x.checkedAt}</>}</p>{x.priceEvidence&&<blockquote>{x.priceEvidence}</blockquote>}
   <label className="field">费用备注<input aria-label={'外部费用备注 '+(i+1)} value={x.note??''} onChange={e=>item(i,{note:e.target.value})}/></label>
  </article>)}
  <button className="text-button" type="button" disabled={(value.items??[]).length>=50} onClick={()=>change({items:[...(value.items??[]),{id:crypto.randomUUID(),name:'',quantity:'1',unitPrice:'',category:'其他',selected:true,sourceType:'user_quote'}]})}>添加外部预算费用</button>
  {(value.itinerary??[]).map((a:any,i:number)=><article className="mcp-budget-item" key={a.id??i}><h4>行程 {i+1}</h4>{(['date','time','title','notes'] as const).map(key=><label className="field" key={key}>{{date:'日期',time:'时间',title:'安排',notes:'备注'}[key]}<input aria-label={'外部行程'+{date:'日期',time:'时间',title:'安排',notes:'备注'}[key]+' '+(i+1)} type={key==='date'?'date':'text'} value={a[key]??''} required={key==='date'||key==='title'} onChange={e=>change({itinerary:value.itinerary.map((x:any,j:number)=>i===j?{...x,[key]:e.target.value}:x)})}/></label>)}<button className="text-button" type="button" onClick={()=>change({itinerary:value.itinerary.filter((_:any,j:number)=>i!==j),items:value.items.map((x:any)=>x.itineraryId===a.id?{...x,itineraryId:null}:x)})}>移除行程 {i+1}并解除费用关联</button></article>)}
  <button className="text-button" type="button" disabled={(value.itinerary??[]).length>=80} onClick={()=>change({itinerary:[...(value.itinerary??[]),{id:crypto.randomUUID(),date:'',time:'',title:'',notes:''}]})}>添加外部行程安排</button>
  {value.comparisons?.length>0&&<details className="mcp-analysis"><summary>原始商品比价参考</summary>{value.comparisons.map((c:any,i:number)=><p key={i}>{c.title} · {c.merchant} · {c.version} · {c.price??'未核价'} · {c.checkedAt??'查询时间未提供'}{safeLink(c.url)&&<> · <a href={safeLink(c.url)} target="_blank" rel="noreferrer">参考来源</a></>} · {c.note}</p>)}</details>}
 </section>;
}
