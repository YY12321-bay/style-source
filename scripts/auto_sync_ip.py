"""⏰ 自动巡检：检测桌面IP库有新增/变更 → 自动处理 → 同步 → 推送到GitHub

工作原理：
  每N分钟跑一次，扫描 ip_library/ 下的文件夹：
  1. 发现新文件夹（有图但没 reference_square.jpg）→ 自动裁剪处理
  2. 自动生成 README.md（名称=文件夹名，品牌=文件夹名）
  3. 更新 _index.md
  4. 同步到 repo_style_source/ip_gallery/
  5. git commit + push → GitHub Pages 自动更新

用法:
  python scripts/auto_sync_ip.py            # 运行一次
  python scripts/auto_sync_ip.py --watch    # 持续监控（循环）
"""

import os, sys, hashlib, json, subprocess, time
from PIL import Image

ENV = {**os.environ, 'PYTHONIOENCODING': 'utf-8'}  # 解决GBK编码问题
GIT_OPTS = ['-c', 'http.version=HTTP/1.1']  # 解决HTTP/2连接问题

# ====== 路径配置 ======
DESKTOP_IP_DIR = r'C:\Users\zy\Desktop\ip_library'
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.join(SCRIPT_DIR, '..')
STATE_FILE = os.path.join(SCRIPT_DIR, '.ip_sync_state.json')

def get_folder_state(path):
    """计算文件夹状态的hash（检测变化）"""
    hash_md5 = hashlib.md5()
    for fname in sorted(os.listdir(path)):
        fpath = os.path.join(path, fname)
        if os.path.isfile(fpath):
            hash_md5.update(fname.encode('utf-8'))
            hash_md5.update(str(os.path.getsize(fpath)).encode())
            hash_md5.update(str(os.path.getmtime(fpath)).encode())
    return hash_md5.hexdigest()

def needs_processing(folder_path):
    """判断是否需要处理：有图片但缺少 reference_square.jpg"""
    if os.path.exists(os.path.join(folder_path, 'reference_square.jpg')):
        return False
    # 检查是否有图片文件
    for f in os.listdir(folder_path):
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            return True
    return False

def get_image_file(folder_path):
    for f in os.listdir(folder_path):
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            return os.path.join(folder_path, f)
    return None

def process_ip(folder_name):
    """处理单个IP：裁剪图片 + 生成README + 更新索引"""
    folder_path = os.path.join(DESKTOP_IP_DIR, folder_name)
    print(f'  🔄 处理: {folder_name}')

    img_path = get_image_file(folder_path)
    if not img_path:
        print(f'  ⏭️  跳过（无图片）')
        return False

    # 处理图片
    img = Image.open(img_path).convert('RGB')
    w, h = img.size

    # reference.jpg — 最长边1200px，保持比例（不裁剪）
    ratio = min(1200 / w, 1200 / h, 1.0)
    ref = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    ref.save(os.path.join(folder_path, 'reference.jpg'), 'JPEG', quality=85, optimize=True)

    # reference_square.jpg — 800×800 白边填充（不裁剪内容）
    def to_square(im, size, bg_color=(255, 255, 255)):
        """等比例缩放并填充白边到正方形，保留全部内容"""
        r = min(size / im.width, size / im.height)
        resized = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
        square = Image.new('RGB', (size, size), bg_color)
        x = (size - resized.width) // 2
        y = (size - resized.height) // 2
        square.paste(resized, (x, y))
        return square

    square = to_square(img, 800)
    square.save(os.path.join(folder_path, 'reference_square.jpg'), 'JPEG', quality=85, optimize=True)

    # reference_thumb.jpg — 400×400 白边填充
    to_square(img, 400).save(
        os.path.join(folder_path, 'reference_thumb.jpg'), 'JPEG', quality=75, optimize=True)

    # 生成 README.md（如果不存在）
    readme_path = os.path.join(folder_path, 'README.md')
    if not os.path.exists(readme_path):
        readme = f"""# {folder_name}

| 字段 | 内容 |
|------|------|
| **IP名称** | {folder_name} |
| **品牌** | {folder_name} |
| **风格** | 默认风格 |
| **参考图** | `reference.jpg` ({ref.size[0]}×{ref.size[1]}) |

## 生图规范
### 基础句
```
Maintain IP identity and consistency throughout.
```
"""
        with open(readme_path, 'w', encoding='utf-8') as f:
            f.write(readme)

    # 更新 _index.md（如果还没这条记录）
    index_path = os.path.join(DESKTOP_IP_DIR, '_index.md')
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            content = f.read()
        if f'[{folder_name}]' not in content:
            new_line = f'| [{folder_name}]({folder_name}/README.md) | {folder_name} | 默认风格 | `{folder_name}/reference_square.jpg` |\n'
            content = content.rstrip() + '\n' + new_line
            with open(index_path, 'w', encoding='utf-8') as f:
                f.write(content)

    print(f'  ✅ {folder_name} 处理完成')
    return True

