# 产品文档维护 / Maintaining the product documentation

[操作手册](../PRODUCT-MANUAL.md) · [English manual](../PRODUCT-MANUAL.en.md) · [案例库](../KEY-CASES.md) · [English cases](../KEY-CASES.en.md) · [图文版](../product-demo.html)

`content.json` 是18章操作说明和40个关键案例的双语来源。`build.py` 从它生成四份Markdown与一个内嵌图片的HTML；图片从[来源清单](../assets/workflows/manifest.json)读取。保持案例ID稳定，不直接修改生成文件。

`content.json` is the bilingual source for18 operation chapters and40 cases. `build.py` produces four Markdown documents and one HTML file with embedded images, using the [image manifest](../assets/workflows/manifest.json). Keep IDs stable and edit the source rather than generated outputs.

在仓库根目录执行 / From the repository root:

```sh
python3 docs/manual/build.py
```

只依赖Python标准库。构建核对章节/案例ID、相互关联、双语步骤数量、自动化文件路径及截图SHA256。HTML中图片已内嵌，单文件下载后可离线看中英文、搜索案例、放大原图和打印；GitHub在线阅读使用Markdown版本。

Only Python's standard library is required. The builder validates IDs, case/chapter associations, bilingual step counts, test paths, and image hashes. Download the HTML for offline language switching, case search, full-size images, and printing; read the Markdown editions directly on GitHub.

截图缺口和真实客户端未验证项必须保留。历史图片的通过数量不是当前测试数量；案例预期结果不是实测回执。执行后另存版本、环境、角色、数据、实际结果和证据，再根据真实结果维护状态。

Preserve image gaps and real-client limitations. Historical image suite counts are not new test results; expected case outcomes are not observed receipts. Record source revision, environment, roles, data, actual outcomes, and evidence separately before updating execution status.
