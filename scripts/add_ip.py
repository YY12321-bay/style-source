"""一键添加新IP到在线图库
用法: python scripts/add_ip.py <IP名称> <品牌> <风格> <图片路径>

示例: python scripts/add_ip.py 书猫 喜马拉雅 "3D可爱卡通" /path/to/image.jpg
"""
import os, sys, re, subprocess
from PIL import Image

if len(sys.argv) < 5:
    print('用法: python scripts/add_ip.py <IP名称> <品牌> <风格> <图片路径>')
    sys.exit(1)

name = sys.argv[1]
brand = sys.argv[2]
style = sys.argv[3]
img_path = sys.argv[4]

if not os.path.exists(img_path):
    print(f'❌ 图片不存在: {img_path}')
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
DESKTOP_IP_DIR = rf'C:\Users\zy\Desktop\ip_library\{name}'

# ===== 1. 创建IP目录 =====
os.makedirs(DESKTOP_IP_DIR, exist_ok=True)
print(f'📁 创建: {DESKTOP_IP_DIR}')

# ===== 2. 处理图片 =====
img = Image.open(img_path).convert('RGB')

def to_square(im, size, bg_color=(255, 255, 255)):
    """等比例缩放并填充白边到正方形，保留全部内容"""
    r = min(size / im.width, size / im.height)
    resized = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
    square = Image.new('RGB', (size, size), bg_color)
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    square.paste(resized, (x, y))
    return square

# reference.jpg — 最长边1200px，保持比例
ratio = min(1200 / img.width, 1200 / img.height, 1.0)
ref_img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
ref_img.save(os.path.join(DESKTOP_IP_DIR, 'reference.jpg'), 'JPEG', quality=85, optimize=True)

# reference_square.jpg — 800×800 白边填充（不裁剪内容）
to_square(img, 800).save(os.path.join(DESKTOP_IP_DIR, 'reference_square.jpg'), 'JPEG', quality=85, optimize=True)

# reference_thumb.jpg — 400×400 白边填充
to_square(img, 400).save(os.path.join(DESKTOP_IP_DIR, 'reference_thumb.jpg'), 'JPEG', quality=75, optimize=True)

print(f'  ✅ reference.jpg ({ref_img.size[0]}x{ref_img.size[1]})')
print(f'  ✅ reference_square.jpg (800x800)')
print(f'  ✅ reference_thumb.jpg (400x400)')

# ===== 3. README =====
readme = f"""# {name}

| 字段 | 内容 |
|------|------|
| **IP名称** | {name} |
| **品牌** | {brand} |
| **产品场景** | 待补充（品牌产品/服务相关场景） |
| **风格** | {style} |
| **参考图** | `reference.jpg` ({ref_img.size[0]}×{ref_img.size[1]}) |
| | `reference_square.jpg` (方形 800×800，API传参用) |

## 形象描述
{brand}品牌IP形象——{style}风格。

## 生图规范

### Prompt结构（IP × 风格）
```
{{风格描述}}，{{产品场景}}，{{角色动作表情}}，{{道具/元素}}
Maintain IP identity and consistency throughout.
```

### 基础句
```
Maintain IP identity and consistency throughout.
```

### Prompt编写规则
- ✅ 写：表情、动作、服装、场景、道具、构图
- ❌ 不写（有参考图时）：五官、体型、毛色等被参考图覆盖的特征

### 传参方式
```python
import base64
with open('reference_square.jpg', 'rb') as f:
    data_uri = f'data:image/jpeg;base64,{{base64.b64encode(f.read()).decode()}}'
```
"""
with open(os.path.join(DESKTOP_IP_DIR, 'README.md'), 'w', encoding='utf-8') as f:
    f.write(readme)

# ===== 4. 更新 _index.md =====
index_path = rf'C:\Users\zy\Desktop\ip_library\_index.md'
with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()
new_line = f'| [{name}]({name}/README.md) | {brand} | {style} | `{name}/reference_square.jpg` |\n'
content = content.rstrip() + '\n' + new_line
with open(index_path, 'w', encoding='utf-8') as f:
    f.write(content)

# ===== 5. 同步 + Git提交 =====
print()
subprocess.run(['python', 'scripts/sync_ip_library.py'], cwd=REPO_ROOT, check=True)

subprocess.run(['git', 'add', '-A'], cwd=REPO_ROOT, check=True)
subprocess.run(['git', 'commit', '-m', f'feat: add IP - {name} ({brand})'], cwd=REPO_ROOT, check=True)

for branch in ['main', 'style-source']:
    subprocess.run(['git', 'checkout', branch], cwd=REPO_ROOT, capture_output=True)
    if branch == 'style-source':
        subprocess.run(['git', 'merge', 'main', '--no-edit'], cwd=REPO_ROOT, capture_output=True)
    subprocess.run(['git', 'push', 'origin', branch], cwd=REPO_ROOT, check=True)

subprocess.run(['git', 'checkout', 'main'], cwd=REPO_ROOT, capture_output=True)
print(f'\n🎉 {name} 已上线！')
print(f'   🌐 https://yy12321-bay.github.io/style-source/ip_gallery/index.html')
