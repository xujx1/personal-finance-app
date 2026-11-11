#!/usr/bin/env python3
"""Export an allowlisted source tree without runtime data or credentials.

This is a packaging boundary, not a classifier for arbitrary sensitive prose.
Only run it against source that has already been reviewed for hardcoded secrets.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import tempfile
import zipfile

SOURCE_DIRECTORIES = frozenset({
    'app', 'components', 'db', 'drizzle', 'lib', 'src', 'scripts', 'tests',
    'docs', 'public', 'local', 'hooks', 'worker', 'vendor', 'examples',
})
ROOT_FILES = frozenset({
    'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml',
    'yarn.lock', 'bun.lock', 'tsconfig.json', 'jsconfig.json', 'next-env.d.ts', 'cloudflare-env.d.ts',
    'components.json', 'README.md', 'README', 'LICENSE', 'LICENSE.md',
    'LICENSE.txt', 'COPYING', 'index.html', 'index.ts', 'index.js',
    'middleware.ts', 'middleware.js', 'instrumentation.ts', 'worker.ts',
    'wrangler.toml', 'wrangler.json', 'wrangler.jsonc', '.gitignore',
    '.eslintignore', '.env.example',
}) | frozenset(
    stem + suffix
    for stem in ('next.config', 'vite.config', 'vitest.config', 'postcss.config',
                 'eslint.config', 'drizzle.config', 'tailwind.config')
    for suffix in ('.js', '.mjs', '.cjs', '.ts', '.mts', '.cts')
)
EXCLUDED_DIRECTORIES = frozenset({
    'node_modules', '.git', '.sites-runtime', '.wrangler', 'work', 'outputs',
    'dist', '.next', '.vinext', '.idea', '.agents', '.codex', '__pycache__',
    '.pytest_cache', '.cache', 'coverage', 'backup', 'backups', 'logs',
    'private', 'secrets',
})
EXCLUDED_SUFFIXES = (
    '.sqlite', '.sqlite3', '.db', '.sqlite-wal', '.sqlite-shm', '.sqlite3-wal',
    '.sqlite3-shm', '.db-wal', '.db-shm', '.backup', '.bak', '.dump', '.log',
    '.zip', '.tar', '.tgz', '.gz', '.bz2', '.xz', '.7z', '.rar', '.zst',
    '.pem', '.key', '.p12', '.pfx', '.p8', '.der', '.jks', '.keystore',
    '.pyc', '.pyo', '.tsbuildinfo', '.csv', '.tsv', '.xlsx', '.xls',
    '.jsonl', '.ndjson', '.pdf',
)
EXCLUDED_NAMES = frozenset({
    'handoff-manifest.json', 'source-manifest.json', 'id_rsa', 'id_dsa',
    'id_ecdsa', 'id_ed25519', 'credentials', 'credentials.json', 'secrets.json',
})
IDENTIFIER = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}\Z')
SENSITIVE_IDENTIFIER = re.compile(r'^(?:sk[-_]|ghp_|github_pat_|Bearer\s|eyJ)')
RESOURCE_FIELDS = frozenset({
    'binding', 'database_name', 'database_id', 'preview_database_id',
    'bucket_name', 'preview_bucket_name', 'id', 'name', 'slug',
})


def identifier(value):
    if isinstance(value, str) and IDENTIFIER.fullmatch(value) and not SENSITIVE_IDENTIFIER.match(value):
        return value
    return None


def relative_directory(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_./-]{1,200}', value):
        return None
    path = Path(value)
    return value if not path.is_absolute() and '..' not in path.parts else None


def sanitize_resource(value):
    if not isinstance(value, dict):
        return None
    result = {key: identifier(item) for key, item in value.items() if key in RESOURCE_FIELDS}
    result = {key: item for key, item in result.items() if item is not None}
    if 'migrations_dir' in value:
        directory = relative_directory(value['migrations_dir'])
        if directory is not None:
            result['migrations_dir'] = directory
    if isinstance(value.get('enabled'), bool):
        result['enabled'] = value['enabled']
    return result or None


def sanitize_capabilities(value):
    if isinstance(value, list):
        clean = []
        for item in value:
            safe = identifier(item) if isinstance(item, str) else sanitize_resource(item)
            if safe is not None:
                clean.append(safe)
        return clean
    if isinstance(value, dict):
        return {key: item for key, item in value.items()
                if identifier(key) and isinstance(item, bool)}
    return None


def sanitize_hosting(raw):
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError('Hosting metadata must be an object')
    result = {}
    project_id = identifier(value.get('project_id'))
    if project_id is not None:
        result['project_id'] = project_id
    static = value.get('static')
    if isinstance(static, str):
        safe = relative_directory(static)
        if safe is not None:
            result['static'] = safe
    elif isinstance(static, dict):
        safe = {}
        for key in ('directory', 'binding', 'html_handling', 'not_found_handling'):
            item = relative_directory(static.get(key)) if key == 'directory' else identifier(static.get(key))
            if item is not None:
                safe[key] = item
        result['static'] = safe
    for kind in ('d1', 'r2'):
        resources = value.get(kind)
        if kind in value and resources is None:
            result[kind] = None
        elif isinstance(resources, str):
            safe = identifier(resources)
            if safe is not None:
                result[kind] = safe
        elif isinstance(resources, list):
            result[kind] = [safe for item in resources if (safe := sanitize_resource(item)) is not None]
        elif isinstance(resources, dict):
            safe = sanitize_resource(resources)
            result[kind] = safe if safe is not None else {}
    for kind in ('capabilities', 'plugins', 'connectors'):
        if kind in value:
            safe = sanitize_capabilities(value[kind])
            if safe is not None:
                result[kind] = safe
    return json_bytes(result)


def sanitize_env_example(raw):
    names = []
    for line in raw.decode('utf-8').splitlines():
        match = re.match(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', line)
        if match and match.group(1) not in names:
            names.append(match.group(1))
    return ('# Values intentionally removed from the source export.\n' +
            ''.join(name + '=\n' for name in names)).encode('utf-8')


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode('utf-8')


def allowed_file(path):
    name = path.name.lower()
    if name in EXCLUDED_NAMES or name.endswith(EXCLUDED_SUFFIXES):
        return False
    if path.suffix.lower() in {'.sql', '.json', '.txt', '.dat', '.bin'} and re.search(
            r'(?:^|[._-])(?:backup|dump|archive|credentials|secret|private[-_]key)(?:[._-]|$)', name):
        return False
    if name.startswith('.env'):
        return name == '.env.example'
    return not name.startswith('.')


def source_paths(root):
    for name in sorted(ROOT_FILES):
        path = root / name
        if path.is_file() and not path.is_symlink():
            yield path
    for name in sorted(SOURCE_DIRECTORIES):
        directory = root / name
        if not directory.is_dir() or directory.is_symlink():
            continue
        for current, directories, files in os.walk(directory, followlinks=False):
            directories[:] = sorted(name for name in directories
                                    if name.lower() not in EXCLUDED_DIRECTORIES and not name.startswith('.')
                                    and not (Path(current) / name).is_symlink())
            for name in sorted(files):
                path = Path(current) / name
                if allowed_file(path) and not path.is_symlink() and path.is_file():
                    yield path
    hosting = root / '.openai' / 'hosting.json'
    if not (root / '.openai').is_symlink() and hosting.is_file() and not hosting.is_symlink():
        yield hosting


def read_source(path, root):
    # Recheck parents before opening, and prevent a final file symlink swap.
    if path.is_symlink() or not path.resolve().is_relative_to(root):
        raise ValueError('Source path escaped the export root')
    relative = path.relative_to(root)
    parent = root
    for part in relative.parts[:-1]:
        parent /= part
        if parent.is_symlink():
            raise ValueError('Source parent became a symlink')
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    with os.fdopen(descriptor, 'rb') as source:
        if not stat.S_ISREG(os.fstat(source.fileno()).st_mode):
            raise ValueError('Only regular source files can be exported')
        return source.read()


def export_source(root, output):
    members = {}
    for path in source_paths(root):
        if path.resolve() == output:
            continue
        name = path.relative_to(root).as_posix()
        data = read_source(path, root)
        if path.name.lower() == '.env.example':
            data = sanitize_env_example(data)
        elif name == '.openai/hosting.json':
            data = sanitize_hosting(data)
        members[name] = data
    manifest = {'format': 1, 'files': [
        {'path': name, 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)}
        for name, data in sorted(members.items())
    ]}
    members['SOURCE-MANIFEST.json'] = json_bytes(manifest)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=output.parent, prefix='.source-export-', suffix='.tmp', delete=False) as file:
            temporary = Path(file.name)
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, data in sorted(members.items()):
                info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        os.replace(temporary, output)
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return len(manifest['files'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, help='Absolute path of the ZIP to create')
    parser.add_argument('--root', default=str(Path(__file__).resolve().parent.parent))
    arguments = parser.parse_args()
    root_argument, output_argument = Path(arguments.root), Path(arguments.output)
    if root_argument.is_symlink() or not root_argument.is_dir():
        parser.error('--root must be a real directory, not a symlink')
    if not output_argument.is_absolute() or output_argument.suffix.lower() != '.zip':
        parser.error('--output must be an absolute .zip path')
    root, output = root_argument.resolve(), output_argument.absolute()
    count = export_source(root, output)
    print(json.dumps({'output': str(output), 'source_files': count}, sort_keys=True))


if __name__ == '__main__':
    main()
