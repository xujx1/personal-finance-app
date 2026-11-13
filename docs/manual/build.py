# -*- coding: utf-8 -*-
"""Render public product instructions and cases from content.json; stdlib only."""
from pathlib import Path
import base64
import hashlib
import html
import json
import re

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / 'docs'
DATA = json.loads((DOCS / 'manual/content.json').read_text())
MANIFEST = json.loads((DOCS / 'assets/workflows/manifest.json').read_text())
SHOTS = {item['id']: item for item in MANIFEST['screenshots']}
CASE_IDS = {item['id'] for item in DATA['cases']}

def validate():
    assert len(CASE_IDS) == len(DATA['cases']), 'Duplicate case ID'
    assert len({s['id'] for s in DATA['sections']}) == len(DATA['sections'])
    used = set()
    for chapter in DATA['sections']:
        used.update(chapter['cases'])
        assert set(chapter['cases']) <= CASE_IDS
        assert set(chapter['screenshots']) <= set(SHOTS)
        assert len(chapter['steps']['zh']) == len(chapter['steps']['en'])
    assert used == CASE_IDS, 'Cases missing chapter links'
    for case in DATA['cases']:
        assert case['manual_status'] == 'not_run', 'Do not invent manual passes'
        assert len(case['steps']['zh']) == len(case['steps']['en'])
        for test in case['tests']:
            assert (ROOT / test).is_file(), 'Missing test reference: ' + test
        assert set(case['screenshots']) <= set(SHOTS)
    for shot in SHOTS.values():
        image = DOCS / 'assets/workflows' / shot['file']
        assert hashlib.sha256(image.read_bytes()).hexdigest() == shot['sha256']

LABELS = {
    'zh': dict(title='产品操作演示手册',cases='关键案例库',entry='入口',pre='开始前',steps='操作步骤',result='预期结果',note='核对与异常',refs='关联案例',data='前置数据',failure='失败判据',tests='自动化定位',shots='截图',gap='暂无已审查可公开的本模块专属截图，详见核对说明。',show='展开原图',status='手工演示状态：not_run；已有自动化文件定位不代表本示例已完整复演。'),
    'en': dict(title='Product operation and demonstration manual',cases='Key case library',entry='Entry',pre='Before starting',steps='Steps',result='Expected result',note='Checks and exceptions',refs='Related cases',data='Prerequisites and data',failure='Failure criteria',tests='Automation references',shots='Screenshots',gap='No reviewed publishable dedicated image is available; see the limitations.',show='Show original image',status='Manual execution: not_run. Existing automation references do not mean this exact example was fully replayed.'),
}

NAV = [
    ('财务总览','Overview','M04'),('生活日历','Calendar','M12'),('研究记录','Research records','M13'),
    ('资产与贷款','Assets and loans','M05 M07 M08 M09'),('预算与大型支出','Budgets and major expenses','M10 M11 M15'),
    ('现金流水','Cashflow','M11'),('月度报告','Monthly reports','M16'),('周期收支','Recurring cashflow','M14'),
    ('现金预测','Cash forecast','M15'),('会员权益','Memberships','M17'),('家庭管理','Household management','M01 M03'),
    ('工作流集成','Workflow integration','M02'),('目标设置','Goals','M06'),
]

def shot_url(id):
    return 'assets/workflows/' + SHOTS[id]['file']

