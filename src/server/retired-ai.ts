/** These URLs remain explicit tombstones for old bookmarks; no model is invoked. */
export const retiredAIResponse=()=>Response.json({code:'CHATGPT_WORKFLOW',error:'此AI能力已迁移到ChatGPT。请在ChatGPT选择家庭财务中心完成分析并保存草稿，再回站点核对。',workflowPath:'/'},{status:410,headers:{'Cache-Control':'no-store'}});
