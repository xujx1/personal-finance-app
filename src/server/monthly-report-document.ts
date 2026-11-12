import {evidenceHash,getMonthlyContext,listLedgerTransactions,strictKeys} from './mcp-queries.ts';
import {assertLedgerAccess} from './ledger-scope.ts';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const nextMonthOf=(month:string)=>{const [year,m]=month.split('-').map(Number);return String(year+(m===12?1:0)).padStart(4,'0')+'-'+String(m===12?1:m+1).padStart(2,'0');};
const checkMonth=(month:any)=>{
 if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<'0001-01')throw Error('月份无效');
 if(month>today().slice(0,7))throw Error('不能生成或保存未来月份报告');
 return month;
};
const copy=(value:any)=>JSON.parse(JSON.stringify(value));
const semanticBasis=(basis:any)=>({month:basis.month,report:basis.report,memberCashflow:basis.memberCashflow,memberJournalActivity:basis.memberJournalActivity,plans:basis.plans,goal:basis.goal,monthlyAccumulation:basis.monthlyAccumulation,rules:basis.rules,accounts:basis.accounts,forecast:basis.forecast});

/** Freeze server-derived report facts; this function never changes the ledger. */
export async function buildMonthlyReportDocument(db:any,state:any,month:string,context?:any){
 checkMonth(month);await assertLedgerAccess(db);
 const basis=context??await getMonthlyContext(db,state,month);
 if(basis.month!==month||basis.data_revision!==state.book.revision)throw Error('CONFLICT:月报依据已变化，请重新读取');
 const [year,m]=month.split('-').map(Number),from=month+'-01',through=month+'-'+String(new Date(Date.UTC(year,m,0)).getUTCDate()).padStart(2,'0');
 const flows:any[]=[];let cursor:string|null=null;
 do{
  const page=await listLedgerTransactions(db,state,{from,through,limit:100,expected_revision:state.book.revision,...(cursor?{cursor}:{})});
  for(const row of page.rows){
   // Ownership snapshots contain the original name/category even if today's
   // account directory has since been edited. Amounts come from posted entries.
   const cashChanges=row.entries.flatMap((entry:any)=>{
    const owner=row.accountOwners.find((o:any)=>o.accountId===entry.accountId),account=state.accounts.find((a:any)=>a.id===entry.accountId);
    if((owner?.category??account?.category)!=='cash'||account?.kind!=='ASSET')return [];
    return [{accountId:entry.accountId,accountName:owner?.accountName??account.name,memberId:owner?.memberId??'unknown',memberName:owner?.memberName??'归属待确认',currency:entry.currency,amountMinor:entry.amountMinor}];
   });
   flows.push({...row,cashChanges});
  }
  cursor=page.nextCursor;
 }while(cursor);
 const nextMonth=nextMonthOf(month),forecast=basis.forecast?.find((row:any)=>row.month===nextMonth),available=month===today().slice(0,7)&&!!forecast;
 const nextMonthForecast=available?{...forecast,month:nextMonth,available:true,asOf:basis.asOf,reason:null}:{month:nextMonth,available:false,asOf:null,reason:month<today().slice(0,7)?'历史预览不重建当时预测；如已保存报告，请切换到对应版本查看预测快照':'当前预测未覆盖下个月',opening:null,income:null,fixed:null,planned:null,pending:null,closing:null,unknown:null};
 const review=state.documents.filter((d:any)=>d.kind==='monthly_review'&&d.payload.month===month&&typeof d.payload.acceptedAt==='string'&&d.payload.acceptedAt).sort((a:any,b:any)=>b.payload.acceptedAt.localeCompare(a.payload.acceptedAt)||b.id.localeCompare(a.id))[0];
 let aiReview:any=null;
 if(review){
  const {basis:storedBasis,...payload}=review.payload;let stale=payload.basisFingerprint!==basis.basisFingerprint;
  // Old accepted summaries retain their full server basis. Compare its facts
  // when available so a new observation date alone cannot stale the summary.
  if(stale&&storedBasis?.month===month&&storedBasis.report)stale=await evidenceHash(semanticBasis(storedBasis))!==await evidenceHash(semanticBasis(basis));
  aiReview={id:review.id,...payload,stale};
 }
 const document:any={schemaVersion:1,month,asOf:basis.asOf,sourceRevision:state.book.revision,basisFingerprint:basis.basisFingerprint,ledger:basis.report,memberCashflow:basis.memberCashflow,memberJournalActivity:basis.memberJournalActivity,monthlyAccumulation:basis.monthlyAccumulation,goal:basis.goal,flows,nextMonth:nextMonthForecast,aiReview,coverage:basis.coverage};
 // Context's basisFingerprint includes its observation date. Hash the underlying
 // facts instead, so merely saving an archive or rereading it on another day
 // cannot create another version. Current forecast values remain part of it.
 const {asOf,sourceRevision,basisFingerprint,...content}=document;void asOf;void sourceRevision;void basisFingerprint;
 const {asOf:forecastAsOf,...forecastContent}=nextMonthForecast;void forecastAsOf;
 document.fingerprint=await evidenceHash({...content,nextMonth:forecastContent,basis:{plans:basis.plans,rules:basis.rules,accounts:basis.accounts,forecast:basis.forecast}});
 return copy(document);
}

export async function extendMonthlyReports(c:any){
 if(c.action!=='monthly.report.save')return false;
 const {body,db,state,ds,rows,result}=c;strictKeys(body,['month','expectedFingerprint']);checkMonth(body.month);
 if(typeof body.expectedFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(body.expectedFingerprint))throw Error('月报指纹无效，请重新读取报告');
 await assertLedgerAccess(db,true);
 if(ds!==state.book.active_dataset)throw Error('CONFLICT:账本已变化，请重新读取月报');
 const document=await buildMonthlyReportDocument(db,state,body.month);
 if(document.fingerprint!==body.expectedFingerprint)throw Error('CONFLICT:月报内容已变化，请重新核对后保存');
 const archives=state.documents.filter((d:any)=>d.kind==='monthly_report_archive'&&d.payload.month===body.month),existing=archives.find((d:any)=>d.payload.fingerprint===document.fingerprint);
 if(existing){Object.assign(result,{id:existing.id,version:existing.payload.version,fingerprint:document.fingerprint});return true;}
 const version=archives.reduce((max:number,d:any)=>Math.max(max,Number.isSafeInteger(d.payload.version)&&d.payload.version>0?d.payload.version:0),0)+1;
 if(!Number.isSafeInteger(version))throw Error('月报版本超出范围');
 const id=crypto.randomUUID(),payload={month:body.month,version,fingerprint:document.fingerprint,createdAt:new Date().toISOString(),sourceRevision:state.book.revision,document};
 // Deliberately INSERT only: an archive can never use the generic document
 // upsert path to overwrite an existing version.
 rows.push(db.prepare('INSERT INTO documents VALUES(?,?,?,?)').bind(ds,id,'monthly_report_archive',JSON.stringify(payload)));
 Object.assign(result,{id,version,fingerprint:document.fingerprint});return true;
}