def intro(lang):
    if lang == 'zh':
        return ('面向家庭管理员、家人和演示人员的完整操作说明，按产品入口组织，不以开发需求清单代替操作步骤。18章覆盖当前源码的13个导航/账户菜单入口；关键案例另存40项。\n\n'
                '适用基线：2026-11-13本地工作树。当前源码包含尚未发布的插件接入改动，线上可能不同。公开图均为已审查的历史隔离演示或组件产物，不是本轮新拍的生产连续流程。目标、养老金和会员等旧样本有个人参数来源，故未复用；缺口逐章说明。\n\n'
                '演示只在独立家庭使用合成数据。D代表演示当天，D-1为前一天；金额均为主币单位，输入字符串，后台分/美分不直接当元使用。用户确认“实际发生”与机构已完成是记账前提，演示不得向真实账本伪造交易。')
    return ('Complete instructions for household administrators, members, and demonstrators, organized around product entry points rather than engineering requirements. Eighteen chapters cover all thirteen navigation/account-menu entries in the current source; forty cases are maintained separately.\n\n'
            'Baseline: local worktree on2026-11-13, including unpublished plugin changes; production may differ. Published images are reviewed historical isolated demos/components, not a newly captured continuous production flow. Older goal/pension/membership samples with personal-input provenance are excluded; gaps are explicit.\n\n'
            'Demonstrate only with independent synthetic household data. D is the demo date and D-1 the previous day. Amounts are major currency units, entered as strings; backend minor units are not yuan/dollars. Real-world completion is required for actual accounting; never create fictitious transactions in a real ledger.')

def markdown_manual(lang):
    l = LABELS[lang]; suffix = '' if lang == 'zh' else '.en'
    other = 'PRODUCT-MANUAL.en.md' if lang == 'zh' else 'PRODUCT-MANUAL.md'
    lines = ['# ' + l['title'],'',f'[中文](PRODUCT-MANUAL.md) · [English](PRODUCT-MANUAL.en.md) · [单文件图文演示 / Offline illustrated edition](product-demo.html) · [{l["cases"]}](KEY-CASES{suffix}.md)','',intro(lang),'',
             '## ' + ('功能入口覆盖' if lang == 'zh' else 'Entry-point coverage'),'','| '+('入口 | 章节' if lang == 'zh' else 'Entry | Chapters')+' |','| --- | --- |']
    for zh,en,ids in NAV:
        lines.append('| '+(zh if lang == 'zh' else en)+' | '+' / '.join(f'[{id}](#{id.lower()})' for id in ids.split())+' |')
    lines += ['', '## '+('章节目录' if lang == 'zh' else 'Contents'),'']
    for s in DATA['sections']:
        lines.append(f'- [{s["id"]} {s["title"][lang]}](#{s["id"].lower()})')
    lines += ['', '## '+('演示主线：从计划到实际消费' if lang == 'zh' else 'Demonstration spine: plan to actual consumption'),'']
    if lang == 'zh':
        lines += ['先按C01在隔离家庭登记银行1000元，再用C04/C05演示300元预算与多人审批，接着按C09逐步演示款项，最后按C27保存并比较月报。以下是预期账务轨迹，不是本轮手工演示的已通过回执。','','| 步骤 | 银行现金 | 预付资产 | 应核对 |','| --- | ---: | ---: | --- |','| 开账及预算批准 | 1000 | 0 | 预算300不扣现 |','| 实付120 | 880 | 0 | 原计划关联与成员账户 |','| 预付50 | 830 | 50 | 预付不是已消费 |','| 从预付消费30 | 830 | 20 | 不再次扣现金 |','| 未消费20退款到账 | 850 | 0 | 退原账户；累计实际消费150 |']
    else:
        lines += ['Open a synthetic bank balance1,000 with C01, demonstrate a300 budget and separate member approval with C04/C05, follow C09 for settlement, then compare monthly archives with C27. These are expected accounting checkpoints, not newly passed manual receipts.','','| Step | Bank cash | Prepaid asset | Check |','| --- | ---: | ---: | --- |','| Opening and budget approval | 1000 | 0 | Budget300 does not debit |','| Actual payment120 | 880 | 0 | Correct plan/member/account |','| Prepay50 | 830 | 50 | Prepaid is not consumption |','| Consume30 prepaid | 830 | 20 | No second cash debit |','| Receive unused20 refund | 850 | 0 | Original account; consumption total150 |']
    for s in DATA['sections']:
        lines += ['',f'<a id="{s["id"].lower()}"></a>','',f'## {s["id"]} {s["title"][lang]}','',f'**{l["entry"]}：** {s["entry"][lang]}','',f'**{l["pre"]}：** {s["prerequisite"][lang]}','',f'### {l["steps"]}','']
        lines.extend(f'{i}. {step}' for i,step in enumerate(s['steps'][lang],1))
        lines += ['',f'**{l["result"]}：** {s["result"][lang]}','',f'**{l["note"]}：** {s["note"][lang]}','',f'**{l["refs"]}：** '+' / '.join(f'[{id}](KEY-CASES{suffix}.md#{id.lower()})' for id in s['cases']),'']
        if s['screenshots']:
            for id in s['screenshots']:
                lines += ['<details>',f'<summary>{id} · {l["show"]}</summary>','',f'![{id}: {SHOTS[id]["workflow"]}]({shot_url(id)})','','</details>','']
        else:
            lines += ['> '+l['gap'],'']
    lines += ['## '+('完整性与演示边界' if lang == 'zh' else 'Completeness and demonstration limits'),'']
    lines += [('[全部关键案例](KEY-CASES.md)、[截图来源及缺口](assets/workflows/README.md)、[本轮校验](manual/VERIFICATION.md)。所有入口有文字步骤；不把缺失图、真实客户端未验收或历史截图当本轮通过。' if lang == 'zh' else '[All cases](KEY-CASES.en.md), [image provenance and gaps](assets/workflows/README.md), [checks](manual/VERIFICATION.md). Every entry has written steps; missing images, unverified real clients, and old screenshots are not new passes.'),'']
    (DOCS / ('PRODUCT-MANUAL'+suffix+'.md')).write_text('\n'.join(lines))

