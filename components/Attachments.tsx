"use client";

import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import './Attachments.css';

// Small user-selected blob URLs stay local and do not use the image optimizer.
/* eslint-disable @next/next/no-img-element */
type AttachmentDocument={id:string;kind:string;payload:{planId?:string;archived?:boolean;name?:string;size?:number}};
type AttachmentProps={planId:string;state:{documents:AttachmentDocument[];viewer?:{canWrite?:boolean}};onRefresh:()=>unknown|Promise<unknown>;onSave:(action:string,body:{id:string})=>unknown|Promise<unknown>};

const acceptedTypes=['application/pdf','image/png','image/jpeg','image/webp'];
function selectionError(file:File|null){
 if(!file)return '';
 if(!acceptedTypes.includes(file.type))return '请选择 PDF、PNG、JPEG 或 WebP 格式的附件。';
 if(file.size===0)return '文件为空，请重新选择票据附件。';
 if(file.size>524288)return '附件最大 512KB，请先裁剪或压缩后重新选择。';
 if(file.name.length>150)return '文件名过长，请缩短后重新选择（最多150个字符）。';
 return '';
}

export default function Attachments({planId,state,onRefresh,onSave}:AttachmentProps){
 const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const [error,setError]=useState(''),[status,setStatus]=useState('');
 const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
 const input=useRef<HTMLInputElement>(null),pending=useRef<string|null>(null),busyRef=useRef(false);
 const id=useId(),canWrite=state.viewer?.canWrite!==false;
 const files=state.documents.filter(d=>d.kind==='attachment'&&d.payload.planId===planId&&!d.payload.archived);
 const invalid=selectionError(file);

 useEffect(()=>{
  if(preview)return ()=>URL.revokeObjectURL(preview);
 },[preview]);

 function choose(next:File|null){
  if(busyRef.current||!canWrite)return;
  setPreview(next&&!selectionError(next)&&next.type.startsWith('image/')?URL.createObjectURL(next):'');
  setFile(next);setConfirmed(false);setError(selectionError(next));setStatus('');pending.current=null;
 }
 function clear(){
  if(busyRef.current||!canWrite)return;
  choose(null);if(input.current)input.current.value='';input.current?.focus();
 }
 async function submit(event:FormEvent){
  event.preventDefault();
  if(!canWrite||!file||busyRef.current||!confirmed||invalid)return;
  busyRef.current=true;setBusy(true);setError('');setStatus('');
  async function finish(){
   pending.current=null;setFile(null);setPreview('');setConfirmed(false);if(input.current)input.current.value='';
   setStatus(`已保存附件：${file!.name}。`);
   try{await onRefresh();}catch{setStatus(`已保存附件：${file!.name}。列表暂未刷新，请刷新页面查看。`);}
  }
  try{
   if(pending.current){
    const check=await fetch('/api/finance?command_key='+encodeURIComponent('attachment:'+pending.current),{cache:'no-store'});
    if(!check.ok)throw Error('上次保存结果暂时无法核实，请稍后重试。');
    const saved=await check.json() as {status?:string};
    if(saved.status==='committed'){await finish();return;}
    if(saved.status!=='not_found')throw Error('上次保存结果暂时无法核实，请稍后重试。');
   }
   const data=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=()=>reject(Error('文件读取失败，请重新选择附件。'));reader.readAsDataURL(file);
   });
   if(!pending.current)pending.current=crypto.randomUUID();
   const response=await fetch('/api/attachments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId,name:file.name,mime:file.type,data,confirmed:true,key:pending.current})});
   const result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||'保存暂未完成，请稍后重试。');
   await finish();
  }catch(cause){
   setConfirmed(false);
   const message=cause instanceof Error?cause.message:'';
   setError(`${message&&message!=='Failed to fetch'?message:'连接中断，暂时无法确认保存结果。'} 已保留所选文件，请重新勾选确认后重试；同一次重试不会重复保存。`);
  }finally{busyRef.current=false;setBusy(false);}
 }
 async function archive(id:string){
  if(!canWrite||busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');setStatus('');
  try{await onSave('attachment.archive',{id});}
  catch{setError('附件归档未完成，请稍后重试。所选文件已保留。');}
  finally{busyRef.current=false;setBusy(false);}
 }

 return <section className="card section-space attachments-panel" aria-label="票据与附件" aria-busy={busy}>
  <h2>票据与附件</h2>
  <p className="help-text" id={id+'-help'}>仅在你明确保存后加密存入私人账本。支持 PDF、PNG、JPEG、WebP，单份最大 512KB，每计划最多20份。</p>
  {!canWrite&&<p className="help-text">当前为只读访问，可下载已保存附件；保存和归档需由管理员操作。</p>}
  <form onSubmit={submit} className="attachment-form">
   <label className="field">选择票据附件<input ref={input} type="file" accept={acceptedTypes.join(',')} disabled={!canWrite||busy} aria-invalid={Boolean(invalid)} aria-describedby={[id+'-help',error?id+'-error':''].filter(Boolean).join(' ')} onChange={event=>choose(event.target.files?.[0]??null)}/></label>
   {file&&<div className="attachment-selection">
    <div className="attachment-selection-info"><strong className="attachment-filename">{file.name}</strong><span>{file.size<1024?`${file.size} 字节`:`${(file.size/1024).toLocaleString('zh-CN',{maximumFractionDigits:1})} KB`}</span></div>
    {preview&&<><img className="attachment-preview" src={preview} alt="待保存附件预览"/><p className="help-text">本地预览可能含票据金额；确认保存后才会上传。</p></>}
    <button type="button" className="btn" disabled={!canWrite||busy} onClick={clear}>清除所选文件</button>
   </div>}
   <label className="attachment-consent"><input type="checkbox" checked={confirmed} required disabled={!canWrite||busy||!file||Boolean(invalid)} onChange={event=>setConfirmed(event.target.checked)}/><span>确认将此附件私密保存到该计划</span></label>
   <div className="attachment-actions"><button type="submit" className="btn primary" disabled={!canWrite||!file||busy||!confirmed||Boolean(invalid)}>{busy?'保存中…':'保存附件'}</button></div>
  </form>
  {error&&<p className="notice attachment-message" id={id+'-error'} role="alert">{error}</p>}
  {status&&<p className="attachment-message attachment-success" role="status">{status}</p>}
  <div className="attachment-saved-list">{files.map(document=><div className="attachment-saved-item" key={document.id}>
   <a className="attachment-filename" href={'/api/attachments?id='+encodeURIComponent(document.id)}>{document.payload.name}</a>
   <span>{Math.ceil((document.payload.size??0)/1024)} KB</span>
   <button type="button" className="text-button" disabled={!canWrite||busy} onClick={()=>archive(document.id)}>归档附件</button>
  </div>)}</div>
 </section>;
}
