import test from 'node:test';
import assert from 'node:assert/strict';
import {fuzzyMatchHistory, getHistoryPage} from '../src/domain/advisor-history.mjs';

test('history search matches an ordered subsequence ignoring case and whitespace', () => {
  assert.equal(fuzzyMatchHistory('Coffee purchase', ' c F p '), true);
  assert.equal(fuzzyMatchHistory('模拟咖啡采购', '咖 啡'), true);
  assert.equal(fuzzyMatchHistory('咖 啡 采购', '咖啡'), true);
  assert.equal(fuzzyMatchHistory('咖啡采购', '啡咖'), false);
  assert.equal(fuzzyMatchHistory('Coffee', 'coffees'), false);
  assert.equal(fuzzyMatchHistory('anything', ' \t\n'), true);
});

test('history search finds questions and summaries without changing record identity or order', () => {
  const records = [
    {id: 'question', payload: {inputs: {question: '咖啡机是否合适'}, summary: '家用电器'}},
    {id: 'summary', payload: {inputs: {question: '家庭用品'}, summary: 'Coffee machine purchase'}},
    {id: 'other', payload: {inputs: {question: '旅行预算'}, summary: '出行'}},
  ];
  const chinese = getHistoryPage(records, '咖 啡');
  assert.deepEqual(chinese.records.map(record => record.id), ['question']);
  assert.equal(chinese.records[0], records[0]);
  assert.deepEqual(getHistoryPage(records, 'C F M').records.map(record => record.id), ['summary']);
  assert.deepEqual(getHistoryPage(records, '').records, records);
  assert.equal(records.length, 3);
});

test('history pagination shows five records and clamps stale page requests', () => {
  const records = Array.from({length: 12}, (_, index) => ({id: index, payload: {inputs: {question: `评估 ${index}`}}}));
  const second = getHistoryPage(records, '', 2);
  assert.deepEqual(second.records.map(record => record.id), [5, 6, 7, 8, 9]);
  assert.equal(second.page, 2);
  assert.equal(second.totalPages, 3);
  assert.equal(second.total, 12);
  assert.deepEqual(getHistoryPage(records, '', 99).records.map(record => record.id), [10, 11]);
  assert.equal(getHistoryPage(records, '', 0).page, 1);
  assert.equal(getHistoryPage(records, '', Number.NaN).page, 1);
  assert.equal(getHistoryPage(records, '评估 11', 3).page, 1);
});

test('empty and malformed historical data does not throw or turn objects into search text', () => {
  assert.deepEqual(getHistoryPage(null, '咖啡'), {records: [], total: 0, totalPages: 1, page: 1});
  const records = [null, undefined, false, [], {id: 'missing'}, {id: 'null', payload: null},
    {id: 'malformed', payload: {inputs: {question: {name: '咖啡'}}, summary: ['咖啡']}},
    {id: 'summary', payload: {inputs: null, summary: '咖啡预算'}}];
  assert.deepEqual(getHistoryPage(records, '咖啡').records.map(record => record.id), ['summary']);
  assert.deepEqual(getHistoryPage(records, '').records.map(record => record.id), ['missing', 'null', 'malformed', 'summary']);
  assert.equal(fuzzyMatchHistory(null, 'anything'), false);
  assert.equal(fuzzyMatchHistory({text: 'anything'}, 'object'), false);
  assert.equal(fuzzyMatchHistory('anything', {}), true);
});

test('restoring an unrelated research draft clears an existing plan target and stale travel fields',async()=>{const {researchHistoryForm}=await import('../src/domain/advisor-history.mjs');const old={intent:'expense',planId:'plan-A',adults:9,babies:3,question:'A'};const next=researchHistoryForm({question:'B',date:'2026-11-14',end:'2026-11-15',budget:10000},'2026-11-11');assert.equal({...old,...next}.planId,undefined);assert.equal({...old,...next}.adults,undefined);assert.equal(next.question,'B');assert.equal(next.budget,'100.00');});

test('a new trip question cannot inherit the previous travelers or return date',async()=>{const {newExpenseQuestion}=await import('../src/domain/advisor-history.mjs');const next=newExpenseQuestion({planId:'same-edit',adults:9,babies:3,tripEnd:'2026-11-15',date:'2026-11-14'},'换成下个月的新旅行');assert.equal(next.adults,undefined);assert.equal(next.babies,undefined);assert.equal(next.tripEnd,undefined);assert.equal(next.planId,'same-edit');});
