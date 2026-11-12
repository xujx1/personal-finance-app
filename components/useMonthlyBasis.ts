"use client";
import {useEffect,useState} from 'react';
export function useMonthlyBasis(month:string|undefined,revision:number){
 const [result,setResult]=useState<any>({data:null,loading:Boolean(month),error:''});
 useEffect(()=>{if(!month){setResult({data:null,loading:false,error:''});return;}const controller=new AbortController();setResult({data:null,loading:true,error:''});fetch('/api/reviews?month='+encodeURIComponent(month),{cache:'no-store',signal:controller.signal}).then(async r=>{const data:any=await r.json();if(!r.ok)throw Error(data.error??'月报依据读取失败');if(!controller.signal.aborted)setResult({data,loading:false,error:''})}).catch(e=>{if(!controller.signal.aborted)setResult({data:null,loading:false,error:e.message})});return()=>controller.abort()},[month,revision]);return result;
}
