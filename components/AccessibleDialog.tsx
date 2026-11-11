"use client";

import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';

export default function AccessibleDialog({title,onClose,busy=false,wide=false,children}:{title:string;onClose:()=>void;busy?:boolean;wide?:boolean;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const element=dialog.current,overflow=document.body.style.overflow;
  element?.showModal();document.body.style.overflow='hidden';
  element?.querySelector<HTMLElement>('[data-dialog-content] input:not([type="hidden"]):not([readonly]):not(:disabled),[data-dialog-content] select:not(:disabled)')?.focus();
  return ()=>{element?.close();document.body.style.overflow=overflow;if(trigger?.isConnected)trigger.focus();};
 },[]);
 return <dialog ref={dialog} className={'modal-panel contextual-dialog'+(wide?' wide':'')} aria-labelledby="activeDialogTitle" onCancel={event=>{event.preventDefault();if(!busy)onClose();}} onClick={event=>{if(event.target===event.currentTarget&&!busy)onClose();}}>
  <div className="dialog-interior"><div className="modal-heading"><h2 id="activeDialogTitle">{title}</h2><button type="button" className="icon-button" aria-label="关闭" disabled={busy} onClick={onClose}><X/></button></div><div data-dialog-content>{children}</div></div>
 </dialog>;
}
