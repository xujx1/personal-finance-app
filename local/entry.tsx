import FamilyPanel from '../components/FamilyPanel';
import React from 'react';
import {createRoot} from 'react-dom/client';
import FinanceApp from '../components/FinanceApp';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<><div style={{background:'#fff1cf',padding:'8px 16px',fontSize:12,textAlign:'center',position:'relative',zIndex:100}}>本地体验 · 模拟账本，与正式财务数据隔离</div>{window.location.pathname==='/join'?<main><FamilyPanel joinOnly/></main>:<FinanceApp displayName="本地测试"/>}</>);
