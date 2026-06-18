# 预览图规范与即梦下载指南

> 风格画廊的配图管理规范。包括存放位置、命名规则、图片处理、即梦下载流程。

---

## 1. 预览图存放位置

| 项目 | 值 |
|------|-----|
| 本地路径 | `images/styles_previews/` |
| Pages URL | `https://malongan.github.io/style-source/images/styles_previews/` |
| 管理方式 | git 版本管理（随 .md 一起提交） |
| 无需额外 Token | 同一仓库，SSH 即可 push |

## 2. 命名规则

```
{风格名}_{MD5[:8]}.{ext}

示例：
  inflatable_3d_flowers_d186e0b6.jpg
  y3k_cool_girl_portrait_d64d0282.jpg
```

| 部分 | 说明 | 示例 |
|------|------|------|
| `风格名` | .md 文件名（snake_case） | `inflatable_3d_flowers` |
| `MD5[:8]` | 图片内容的 MD5 前 8 位 | `d186e0b6` |
| `{ext}` | 文件格式 | `jpg` |

## 3. 图片处理规范

### 尺寸
原始任意尺寸 → 压缩到 **宽边 ≤ 1000px**（约 100KB）

### 命令
```bash
# webp → jpg → 压缩到 1000px
sips -s format jpeg input.webp --out input.jpg
sips -Z 1000 input.jpg --out output.jpg

# 计算哈希
HASH=$(python3 -c "import hashlib; print(hashlib.md5(open('output.jpg','rb').read()).hexdigest()[:8])")

# 复制到预览图目录
cp output.jpg images/styles_previews/风格名_${HASH}.jpg
```

## 4. 即梦下载流程

### 问题
即梦图片有反盗链，直接下载会 403。

### 正确流程

**① 提取基本数据**
```bash
python3 scripts/jimeng_extractor.py <workId> --json
```

**② 从页面获取原图 URL**
```
window._ROUTER_DATA → loaderData → workDetail → value → commonAttr → coverUrl
```
这是 **2048px 原图** URL，带独立签名参数。

**③ 下载**
```bash
curl -H "Referer: https://jimeng.jianying.com/" "coverUrl" -o /tmp/preview.webp
```

**④ 处理**
```bash
sips -s format jpeg /tmp/preview.webp --out /tmp/preview.jpg
sips -Z 1000 /tmp/preview.jpg --out /tmp/resized.jpg
HASH=$(python3 -c "import hashlib; print(hashlib.md5(open('/tmp/resized.jpg','rb').read()).hexdigest()[:8])")
cp /tmp/resized.jpg images/styles_previews/风格名_${HASH}.jpg
```

### ❌ 不要这样做
| 做法 | 结果 |
|------|------|
| 从页面 img 元素取 src | 仅 405px 缩略图 |
| 从 network_requests 复制 URL | 签名绑定尺寸 |
| 直接 curl 提取器的 cover_url | 403 |
| 浏览器直接打开图片 URL | 失败 |

### 比例验证
即梦提取器可能把 9:16 输出为 16:9。**以页面标注为准**。