def markdown_cases(lang):
    l=LABELS[lang];suffix='' if lang=='zh' else '.en'
    lines=['# '+l['cases'],'',f'[中文](KEY-CASES.md) · [English](KEY-CASES.en.md) · [产品手册 / Manual](PRODUCT-MANUAL{suffix}.md) · [图文版 / Illustrated edition](product-demo.html)','']
    lines += [('这40项是可维护的关键业务案例，不是40个已执行通过的演示。每项均保存前置数据、步骤、预期账务、失败判据及自动化定位。数据为独立合成示例，与截图中的旧测试数值无须相同。\n\nP0指权限、资金、归属、重复记账或不可变历史等关键边界；P1指展示与辅助规划等重要路径。手工状态均not_run。本轮仅重跑20个既有测试文件，144项通过，不能据此宣称这40项的每个组合或真实客户端均已验收。详见[校验记录](manual/VERIFICATION.md)。' if lang=='zh' else 'These forty cases are maintainable business scenarios, not forty newly passed demonstrations. Each preserves data, steps, expected accounting, failure criteria, and automation references. Independent synthetic example values need not match historical screenshots.\n\nP0 marks access/fund/ownership/idempotency/history boundaries; P1 important display or planning paths. Every manual status is not_run. This revision reran twenty existing test files with144 passing tests; that does not certify all combinations or real-client scenarios here. See [verification](manual/VERIFICATION.md).'),'','## '+('索引' if lang=='zh' else 'Index'),'','| ID | '+('级别 | 案例 | 手工状态' if lang=='zh' else 'Priority | Case | Manual status')+' |','| --- | --- | --- | --- |']
    for c in DATA['cases']:
        lines.append(f'| [{c["id"]}](#{c["id"].lower()}) | {c["priority"]} | {c["title"][lang]} | not_run |')
    for c in DATA['cases']:
        related=[s['id'] for s in DATA['sections'] if c['id'] in s['cases']]
        lines += ['',f'<a id="{c["id"].lower()}"></a>','',f'## {c["id"]} · {c["priority"]} · {c["title"][lang]}','',f'**{l["data"]}：** {c["data"][lang]}','',f'### {l["steps"]}','']
        lines.extend(f'{i}. {step}' for i,step in enumerate(c['steps'][lang],1))
        lines += ['',f'**{l["result"]}：** {c["expected"][lang]}','',f'**{l["failure"]}：** {c["failure"][lang]}','',f'**{l["tests"]}：** '+' / '.join(f'[{Path(p).name}](../{p})' for p in c['tests']),'',('**操作章节：** ' if lang=='zh' else '**Manual chapters:** ')+' / '.join(f'[{id}](PRODUCT-MANUAL{suffix}.md#{id.lower()})' for id in related),'',l['status'],'']
        if c['screenshots']:
            lines += [f'**{l["shots"]}：** '+' / '.join(f'[{id}]({shot_url(id)})' for id in c['screenshots']),'']
    lines += ['## '+('新增与回归记录规范' if lang=='zh' else 'Case maintenance and execution records'),'']
    lines += [('发现问题先定位已有ID；新边界新增ID，不因改标题重排旧编号。执行时记录源码版本、环境、账号角色、独立数据集、实际操作、实际结果、通过/失败/受阻、原截图与日志位置。失败修复应追加复测记录，保留原失败，不把预期值复制成实测值。不要把本地模拟身份结果标成生产OAuth/真实家人验收。' if lang=='zh' else 'Keep IDs stable when titles change. Add an ID for a new boundary. Execution records need source revision, environment, roles, independent dataset, actual steps/results, pass/fail/blocked status, and original screenshot/log paths. Preserve failures and append retests; never copy expected values into observed results or label simulated identities as production OAuth/real-member acceptance.'),'']
    (DOCS / ('KEY-CASES'+suffix+'.md')).write_text('\n'.join(lines))

