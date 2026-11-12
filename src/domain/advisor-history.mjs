import {decimal} from './finance.mjs';
const normalize = value => typeof value === 'string' ? value.toLowerCase().replace(/\s/gu, '') : '';

export function fuzzyMatchHistory(text, query) {
  const needle = [...normalize(query)];
  if (needle.length === 0) return true;
  let index = 0;
  for (const character of normalize(text)) {
    if (character === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}

export function getHistoryPage(records, query = '', requestedPage = 1) {
  const matching = (Array.isArray(records) ? records : []).filter(record =>
    record && typeof record === 'object' && !Array.isArray(record) &&
    (fuzzyMatchHistory(record.payload?.inputs?.question, query) || fuzzyMatchHistory(record.payload?.summary, query) || fuzzyMatchHistory(record.payload?.modelSummary, query))
  );
  const total = matching.length;
  const totalPages = Math.max(1, Math.ceil(total / 5));
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  return {records: matching.slice((page - 1) * 5, page * 5), total, totalPages, page};
}

export function researchHistoryForm(payload,today){return {intent:'expense',question:payload.question??payload.title??'',date:payload.date??today,tripEnd:payload.end??payload.date??today,budget:payload.budget==null?'':decimal(payload.budget),planId:undefined,adults:undefined,babies:undefined};}
export function newExpenseQuestion(form,question){return {...form,question,adults:undefined,babies:undefined,tripEnd:undefined};}
