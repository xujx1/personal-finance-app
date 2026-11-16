"use client";
import {useState} from 'react';
import AccessibleDialog from './AccessibleDialog';
import {approvalLink} from '../src/domain/plan-approval-view.mjs';
import {useI18n} from './I18n';

export default function SharePlanApproval({planId}:{planId:string}){
 const {t:tr,locale:uiLocale,message:uiMessage,assetType:uiAssetType,member:uiMember}=useI18n();

 const [link,setLink]=useState(''),[message,setMessage]=useState('');
 return <><button type="button" className="btn soft" onClick={()=>{setMessage('');setLink(approvalLink(window.location.origin,planId))}}>{tr("分享审批")}</button>{link&&<AccessibleDialog title={tr("分享家庭审批")} onClose={()=>setLink('')}><p className="help-text">{tr("把链接发给家人，登录后即可查看当前方案并确认。仅同一家庭的有效成员可查看，链接不会自动加入家庭或代替同意。")}</p><label className="field section-space">{tr("审批链接")}<input aria-label={tr("审批链接")} readOnly value={link} onFocus={e=>e.currentTarget.select()}/></label><button type="button" className="btn primary" onClick={async()=>{try{await navigator.clipboard.writeText(link);setMessage('审批链接已复制，可发送给家人')}catch{setMessage('请长按或选中上方链接复制')}}}>{tr("复制审批链接")}</button><p role="status" className="help-text">{uiMessage(message)}</p></AccessibleDialog>}</>;
}