def render_html():
    e=html.escape;parts=[]
    for lang in ['zh','en']:
        l=LABELS[lang]
        nav=''.join(f'<a href="#{lang}-{s["id"]}">{s["id"]} {e(s["title"][lang])}</a>' for s in DATA['sections'])
        parts.append(f'<div class="language" data-language="{lang}"><aside><b>{e(l["title"])}</b>{nav}<a href="#{lang}-cases">{e(l["cases"])} · 40</a></aside><main><header><p class="eyebrow">FAMILY FINANCE · PRODUCT DOCUMENTATION</p><h1>{e(l["title"])}</h1><p class="lead">18 '+('章操作 · 40个关键案例 · 18张来源可查演示图' if lang=='zh' else 'chapters · 40 key cases · 18 sourced demo images')+'</p></header>')
        parts.extend('<p>'+e(p)+'</p>' for p in intro(lang).split('\n\n'))
        parts.append('<p class="notice">'+e('图片是已有隔离演示；手工案例未重跑。144项既有自动化检查通过，不能替代真实客户端验收。' if lang=='zh' else 'Images are historical isolated demos; manual cases were not replayed.144 existing automated checks passed, not real-client certification.')+'</p>')
        for s in DATA['sections']:
            parts.append(f'<section id="{lang}-{s["id"]}"><p class="eyebrow">{s["id"]}</p><h2>{e(s["title"][lang])}</h2><p class="entry"><b>{l["entry"]}</b> {e(s["entry"][lang])}</p><p><b>{l["pre"]}</b> {e(s["prerequisite"][lang])}</p><ol>')
            parts.extend('<li>'+e(step)+'</li>' for step in s['steps'][lang])
            parts.append('</ol><div class="outcome"><b>'+l['result']+'</b><p>'+e(s['result'][lang])+'</p></div><p class="note"><b>'+l['note']+'</b> '+e(s['note'][lang])+'</p>')
            parts.append('<p>'+l['refs']+': '+' · '.join(f'<a href="#{lang}-{id}">{id}</a>' for id in s['cases'])+'</p>')
            if s['screenshots']:
                parts.append('<div class="gallery">')
                for id in s['screenshots']:
                    parts.append(f'<figure><button class="image-button" data-shot="{id}" aria-label="{l["show"]} {id}"><img data-image="{id}" alt="{id} {e(SHOTS[id]["workflow"])}" loading="lazy"></button><figcaption>{id} · {e(SHOTS[id]["workflow"])}</figcaption></figure>')
                parts.append('</div>')
            else:
                parts.append('<p class="gap">'+l['gap']+'</p>')
            parts.append('</section>')
        parts.append('<details><summary>'+('历史入口参考：S02为旧六入口安装画面，不能复制其中命令' if lang=='zh' else 'Historical entry: S02 is the older six-entry installer; do not copy its command')+'</summary><figure><button class="image-button" data-shot="S02" aria-label="S02"><img data-image="S02" alt="S02: historical workflow integration" loading="lazy"></button><figcaption>S02 · historical UI</figcaption></figure></details>')
        parts.append(f'<section id="{lang}-cases"><p class="eyebrow">CASE LIBRARY</p><h2>{l["cases"]} · 40</h2><p>{e(l["status"])}</p><label class="search-label">'+('搜索案例、金额、模块或编号' if lang=='zh' else 'Search by case, amount, module, or ID')+f'<input class="case-search" data-target="{lang}" type="search"></label></section>')
        for c in DATA['cases']:
            parts.append(f'<article class="case-card" id="{lang}-{c["id"]}" data-case-language="{lang}"><p class="eyebrow">{c["id"]} · {c["priority"]} · manual: not_run</p><h3>{e(c["title"][lang])}</h3><p><b>{l["data"]}</b> {e(c["data"][lang])}</p><ol>')
            parts.extend('<li>'+e(step)+'</li>' for step in c['steps'][lang])
            parts.append('</ol><div class="outcome"><b>'+l['result']+'</b><p>'+e(c['expected'][lang])+'</p></div><p class="failure"><b>'+l['failure']+'</b> '+e(c['failure'][lang])+'</p><p class="refs">'+l['tests']+': '+e(' / '.join(c['tests']))+'</p></article>')
        parts.append('</main></div>')
    encoded={id:'data:image/png;base64,'+base64.b64encode((DOCS/'assets/workflows'/s['file']).read_bytes()).decode() for id,s in SHOTS.items()}
    css='''*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f5f7f4;color:#203e36;font:16px/1.75 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:#216956;text-underline-offset:4px}button,input{font:inherit}button{cursor:pointer}body[data-lang=zh] .language[data-language=en],body[data-lang=en] .language[data-language=zh]{display:none}.toolbar{position:sticky;top:0;z-index:10;display:flex;justify-content:space-between;gap:14px;align-items:center;padding:12px 5vw;background:#143d32;color:white}.toolbar button{border:1px solid #c5d4cb;background:transparent;border-radius:8px;padding:7px 12px;color:white}.language{display:grid;grid-template-columns:260px minmax(0,1fr);max-width:1500px;margin:auto}aside{position:sticky;top:70px;height:calc(100vh - 90px);overflow:auto;padding:28px 20px;background:#eef2ec}aside b{display:block;margin-bottom:18px}aside a{display:block;padding:7px 0;font-size:13px;text-decoration:none}main{padding:48px 5vw;min-width:0;max-width:1120px}h1{font-size:42px;line-height:1.25;letter-spacing:-1px}h2{font-size:28px;line-height:1.4}h3{font-size:22px}.eyebrow{font-size:12px;letter-spacing:1.8px;color:#557e6e;font-weight:700}.lead{font-size:21px}.notice{padding:18px 22px;border-left:4px solid #ad8a4b;background:#fff7de}section{padding:32px 0;border-top:1px solid #d5dfd6;scroll-margin-top:82px}.entry{padding:13px 18px;background:#e9f1eb;border-radius:8px}li{padding:6px 0}.outcome{background:#e4f0e7;border-radius:12px;padding:16px 20px}.outcome p{margin:7px 0}.note,.gap{color:#6f6046}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}figure{margin:12px 0}figcaption{font-size:12px;color:#5c766a}.image-button{width:100%;border:1px solid #d8e2db;border-radius:12px;background:#fff;padding:10px}.image-button img{display:block;max-width:100%;height:320px;object-fit:contain;margin:auto}.case-card{margin:20px 0;padding:26px;background:white;border:1px solid #dae2d9;border-radius:14px;scroll-margin-top:82px}.failure{color:#805a3d}.refs{font-size:12px;overflow-wrap:anywhere;color:#698173}.search-label{display:block;font-size:14px}.case-search{display:block;padding:12px;width:100%;border:1px solid #a9c0ad;border-radius:8px;background:white}dialog{border:0;border-radius:12px;max-width:96vw;max-height:95vh;padding:16px}dialog::backdrop{background:#102a23d9}dialog img{display:block;max-width:90vw;height:auto}dialog button{position:sticky;top:0;float:right;background:#143d32;color:white;padding:8px 18px;border:0;border-radius:8px}[hidden]{display:none!important}@media(max-width:850px){.language{grid-template-columns:1fr}aside{position:static;height:auto;max-height:250px}main{padding:24px}h1{font-size:32px}.toolbar{font-size:13px;flex-wrap:wrap}}@media print{.toolbar,aside,.case-search,.search-label{display:none}.language{display:block}main{max-width:none;padding:0}.image-button img{height:230px}.case-card,figure,.outcome{break-inside:avoid}body{background:white}a{color:inherit}}'''
    js='''document.querySelectorAll('[data-image]').forEach(img=>{img.src=shots[img.dataset.image]});document.querySelectorAll('[data-set-lang]').forEach(btn=>btn.addEventListener('click',()=>{document.body.dataset.lang=btn.dataset.setLang;document.documentElement.lang=btn.dataset.setLang==='zh'?'zh-CN':'en'}));document.querySelectorAll('.case-search').forEach(input=>input.addEventListener('input',()=>{const term=input.value.trim().toLowerCase();document.querySelectorAll('[data-case-language="'+input.dataset.target+'"]').forEach(card=>{card.hidden=!!term&&!card.textContent.toLowerCase().includes(term)})}));const dialog=document.querySelector('dialog');document.querySelectorAll('[data-shot]').forEach(btn=>btn.addEventListener('click',()=>{dialog.querySelector('img').src=shots[btn.dataset.shot];dialog.showModal()}));dialog.querySelector('button').addEventListener('click',()=>dialog.close());document.querySelector('[data-print]').addEventListener('click',()=>{document.querySelectorAll('.case-card').forEach(card=>{card.hidden=false});document.querySelectorAll('.case-search').forEach(input=>{input.value=''});window.print()});'''
    doc='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>家庭财务中心 · 操作演示与关键案例</title><style>'+css+'</style></head><body data-lang="zh"><div class="toolbar"><strong>家庭财务中心 · 产品操作与案例</strong><div><button data-set-lang="zh">中文</button> <button data-set-lang="en">English</button> <button data-print>打印 / Print</button></div></div>'+''.join(parts)+'<dialog><button>关闭 / Close</button><img alt="原始演示截图 / Original demo screenshot"></dialog><script>const shots='+json.dumps(encoded,separators=(',',':'))+';'+js+'</script></body></html>'
    (DOCS/'product-demo.html').write_text(doc)

validate()
for language in ['zh','en']:
    markdown_manual(language)
    markdown_cases(language)
render_html()
print(f'Rendered {len(DATA["sections"])} chapters, {len(DATA["cases"])} cases, {len(SHOTS)} embedded screenshots in Chinese and English.')
