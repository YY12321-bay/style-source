"""同步桌面IP库到repo，生成ip_library.json"""
import os, shutil, json, re

src_base = r'C:\Users\zy\Desktop\ip_library'
dst_base = r'C:\Users\zy\.qwenpaw\workspaces\drawing_agent\repo_style_source\ip_gallery'
data_dir = r'C:\Users\zy\.qwenpaw\workspaces\drawing_agent\repo_style_source\data'

ips = []
for folder in os.listdir(src_base):
    fpath = os.path.join(src_base, folder)
    if not os.path.isdir(fpath) or folder.startswith('.'):
        continue

    readme_path = os.path.join(fpath, 'README.md')
    name = folder
    brand = ''
    style = ''
    scene = ''
    if os.path.exists(readme_path):
        with open(readme_path, 'r', encoding='utf-8') as f:
            content = f.read()
        m = re.search(r'\|\s*\*\*品牌\*\*\s*\|\s*(.+?)(?:\s*\||$)', content)
        if m:
            brand = m.group(1).strip()
        m = re.search(r'\|\s*\*\*风格\*\*\s*\|\s*(.+?)(?:\s*\||$)', content)
        if m:
            style = m.group(1).strip()
        m = re.search(r'\|\s*\*\*产品场景\*\*\s*\|\s*(.+?)(?:\s*\||$)', content)
        if m:
            scene = m.group(1).strip()

    dst_folder = os.path.join(dst_base, folder)
    os.makedirs(dst_folder, exist_ok=True)

    for fname, newname in [('reference_thumb.jpg', 'thumb.jpg'), ('reference_square.jpg', 'square.jpg'), ('reference.jpg', 'reference.jpg')]:
        src = os.path.join(fpath, fname)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(dst_folder, newname))

    # 复制设定集
    sheji_src = os.path.join(fpath, '设定集.md')
    if os.path.exists(sheji_src):
        shutil.copy2(sheji_src, os.path.join(dst_folder, '设定集.md'))

    ips.append({
        'id': folder,
        'name': name,
        'brand': brand,
        'scene': scene,
        'style': style,
        'has_sheji': os.path.exists(os.path.join(fpath, '设定集.md')),
        'thumb': f'ip_gallery/{folder}/thumb.jpg',
        'square': f'ip_gallery/{folder}/square.jpg',
        'reference': f'ip_gallery/{folder}/reference.jpg'
    })

os.makedirs(data_dir, exist_ok=True)
with open(os.path.join(data_dir, 'ip_library.json'), 'w', encoding='utf-8') as f:
    json.dump({'ips': ips, 'total': len(ips)}, f, ensure_ascii=False, indent=2)

print(f'同步完成: {len(ips)} 个IP')
for ip in ips:
    print(f'  - {ip["name"]} ({ip["brand"]}) [{ip["scene"]}]')
