"use client";
import {Children,cloneElement,createContext,isValidElement,useContext,type ReactNode} from 'react';
import {redactFinancialText} from '../src/domain/financial-privacy.mjs';
import './FinancialPrivacy.css';

const PrivacyContext=createContext(true);
export function FinancialPrivacyProvider({hidden=true,children}:{hidden?:boolean;children:ReactNode}){return <PrivacyContext.Provider value={hidden}>{children}</PrivacyContext.Provider>;}
export const useFinancialPrivacy=()=>useContext(PrivacyContext);
export function SensitiveValue({children,className=''}:{children:ReactNode;className?:string}){const hidden=useFinancialPrivacy();return <span className={'sensitive-value '+className} data-financial-private={hidden?'hidden':'visible'}>{hidden?<span aria-label="财务数值已隐藏">••••</span>:children}</span>;}
function redactNodes(nodes:ReactNode):ReactNode{
 const output:ReactNode[]=[];let text='';const flush=()=>{if(text){output.push(redactFinancialText(text));text='';}};
 Children.forEach(nodes,node=>{if(typeof node==='string'||typeof node==='number'){text+=node;return;}flush();if(isValidElement<{children?:ReactNode}>(node))output.push(cloneElement(node,{},redactNodes(node.props.children)));else output.push(node);});flush();return output;
}
export function SensitiveText({children,text}:{children?:ReactNode;text?:string}){const hidden=useFinancialPrivacy();return <>{hidden?redactNodes(text??children):text??children}</>;}
export function PrivacyEditNotice(){return useFinancialPrivacy()?<p className="privacy-edit-notice" role="note">当前已隐藏展示金额；编辑与核对输入框仍显示原值，请留意周围环境。</p>:null;}
