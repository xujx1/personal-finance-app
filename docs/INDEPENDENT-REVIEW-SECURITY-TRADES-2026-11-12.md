# 基金股票买入/清仓独立代码审查

审查基线：`231d46a`，对象为当前未提交实现及审查期间主代理的小幅修复。仅审阅和隔离 SQLite 探测；未修改产品代码，未访问线上数据、部署或读取密钥。

## 结论

原发现 1 项 P2 后端校验缺口及 1 项 P3 极值预览问题，均已由主代理修复并经独立有界复测确认。当前未发现影响正常买入、增持、全部清仓、现金加减、手续费一次入账、幂等、家庭隔离或旧卖出路径的未解决重要缺陷。浏览器与真实 HTTP 端到端验证由主代理独立执行，本报告不以单元测试通过替代该验证。

## 已修复：P2 原份额未知时，显式买入省略本次数量仍入账

位置：`src/server/asset-trade.ts` 数量解析及有效性校验（现第 44–46 行）。

初始实现只在 `oldQ !== null` 时要求本次数量。隔离 SQLite 中创建银行 1000.00 和数量未知的基金 100.00，发送 `mode:'buy'`、成交 100.00、手续费 1.00、两项实际确认均为 true，省略 quantity：请求成功，银行变为 899.00、持仓变为 200.00，流水的本次数量为 null。这违反设计要求买入必须记录实际成交数量，也使后续无法从该笔流水核对成交份额。前端 required 不能保证命令入口契约。

主代理增加 `mode==='buy' && q===null` 拒绝条件，并补了回归用例。独立复测确认：省略、空字符串、零、九位小数均拒绝，整个快照不变；`0.00000001` 成功保存本次流水数量，原总份额保持未知，银行仅减少 101.00。

## 已修复：P3 极大但单项合法的金额和费用导致现金预览渲染抛错

原位置：`components/SecurityTrade.tsx` 的 impact 计算及银行现金预览。修复移至 `src/domain/security-trade.mjs` 的 `securityTradeImpact`，组件捕获其异常。

`impact` 的 try 仅验证两个输入各自能转为分，随后 JSX 在 try 外用 `decimal(Math.abs(impact.delta))` 和 `decimal(impact.after)`。例如买入金额 `90000000000.00` 与手续费 `1.00` 都分别通过 minor，合计 delta 为 -9000000000100，超过 decimal 的 MAX_MINOR。独立运行相同 domain 转换表达式确认 `decimal` 抛出“无效金额”，故输入边界可能触发组件错误，而不是展示金额超限或禁用提交。清仓后余额超过上限也有类似边界。

主代理已提取统一预览函数，合计 delta 与最终 after 均先由 decimal 校验范围，组件捕获超限后不会进入金额格式化分支；后端另增加合计及银行/持仓最终余额上限检查。有界复测：预览函数 2/2 用例通过；只运行服务的缺失数量与聚合金额上限用例 2/2 通过，其中上限失败后的完整快照不变。代码检查确认原复现路径的异常发生在组件 try 内并使 impact 保持 null，提交不可用，原 JSX 不再收到越界 impact。没有发现此修复引入的新重要问题。浏览器不崩溃断言由主代理 E2E 验证，本次不重复运行浏览器。

## 检查证据

- 阅读设计、实施计划、全部目标文件和原 asset.trade 实现；追查 executeCommand、账户查找、家庭写入保护、复式分录和 D1 batch 回滚。
- `node --test tests/security-trades.test.mjs tests/extensions.test.mjs tests/member-ownership-store.test.mjs`：最终 25/25 通过，包含原部分卖出、加权成本、现金成员错配及新缺失数量回归。
- `node --test tests/family-api-isolation-v15.test.mjs tests/family-route.test.mjs tests/family.test.mjs tests/asset-registration-market.test.mjs`：22/22 通过。
- 修复 P3 后有界增量复测：`node --test tests/security-trade-impact.test.mjs` 2/2；`node --test --test-name-pattern='aggregate bounds|explicit buy requires' tests/security-trades.test.mjs` 2/2。未重跑全部旧用例。
- `git diff --check`：通过，包括最终 P3 修复。
- 独立 SQLite 输入探测：见上文，不依赖新增测试用例的封装或断言。

## 核对要点

- 首次买入通过 stagedAccounts 插入零余额持仓并同批生成 ASSET_BUY，不伪造 OPENING；银行扣成交额加手续费。
- 清仓由服务端持仓 balance 与 oldQ 派生，不采信客户端 carrying/quantity；银行入成交额减手续费，原持仓余额与已知数量归零，保留历史。
- 数量用 BigInt 八位缩放处理；未知旧数量增持仍保持未知，全清后可再次买入。
- 命令幂等、余额不足回滚、家庭及只读保护继续经过原 executeCommand 事务与作用域，不存在新旁路写入接口。
- 日期拒绝未来和早于现金/持仓快照；持仓 additionally 拒绝早于上次交易。相同快照日期允许由 balanceUncovered 明确确认，符合当前设计“不早于”的边界。
- FinanceApp 保留基金/股票的原卖出/赎回入口与其他资产的通用买卖；清零后重买刷新价格与核对日。
