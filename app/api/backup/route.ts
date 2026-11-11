// Backup and restore were removed from the product by request.
export const POST=async()=>Response.json({error:'备份与恢复功能已停用，请以数据库为准'},{status:410});
