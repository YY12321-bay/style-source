#!/usr/bin/env python3
"""上传配图到 style-source/images/styles_previews/，自动生成 WebP 版本（不再生成 JPEG）。

用法：python3 scripts/upload_preview.py <图片路径> <风格名>

示例：
  python3 scripts/upload_preview.py /tmp/preview.jpg bubble_card
  → 输出：
      WebP:  https://.../bubble_card_a3f8c92e.webp（全尺寸）
      Thumb: https://.../bubble_card_a3f8c92e.thumb.webp（400px 缩略图）
"""
import os
import sys
import hashlib
import subprocess
from PIL import Image

IMAGES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'images', 'styles_previews')
STYLE_SOURCE_URL = 'https://malongan.github.io/style-source/images/styles_previews'


def get_content_hash(image_path: str) -> str:
    """计算图片内容的 MD5 哈希前 8 位"""
    hash_md5 = hashlib.md5()
    with open(image_path, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b''):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()[:8]


def main():
    if len(sys.argv) < 3:
        print('用法: python3 scripts/upload_preview.py <图片路径> <风格名>')
        print('示例: python3 scripts/upload_preview.py /tmp/preview.jpg bubble_card')
        sys.exit(1)

    image_path = sys.argv[1]
    style_name = sys.argv[2]

    if not os.path.isfile(image_path):
        print(f'❌ 图片文件不存在: {image_path}')
        sys.exit(1)

    # 压缩到最大 1000px（sips 原地修改）
    print(f'📐 压缩到 1000px...')
    try:
        subprocess.run(
            ['sips', '-Z', '1000', image_path],
            check=True, capture_output=True, text=True
        )
    except subprocess.CalledProcessError as e:
        print(f'⚠️  sips 压缩失败: {e.stderr}')

    # 计算内容哈希
    content_hash = get_content_hash(image_path)

    # 确保目录存在
    os.makedirs(IMAGES_DIR, exist_ok=True)

    # 打开图片
    img = Image.open(image_path)
    w, h = img.size

    # 1. 输出全尺寸 WebP（quality=85, method=6 最高压缩率）
    webp_filename = f'{style_name}_{content_hash}.webp'
    webp_path = os.path.join(IMAGES_DIR, webp_filename)
    if max(w, h) > 1000:
        ratio = 1000 / max(w, h)
        img_full = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    else:
        img_full = img.copy()
    img_full.save(webp_path, 'WEBP', quality=85, method=6)
    img_full.close()

    # 2. 输出缩略图 WebP（400px, quality=75）
    thumb_filename = f'{style_name}_{content_hash}.thumb.webp'
    thumb_path = os.path.join(IMAGES_DIR, thumb_filename)
    if max(w, h) > 400:
        ratio = 400 / max(w, h)
        img_thumb = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
    else:
        img_thumb = img.copy()
    img_thumb.save(thumb_path, 'WEBP', quality=75, method=6)
    img_thumb.close()

    img.close()

    # 计算各版本大小
    webp_size = os.path.getsize(webp_path) / 1024
    thumb_size = os.path.getsize(thumb_path) / 1024

    # 输出
    webp_url = f'{STYLE_SOURCE_URL}/{webp_filename}'
    thumb_url = f'{STYLE_SOURCE_URL}/{thumb_filename}'

    print(f'✅ 图片已保存 ({style_name})')
    print(f'   WebP:  {webp_url}  ({webp_size:.0f}KB)')
    print(f'   Thumb: {thumb_url}  ({thumb_size:.0f}KB)')
    print()
    print('下一步:')
    print(f'  1. 将 WebP URL 填入风格文件的 ## 参考配图')
    print(f'  2. git add images/styles_previews/{style_name}_{content_hash}*')
    print(f'  3. git commit -m "feat: add preview for {style_name}"')


if __name__ == '__main__':
    main()