def sub_run(args, **kwargs):
    """subprocess.run wrapper with utf-8 env"""
    # git命令自动追加HTTP/1.1配置
    if args and args[0] == 'git':
        args = ['git'] + GIT_OPTS + args[1:]
    result = subprocess.run(args, capture_output=True, env=ENV, cwd=REPO_ROOT, **kwargs)
    # 手动解码，忽略GBK错误
    try:
        result.stdout = result.stdout.decode('utf-8') if result.stdout else ''
    except:
        result.stdout = result.stdout.decode('gbk', errors='replace') if result.stdout else ''
    try:
        result.stderr = result.stderr.decode('utf-8') if result.stderr else ''
    except:
        result.stderr = result.stderr.decode('gbk', errors='replace') if result.stderr else ''
    return result

def sync_and_push(has_changes=True):
    """同步到repo并git提交推送"""
    script_path = os.path.join(SCRIPT_DIR, 'sync_ip_library.py')
    if os.path.exists(script_path):
        r = sub_run(['python', script_path])
        if r and r.stdout.strip():
            print(f'  {r.stdout.strip()}')

    # 检查是否有未提交的变更 或 未推送的commit
    has_uncommitted = bool(sub_run(['git', 'diff', '--stat']).stdout.strip())
    has_unpushed = False
    for branch in ['main', 'style-source']:
        r = sub_run(['git', 'log', f'origin/{branch}..{branch}', '--oneline'])
        if r.stdout.strip():
            has_unpushed = True

    if has_uncommitted:
        sub_run(['git', 'add', '-A'])
        sub_run(['git', 'commit', '-m', 'auto-sync: update IP gallery'])

    if has_uncommitted or has_unpushed:
        for branch in ['main', 'style-source']:
            sub_run(['git', 'checkout', branch])
            if branch == 'style-source':
                sub_run(['git', 'merge', 'main', '--no-edit'])
            r = sub_run(['git', 'push', 'origin', branch])
            if r.returncode == 0:
                print(f'  🚀 {branch} 已推送')
            else:
                print(f'  ⚠️  {branch} 推送失败: {r.stderr.strip()[:80]}')
        sub_run(['git', 'checkout', 'main'])
    else:
        print(f'  📭 没有变更，跳过推送')

def run_once():
    """执行一次巡检"""
    print(f'🔍 巡检IP库...')

    if not os.path.exists(DESKTOP_IP_DIR):
        print(f'  ❌ 桌面IP目录不存在: {DESKTOP_IP_DIR}')
        return

    # 读取上次状态
    prev_state = {}
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                prev_state = json.load(f)
        except: pass

    current_state = {}
    has_new = False

    for item in os.listdir(DESKTOP_IP_DIR):
        fpath = os.path.join(DESKTOP_IP_DIR, item)
        if not os.path.isdir(fpath) or item.startswith('.'):
            continue

        current_state[item] = get_folder_state(fpath)

        if needs_processing(fpath):
            if process_ip(item):
                has_new = True
        elif item not in prev_state or prev_state.get(item) != current_state[item]:
            # 有变更但不需要处理 (可能已经处理过了，但内容变了)
            print(f'  📝 检测到变更: {item}')

    # 如果只是状态变化但不需要处理，也同步一下
    if not has_new and prev_state != current_state:
        has_new = True

    # 保存状态
    with open(STATE_FILE, 'w') as f:
        json.dump(current_state, f, indent=2)

    # 同步和推送
    sync_and_push(has_new or (prev_state != current_state))
    print(f'✅ 巡检完成')

def run_watch(interval=180):
    """持续监控模式"""
    print(f'👀 启动监控模式 (每 {interval} 秒巡检一次)')
    print(f'   将图片放入: {DESKTOP_IP_DIR}\\IP名称\\')
    print()
    while True:
        run_once()
        print(f'⏳ 等待 {interval} 秒...')
        time.sleep(interval)

if __name__ == '__main__':
    if '--watch' in sys.argv:
        run_watch()
    else:
        run_once()
