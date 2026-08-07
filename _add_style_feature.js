/* ============================================================
 *  ➕ 添加素材（网页端自助添加）
 *  通过 GitHub API 直接写入仓库：
 *   1. 预览图 → images/styles_previews/{id}_{hash}.webp (+thumb)
 *   2. data/styles.json 追加新风格（网页立即生效）
 *   3. styles/{category}/{id}.yaml 写入源文件（未来重建不丢）
 * ============================================================ */
(function () {
  var TOKEN_KEY = 'styleSourceToken';
  var OWNER = 'YY12321-bay';
  var REPO = 'style-source';
  var BRANCH = 'main';
  var IMG_DIR = 'images/styles_previews';
  var pendingImage = null;

  function $(id) { return document.getElementById(id); }

  function toast(msg, isErr) {
    var t = document.getElementById('styleToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'styleToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:40px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 18px;border-radius:8px;z-index:9999;font-size:14px;opacity:0;transition:opacity .25s;pointer-events:none;max-width:80vw;box-shadow:0 4px 14px rgba(0,0,0,.3);';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = isErr ? '#e74c3c' : '#111';
    t.style.opacity = '1';
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.style.opacity = '0'; }, 3500);
  }

  function openModal() {
    $('asToken').value = localStorage.getItem(TOKEN_KEY) || '';
    $('addStyleOverlay').style.display = 'flex';
  }
  function closeModal() {
    $('addStyleOverlay').style.display = 'none';
    pendingImage = null;
  }

  function utf8ToB64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64ToUtf8(b64) { return decodeURIComponent(escape(atob(b64))); }
  function b64encode(dataUrl) { return dataUrl.split(',')[1]; }

  function gh(token, method, path, body) {
    var headers = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' };
    var opts = { method: method, headers: headers };
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/' + path, opts).then(function (r) {
      if (!r.ok) {
        return r.json().then(function (j) {
          throw new Error((j && j.message) || ('HTTP ' + r.status));
        });
      }
      return r.status === 204 ? null : r.json();
    });
  }

  function imageFileToWebP(file, maxSide) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (!blob) { reject(new Error('图片转换失败')); return; }
          var reader = new FileReader();
          reader.onload = function () { resolve(reader.result); };
          reader.onerror = function () { reject(new Error('读取图片失败')); };
          reader.readAsDataURL(blob);
        }, 'image/webp', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片无法解析')); };
      img.src = url;
    });
  }

  function handleImage(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('图片不能超过 5MB', true); return; }
    var wrap = $('asPreviewWrap'), preview = $('asPreview');
    preview.src = URL.createObjectURL(file);
    wrap.style.display = 'inline-block';
    Promise.all([imageFileToWebP(file, 1200), imageFileToWebP(file, 400)]).then(function (res) {
      pendingImage = { file: file, webp: res[0], thumb: res[1] };
    }).catch(function (e) { toast(e.message, true); });
  }

  function extractPastedImage(e) {
    var items = (e.clipboardData || {}).items;
    if (!items) return false;
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && items[i].type && items[i].type.indexOf('image/') === 0) {
        var f = items[i].getAsFile();
        if (f) { e.preventDefault(); handleImage(f); return true; }
      }
    }
    return false;
  }

  function yamlScalar(s) {
    if (s == null) return "''";
    s = String(s);
    if (/[:#\n"']/.test(s)) return "'" + s.replace(/'/g, "''") + "'";
    return s;
  }

  function buildYaml(style, fileNames) {
    var L = [];
    L.push('name: ' + yamlScalar(style.name));
    L.push('category: ' + yamlScalar(style.category));
    L.push('ratio: ' + yamlScalar(style.ratio || ''));
    if (style.source_author) L.push('source_author: ' + yamlScalar(style.source_author));
    if (style.source_url) L.push('source_url: ' + yamlScalar(style.source_url));
    L.push('summary: ' + yamlScalar(style.summary || ''));
    L.push('tags:');
    (style.tags || []).forEach(function (t) { L.push('- ' + yamlScalar(t)); });
    L.push('triggers:');
    (style.triggers || []).forEach(function (t) { L.push('- ' + yamlScalar(t)); });
    L.push('features: []');
    L.push('variables: []');
    L.push('prompt: |-');
    (style.prompt || '').split('\n').forEach(function (l) { L.push('  ' + l); });
    if (fileNames && fileNames.webp) L.push('preview: ./' + IMG_DIR + '/' + fileNames.webp);
    L.push('id: ' + yamlScalar(style.id));
    L.push('code: ' + yamlScalar(style.code));
    return L.join('\n') + '\n';
  }

  function doSubmit() {
    var token = $('asToken').value.trim();
    var name = $('asName').value.trim();
    var prompt = $('asPrompt').value.trim();
    if (!token) { toast('请先填写 GitHub Token', true); return; }
    if (!name) { toast('请填写风格名称', true); return; }
    if (!prompt) { toast('请填写提示词', true); return; }
    localStorage.setItem(TOKEN_KEY, token);
    $('asSubmit').disabled = true;
    $('asSubmit').textContent = '⏳ 发布中...';

    (async function () {
      var id = 'style_' + Date.now().toString(36);

      // 1. 读取现有 styles.json，计算新编号
      var dataRes = await gh(token, 'GET', 'contents/data/styles.json?ref=' + BRANCH);
      var stylesJson = JSON.parse(b64ToUtf8(dataRes.content));
      var maxCode = 0;
      (stylesJson.styles || []).forEach(function (s) {
        var m = /^ST(\d+)$/.exec(s.code || '');
        if (m) maxCode = Math.max(maxCode, parseInt(m[1], 10));
      });
      var code = 'ST' + String(maxCode + 1).padStart(4, '0');

      // 2. 上传预览图（转 webp + thumb）
      var fileNames = null;
      if (pendingImage && pendingImage.webp) {
        var hash = Math.random().toString(36).slice(2, 10);
        fileNames = { webp: id + '_' + hash + '.webp', thumb: id + '_' + hash + '.thumb.webp' };
        await gh(token, 'PUT', 'contents/' + IMG_DIR + '/' + fileNames.webp, {
          message: 'add style preview ' + id, content: b64encode(pendingImage.webp), branch: BRANCH
        });
        await gh(token, 'PUT', 'contents/' + IMG_DIR + '/' + fileNames.thumb, {
          message: 'add style preview thumb ' + id, content: b64encode(pendingImage.thumb), branch: BRANCH
        });
      }

      // 3. 构造新风格对象
      var tags = $('asTags').value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
      var triggers = $('asTriggers').value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
      var previewPath = fileNames ? './' + IMG_DIR + '/' + fileNames.webp : '';
      var newStyle = {
        id: id, code: code, name: name, category: $('asCategory').value,
        tags: tags, triggers: triggers, scene: '', ratio: $('asRatio').value.trim(),
        summary: $('asSummary').value.trim(), features: [], prompt: prompt,
        variables: {}, source_url: $('asSourceUrl').value.trim(), source_author: $('asSourceAuthor').value.trim(),
        preview_urls: previewPath ? [previewPath] : [],
        preview_webp: previewPath,
        preview_webp_thumb: fileNames ? './' + IMG_DIR + '/' + fileNames.thumb : '',
        created_at: new Date().toISOString()
      };

      // 4. 写回 data/styles.json
      stylesJson.styles.push(newStyle);
      if (stylesJson.meta) {
        stylesJson.meta.total = stylesJson.styles.length;
        stylesJson.meta.generated = new Date().toISOString();
      }
      await gh(token, 'PUT', 'contents/data/styles.json', {
        message: 'add style ' + id + ' (' + name + ')',
        content: utf8ToB64(JSON.stringify(stylesJson, null, 2)),
        sha: dataRes.sha, branch: BRANCH
      });

      // 5. 写 yaml 源文件（保持 yaml 为真相源）
      var yaml = buildYaml(newStyle, fileNames);
      var cat = $('asCategory').value;
      await gh(token, 'PUT', 'contents/styles/' + cat + '/' + id + '.yaml', {
        message: 'add style yaml ' + id, content: utf8ToB64(yaml), branch: BRANCH
      });

      toast('✅ 已发布！刷新页面即可看到新风格');
      setTimeout(function () { location.reload(); }, 1200);
    })().catch(function (e) {
      toast('❌ 发布失败: ' + e.message, true);
      $('asSubmit').disabled = false;
      $('asSubmit').textContent = '🚀 添加并发布';
    });
  }

  function initAddStyle() {
    if (!document.getElementById('addStyleBtn')) return;
    $('addStyleBtn').addEventListener('click', openModal);
    $('addStyleClose').addEventListener('click', closeModal);
    $('asCancel').addEventListener('click', closeModal);
    $('addStyleOverlay').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
    $('asSubmit').addEventListener('click', doSubmit);
    var area = $('asUploadArea'), input = $('asImageInput');
    area.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () { handleImage(input.files[0]); input.value = ''; });
    area.addEventListener('paste', function (e) { extractPastedImage(e); });
    document.addEventListener('paste', function (e) {
      var ae = document.activeElement;
      var typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable);
      if (typing) return;
      extractPastedImage(e);
    });
    $('asRemoveImg').addEventListener('click', function () {
      pendingImage = null;
      $('asPreviewWrap').style.display = 'none';
      $('asPreview').src = '';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAddStyle);
  } else {
    initAddStyle();
  }
})();
