#!/usr/bin/env python3
"""
检查 data/styles.json 中所有预览图 URL 是否可访问。
顺序检查+重试。用于 CI 流程，确保图片没有丢失。
"""
import json, os, sys, subprocess, time

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(REPO_ROOT, 'data', 'styles.json')

def main():
    if not os.path.isfile(DATA_FILE):
        print(f'❌ {DATA_FILE} 不存在'); sys.exit(1)

    with open(DATA_FILE, encoding='utf-8') as f:
        data = json.load(f)

    failed = []
    total = len(data['styles'])
    print(f'📋 检查 {total} 个风格的预览图 URL\n')

    for i, style in enumerate(data['styles'], 1):
        sid = style.get('id', '?')
        urls = style.get('preview_urls', [])
        if not urls:
            print(f'  ⚠️  [{i:3d}/{total}] {sid}: 无预览图 URL')
            failed.append((sid, '无 URL'))
            continue

        url = urls[0]
        if 'style-source' not in url:
            continue

        # 检查（最多重试2次）
        ok = False
        for attempt in range(3):
            result = subprocess.run(
                ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
                 '--max-time', '10', '--head', url],
                capture_output=True, text=True, timeout=15)
            code = result.stdout.strip()
            if code == '200':
                ok = True
                break
            if attempt < 2:
                time.sleep(2)

        if ok:
            print(f'  ✅  [{i:3d}/{total}] {sid}')
        else:
            print(f'  ❌  [{i:3d}/{total}] {sid}: HTTP {code}')
            failed.append((sid, f'HTTP {code}'))

    print(f'\n📊 通过: {total - len(failed)}/{total}')
    if failed:
        print(f'❌ 失败 {len(failed)} 个:')
        for sid, r in failed:
            print(f'  - {sid}: {r}')
        sys.exit(1)
    print('✅ 全部通过！')

if __name__ == '__main__':
    main()
