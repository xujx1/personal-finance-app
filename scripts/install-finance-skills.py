#!/usr/bin/env python3
"""Install the reviewed Skill backup beside this file; no network or MCP credential changes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

LEGACY_IDS={'family-finance-consumption','family-finance-investment','family-finance-images','family-finance-monthly','family-finance-recurring'}

IDS=LEGACY_IDS|{'family-finance-onboarding'}

def install(source, target):
    manifest_path=source/'SKILLS-MANIFEST.json'
    if manifest_path.is_symlink():raise ValueError('校验清单不能是符号链接')
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    files=manifest.get('files',[])
    paths={f.get('path') for f in files}
    installed_ids=next((names for names in (IDS,LEGACY_IDS) if paths=={f'skills/{name}/SKILL.md' for name in names}|{'plugin.json'}),None)
    if installed_ids is None or len(files)!=len(installed_ids)+1:raise ValueError('校验文件路径不匹配')
    for row in files:
        relative=Path(row['path']);file=source/relative
        if relative.is_absolute() or '..' in relative.parts or any(parent.is_symlink() for parent in [file,*file.parents] if parent!=source.parent):raise ValueError('安装路径不能是符号链接或越界')
        data=file.read_bytes()
        if len(data)>120000 or len(data)!=row.get('size') or hashlib.sha256(data).hexdigest()!=row.get('sha256'):raise ValueError('SHA256校验失败：'+str(relative))
    if target.is_symlink():raise ValueError('目标路径不能是符号链接')
    # macOS /tmp and /var are system aliases. Pin their canonical destination,
    # then reject redirected Skill directories beneath that chosen root.
    target=target.resolve()
    for name in installed_ids:
        dest=target/name
        if dest.is_symlink() or dest.exists() and not dest.is_dir():raise ValueError('目标Skill目录无效')
        if dest.exists() and any(p.is_symlink() for p in dest.rglob('*')):raise ValueError('目标Skill不能包含符号链接')
    target.mkdir(parents=True,exist_ok=True)
    changed=[name for name in sorted(installed_ids) if not (target/name/'SKILL.md').exists() or (target/name/'SKILL.md').read_bytes()!=(source/'skills'/name/'SKILL.md').read_bytes()]
    existing=[name for name in changed if (target/name).exists()]
    backup=Path(tempfile.mkdtemp(prefix='.family-finance-backup-',dir=target)) if existing else None
    if backup:
        for name in existing:shutil.copytree(target/name,backup/name)
    for name in changed:
        dest=target/name;dest.mkdir(exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=dest,delete=False) as file:
            temporary=Path(file.name);file.write((source/'skills'/name/'SKILL.md').read_bytes())
        os.replace(temporary,dest/'SKILL.md')
    print(json.dumps({'installed':len(changed),'target':str(target),'backup':str(backup) if backup else None,'note':'重新打开Codex会话加载Skill；MCP仍使用已连接家庭财务中心插件，无需填写模型Key。'},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target',type=Path,default=Path(os.environ.get('CODEX_HOME',str(Path.home()/'.codex')))/'skills')
    args=parser.parse_args()
    try:install(Path(__file__).resolve().parent,args.target.absolute())
    except (OSError,ValueError,KeyError,TypeError) as error:
        print('安装失败：'+str(error),file=sys.stderr);sys.exit(1)
