import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLocale,preferredLocale,translate,translateMessage,formatMinor,formatCalendarDate,assetTypeLabel,memberLabel,englishMessages} from '../src/domain/i18n.mjs';

test('locale resolution honors a saved choice, browser languages and the Chinese fallback',()=>{
 assert.equal(normalizeLocale('EN-gb'),'en-US');assert.equal(normalizeLocale('zh_Hans'),'zh-CN');assert.equal(normalizeLocale('fr-FR'),null);
 assert.equal(preferredLocale('zh-CN',['en-US']),'zh-CN');assert.equal(preferredLocale('invalid',['fr-FR','en-GB']),'en-US');assert.equal(preferredLocale(null,[]),'zh-CN');
});
test('the bilingual catalog preserves every interpolation parameter and has complete English values',()=>{
 const tokens=s=>[...s.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(m=>m[1]).sort();
 assert.ok(Object.keys(englishMessages).length>2500);
 for(const [key,value] of Object.entries(englishMessages)){assert.ok(value.trim(),key);assert.deepEqual(tokens(value),tokens(key),key);assert.doesNotMatch(value,/[\u3400-\u9fff]/,key);assert.equal(translate(key,{},'zh-CN'),key);}
 assert.equal(translate(undefined,{},'en-US'),undefined,'unknown enum values must still reach the original fallback');
 for(const unknown of ['constructor','toString','__proto__'])assert.equal(translate(unknown,{},'en-US'),unknown);
 assert.equal(translate('邀请你加入「{p0}」',{p0:'我们的家庭'},'en-US').includes('我们的家庭'),true);
});
test('service messages translate exact and parameterized errors without changing interpolated record names',()=>{
 assert.equal(translateMessage('现金余额不足','en-US'),'Insufficient cash balance.');
 assert.equal(translateMessage('CONFLICT:未预料的新版本提示','en-US'),'The data changed. Refresh and review it again.');
 const result=translateMessage('移除 模拟成员？对方将失去家庭资料访问权限，历史资产和流水会保留。','en-US');assert.match(result,/Remove 模拟成员/);assert.doesNotMatch(result,/对方/);
 assert.equal(translateMessage('现金余额不足','zh-CN'),'现金余额不足');assert.equal(translateMessage('Unrecognized error','en-US'),'Unrecognized error');
});
test('money presentation is exact in integer minor units through the safe-integer boundary',()=>{
 assert.equal(formatMinor(123456,'CNY','zh-CN'),'¥1,234.56');assert.equal(formatMinor(-1,'CNY','en-US'),'-CN¥0.01');assert.equal(formatMinor(123456,'USD','en-US'),'$1,234.56');
 assert.equal(formatMinor(Number.MAX_SAFE_INTEGER,'CNY','en-US'),'CN¥90,071,992,547,409.91');assert.equal(formatMinor(Number.MAX_SAFE_INTEGER+1,'CNY','en-US'),'Unknown');assert.equal(formatMinor(null,'CNY','en-US'),'Unknown');
});
test('changing locale or display timezone never moves a date-only business date',()=>{
 assert.equal(formatCalendarDate('2026-11-13','en-US'),'Nov 13, 2026');assert.match(formatCalendarDate('2026-11-13','zh-CN'),/13/);
 assert.equal(formatCalendarDate('2026-11-13','en-US',{timeZone:'America/Los_Angeles'}),'Nov 13, 2026');assert.equal(formatCalendarDate('2026-02-30','en-US'),'2026-02-30');
});
test('only original built-in asset and shared-member labels are translated',()=>{
 const original={id:'cash',name:'银行现金',builtin:true};assert.equal(assetTypeLabel(original,'en-US'),translate('银行现金',{},'en-US'));
 assert.equal(assetTypeLabel({...original,name:'我的银行'},'en-US'),'我的银行');assert.equal(assetTypeLabel({...original,id:'custom_cash',builtin:false},'en-US'),'银行现金');assert.equal(assetTypeLabel({...original,builtin:false},'en-US'),'银行现金');
 assert.equal(memberLabel({id:'family',name:'家庭共用'},'en-US'),'Shared household');assert.equal(memberLabel({id:'user:1',name:'家庭共用'},'en-US'),'家庭共用');assert.equal(memberLabel({id:'family',name:'自定义共同归属'},'en-US'),'自定义共同归属');
 assert.deepEqual(original,{id:'cash',name:'银行现金',builtin:true});
});
