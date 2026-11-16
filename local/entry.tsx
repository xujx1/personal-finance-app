import FamilyPanel from '../components/FamilyPanel';
import React from 'react';
import {createRoot} from 'react-dom/client';
import FinanceApp from '../components/FinanceApp';
import {I18nProvider,UiText} from '../components/I18n';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<I18nProvider><div style={{background:'#fff1cf',padding:'8px 16px',fontSize:12,textAlign:'center',position:'relative',zIndex:100}}><UiText text="本地体验 · 模拟账本，与正式财务数据隔离"/></div>{window.location.pathname==='/join'?<main><FamilyPanel joinOnly/></main>:<FinanceApp displayName="本地测试"/>}</I18nProvider>);
