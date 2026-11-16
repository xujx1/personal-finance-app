import {snapshot} from '../../src/server/finance-store.ts';
import {getMonthlyContext} from '../../src/server/mcp-queries.ts';
import {buildMonthlyReportDocument} from '../../src/server/monthly-report-document.ts';

// A checked narrative is a prerequisite for new archives. Directly seed the
// review in low-level archive tests; separate MCP tests exercise its adoption.
export async function reviewedMonthlyDocument(db,month){
 const state=await snapshot(db),basis=await getMonthlyContext(db,state,month);
 const review={month,title:'样本已核对月刊',summary:'样本账目总结',sections:[{heading:'本月回顾',body:'基于测试账本已核对'}],limitations:['独立模拟数据'],nextActions:[],acceptedAt:new Date().toISOString(),basisFingerprint:basis.basisFingerprint,basis};
 await db.prepare('INSERT INTO documents VALUES(?,?,?,?) ON CONFLICT(dataset_id,id) DO UPDATE SET payload=excluded.payload').bind(state.book.active_dataset,'test-monthly-summary:'+month,'monthly_review',JSON.stringify(review)).run();
 return buildMonthlyReportDocument(db,await snapshot(db),month);
}
