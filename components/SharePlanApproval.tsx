"use client";
import {useState} from 'react';
import AccessibleDialog from './AccessibleDialog';
import {approvalLink} from '../src/domain/plan-approval-view.mjs';
export default function SharePlanApproval({planId}:{planId:string}){
 const [link,setLink]=useState(''),[message,setMessage]=useState('');
 return <><button type="button" className="btn soft" onClick={()=>{setMessage('');setLink(approvalLink(window.location.origin,planId))}}>分享审批</button>{link&&<AccessibleDialog title="分享家庭审批" onClose={()=>setLink('')}><p className="help-text">把链接发给家人，登录后即可查看当前方案并确认。仅同一家庭的有效成员可查看，链接不会自动加入家庭或代替同意。</p><label className="field section-space">审批链接<input aria-label="审批链接" readOnly value={link} onFocus={e=>e.currentTarget.select()}/></label><button type="button" className="btn primary" onClick={async()=>{try{await navigator.clipboard.writeText(link);setMessage('审批链接已复制，可发送给家人')}catch{setMessage('请长按或选中上方链接复制')}}}>复制审批链接</button><p role="status" className="help-text">{message}</p></AccessibleDialog>}</>;
}
