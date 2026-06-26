/**
 * Gallery 功能脚本 v3
 * 包含：搜索过滤、标签筛选、收藏、Lightbox信息卡片、深色模式
 */

(function() {
  'use strict';

  // ========== 状态管理 ==========
  const state = {
    currentTag: 'all',
    currentCategory: 'all',
    currentSort: 'default',
    searchQuery: '',
    showFavoritesOnly: false,
    favorites: JSON.parse(localStorage.getItem('galleryFavorites') || '[]'),
    theme: localStorage.getItem('galleryTheme') || 'light'
  };

  // 标签最小展示频次阈值（低于此值折叠到「其他」）
  const TAG_MIN_COUNT = 5;

  // ========== DOM 元素 ==========
  let elements = {};

  // ========== 初始化 ==========
  function init() {
    cacheElements();
    loadTheme();
    bindEvents();
    extractTags();
    extractCategories();
    renderSidebarTags();
    renderCategoryFilters();
  }

  function cacheElements() {
    elements = {
      searchInput: document.getElementById('searchInput'),
      themeToggle: document.getElementById('themeToggle'),
      filterFavorites: document.getElementById('filterFavorites'),
      clearFilters: document.getElementById('clearFilters'),
      sortSelect: document.getElementById('sortSelect'),
      galleryGrid: document.querySelector('.gallery-grid'),
      styleCards: document.querySelectorAll('.style-card'),
      lightbox: document.getElementById('lightbox'),
      lightboxCard: document.querySelector('.lightbox-card'),
      lightboxClose: document.getElementById('lightboxClose')
    };
  }

  // ========== 主题切换 ==========
  function loadTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
  }

  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('galleryTheme', state.theme);
    updateThemeIcon();
  }

  function updateThemeIcon() {
    if (elements.themeToggle) {
      elements.themeToggle.textContent = state.theme === 'light' ? '🌙' : '☀️';
    }
  }

  // ========== 标签提取 - 从 dataset 中提取 ==========
  function extractTags() {
    const tagsMap = { all: 0 };
    
    elements.styleCards.forEach(card => {
      const tagsStr = card.dataset.tags || '';
      const tags = tagsStr.split(',').filter(t => t.trim());
      tags.forEach(tag => {
        const tagText = tag.trim();
        if (tagText) {
          if (!tagsMap[tagText]) {
            tagsMap[tagText] = 0;
          }
          tagsMap[tagText]++;
        }
      });
    });
    
    // 按频次分类：高频（≥5次）保留，低频折叠
    const highFreq = {};
    let lowFreqCount = 0;
    Object.entries(tagsMap).forEach(([tag, count]) => {
      if (tag === 'all') {
        highFreq.all = count;
      } else if (count >= TAG_MIN_COUNT) {
        highFreq[tag] = count;
      } else {
        lowFreqCount += count;
      }
    });
    if (lowFreqCount > 0) {
      highFreq['_other'] = lowFreqCount;
    }
    
    window.galleryTags = highFreq;
    window.galleryTagsRaw = tagsMap; // 保留完整数据用于筛选
  }

  // ========== 分类提取 ==========
  function extractCategories() {
    const categoriesMap = { all: 0 };
    
    elements.styleCards.forEach(card => {
      const category = card.dataset.category || 'root';
      if (!categoriesMap[category]) {
        categoriesMap[category] = 0;
      }
      categoriesMap[category]++;
    });
    
    window.galleryCategories = categoriesMap;
  }

  // ========== 渲染分类按钮 ==========
  function renderCategoryFilters() {
    // 在 filter-bar 后添加分类筛选栏
    const filterBar = document.querySelector('.filter-bar');
    if (!filterBar) return;

    const categories = Object.entries(window.galleryCategories || {});
    categories.sort((a, b) => {
      // 固定排序：all 优先，然后按数量
      if (a[0] === 'all') return -1;
      if (b[0] === 'all') return 1;
      return b[1] - a[1];
    });

    // 分类显示名称映射
    const categoryNames = {
      'all': '📦 全部',
      'social_media': '📱 社交媒体',
      'brand_kv': '🎨 品牌视觉',
      'e-commerce': '🛒 电商',
      'science': '🔬 科研',
      'print': '📚 印刷品',
      'ip_character': '🎭 IP角色',
      'travel': '✈️ 旅行',
      'fashion': '👔 时尚',
      'creative': '🎪 创意',
      'vigo_cookbook': '📖 Cookbook',
      'meigen': '⚠️ 待整理',
      'root': '📁 未分类'
    };

    let html = '<div class="category-filter">';
    categories.forEach(([cat, count]) => {
      const name = categoryNames[cat] || cat;
      const active = state.currentCategory === cat ? 'active' : '';
      html += `<button class="category-btn ${active}" data-category="${cat}">${name} <span class="tag-count">${count}</span></button>`;
    });
    html += '</div>';

    filterBar.insertAdjacentHTML('afterend', html);

    // 绑定分类按钮事件
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', handleCategoryClick);
    });
  }

  // ========== 分类筛选处理 ==========
  function handleCategoryClick(e) {
    const btn = e.currentTarget;
    const category = btn.dataset.category;
    
    // 更新状态
    state.currentCategory = category;
    
    // 更新按钮样式
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // 重新过滤
    filterCards();
  }

  function renderSidebarTags() {
    const sidebar = document.querySelector('.sidebar .tag-list');
    if (!sidebar) return;

    const tags = Object.entries(window.galleryTags || {});
    tags.sort((a, b) => {
      // all 排第一，_other 排最后
      if (a[0] === 'all') return -1;
      if (b[0] === 'all') return 1;
      if (a[0] === '_other') return 1;
      if (b[0] === '_other') return -1;
      return b[1] - a[1];
    });

    const total = Object.values(window.galleryTagsRaw || window.galleryTags || {}).reduce((sum, t) => sum + t, 0);
    
    let html = `
      <button class="tag-item ${state.currentTag === 'all' ? 'active' : ''}" data-tag="all">
        📦 全部
        <span class="tag-count">${total}</span>
      </button>
    `;

    tags.forEach(([tag, count]) => {
      if (tag === '_other') {
        html += `<div class="other-tag-divider"></div>`;
        html += `<div style="width:100%;padding:4px 4px;font-size:10px;color:var(--text-muted);line-height:1.4;">
          🔍 其余 ${count} 个低频标签可直接搜索
        </div>`;
      } else if (tag !== 'all') {
        html += `
          <button class="tag-item ${state.currentTag === tag ? 'active' : ''}" data-tag="${tag}">
            ${tag}
            <span class="tag-count">${count}</span>
          </button>
        `;
      }
    });

    sidebar.innerHTML = html;
    
    // 绑定标签按钮事件
    sidebar.querySelectorAll('.tag-item').forEach(btn => {
      btn.addEventListener('click', handleTagClick);
    });
  }

  // ========== 事件处理 ==========
  function bindEvents() {
    // 搜索
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // 主题切换
    if (elements.themeToggle) {
      elements.themeToggle.addEventListener('click', toggleTheme);
    }

    // 排序
    if (elements.sortSelect) {
      elements.sortSelect.addEventListener('change', handleSortChange);
    }

    // 清除筛选
    if (elements.clearFilters) {
      elements.clearFilters.addEventListener('click', clearFilters);
    }

    // 收藏筛选
    if (elements.filterFavorites) {
      elements.filterFavorites.addEventListener('click', handleFavoriteFilter);
    }

    // 图片点击 - 打开信息卡片
    elements.styleCards.forEach(card => {
      const img = card.querySelector('.card-image');
      if (img) {
        img.addEventListener('click', () => openLightbox(card));
      }
      // 点击整个卡片也能打开详情
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.favorite-btn') && !e.target.closest('.card-link')) {
          openLightbox(card);
        }
      });
    });

    // Lightbox 关闭
    if (elements.lightbox) {
      elements.lightbox.addEventListener('click', (e) => {
        if (e.target === elements.lightbox || e.target.classList.contains('lightbox-card')) {
          closeLightbox();
        }
      });
    }
    if (elements.lightboxClose) {
      elements.lightboxClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeLightbox();
      });
    }

    // ESC 关闭 Lightbox
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.lightbox.classList.contains('show')) {
        closeLightbox();
      }
    });

    // 收藏按钮
    elements.styleCards.forEach(card => {
      const favBtn = card.querySelector('.favorite-btn');
      if (favBtn) {
        favBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleFavoriteToggle(card.dataset.id, favBtn);
        });
        updateFavoriteButton(card.dataset.id, favBtn);
      }
    });
  }

  function handleSearch(e) {
    state.searchQuery = e.target.value.toLowerCase().trim();
    filterCards();
  }

  function handleTagClick(e) {
    const btn = e.currentTarget;
    state.currentTag = btn.dataset.tag;
    
    // 更新所有标签按钮状态
    document.querySelectorAll('.tag-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`.tag-item[data-tag="${state.currentTag}"]`).forEach(b => b.classList.add('active'));
    
    filterCards();
  }

  function handleSortChange(e) {
    state.currentSort = e.target.value;
    sortCards();
    filterCards();
  }

  function sortCards() {
    const grid = elements.galleryGrid;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll('.style-card'));
    if (cards.length === 0) return;

    cards.sort(function(a, b) {
      if (state.currentSort === 'default') {
        // 保持原始顺序（按 data-original-index）
        return (parseInt(a.dataset.originalIndex) || 0) - (parseInt(b.dataset.originalIndex) || 0);
      } else if (state.currentSort === 'newest') {
        return (parseInt(b.dataset.originalIndex) || 0) - (parseInt(a.dataset.originalIndex) || 0);
      } else if (state.currentSort === 'name-asc') {
        var nameA = (a.querySelector('.card-title')?.textContent || '').toLowerCase();
        var nameB = (b.querySelector('.card-title')?.textContent || '').toLowerCase();
        return nameA.localeCompare(nameB);
      } else if (state.currentSort === 'name-desc') {
        var nameA = (a.querySelector('.card-title')?.textContent || '').toLowerCase();
        var nameB = (b.querySelector('.card-title')?.textContent || '').toLowerCase();
        return nameB.localeCompare(nameA);
      }
      return 0;
    });

    // 重新挂载排序后的卡片
    cards.forEach(function(card) {
      grid.appendChild(card);
    });

    // 刷新卡片引用
    elements.styleCards = document.querySelectorAll('.style-card');
  }

  function handleFavoriteFilter() {
    state.showFavoritesOnly = !state.showFavoritesOnly;
    elements.filterFavorites.classList.toggle('active', state.showFavoritesOnly);
    filterCards();
  }

  // ========== 清除所有筛选 ==========
  function clearFilters() {
    state.currentTag = 'all';
    state.currentCategory = 'all';
    state.currentSort = 'default';
    state.searchQuery = '';
    state.showFavoritesOnly = false;

    // 重置搜索框
    if (elements.searchInput) elements.searchInput.value = '';

    // 重置排序
    if (elements.sortSelect) elements.sortSelect.value = 'default';

    // 重置标签高亮
    document.querySelectorAll('.tag-item').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tag === 'all');
    });

    // 重置分类高亮
    document.querySelectorAll('.category-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.category === 'all');
    });

    // 重置收藏筛选
    state.showFavoritesOnly = false;
    if (elements.filterFavorites) elements.filterFavorites.classList.remove('active');

    // 重置排序 → 恢复原始顺序
    sortCards();

    // 重新过滤
    filterCards();
  }

  function handleFavoriteToggle(cardId, btn) {
    const index = state.favorites.indexOf(cardId);
    if (index > -1) {
      state.favorites.splice(index, 1);
      btn.classList.remove('active');
      btn.textContent = '收藏';
    } else {
      state.favorites.push(cardId);
      btn.classList.add('active');
      btn.textContent = '已收藏';
    }
    localStorage.setItem('galleryFavorites', JSON.stringify(state.favorites));
  }

  function updateFavoriteButton(cardId, btn) {
    if (state.favorites.includes(cardId)) {
      btn.classList.add('active');
      btn.textContent = '已收藏';
    } else {
      btn.classList.remove('active');
      btn.textContent = '收藏';
    }
  }

  // ========== 过滤逻辑 ==========
  function filterCards() {
    elements.styleCards.forEach(card => {
      const cardId = card.dataset.id;
      const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
      const tagsStr = card.dataset.tags || '';
      const triggers = card.dataset.triggers?.toLowerCase() || '';
      const category = card.dataset.category || '';
      
      let visible = true;

      // 分类筛选
      if (state.currentCategory !== 'all') {
        visible = visible && category === state.currentCategory;
      }

      // 标签筛选
      if (state.currentTag !== 'all') {
        const cardTags = tagsStr.split(',').map(t => t.trim());
        visible = visible && cardTags.includes(state.currentTag);
      }

      // 搜索筛选
      if (state.searchQuery) {
        visible = visible && (
          title.includes(state.searchQuery) ||
          tagsStr.toLowerCase().includes(state.searchQuery) ||
          triggers.includes(state.searchQuery)
        );
      }

      // 收藏筛选
      if (state.showFavoritesOnly) {
        visible = visible && state.favorites.includes(cardId);
      }

      card.classList.toggle('hidden', !visible);
    });

    // 更新计数
    const total = document.querySelectorAll('.style-card').length;
    const visible = document.querySelectorAll('.style-card:not(.hidden)').length;
    const counter = document.querySelector('.count-num');
    if (counter) {
      counter.textContent = visible;
    }

    // 清除筛选按钮可见性
    const hasActiveFilter = state.currentTag !== 'all' || state.currentCategory !== 'all' || 
                            state.searchQuery !== '' || state.showFavoritesOnly ||
                            state.currentSort !== 'default';
    if (elements.clearFilters) {
      elements.clearFilters.style.display = hasActiveFilter ? 'inline-block' : 'none';
    }
    
    // 显示无结果提示
    let noResults = document.querySelector('.no-results');
    
    if (visible === 0) {
      if (!noResults) {
        noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.innerHTML = `
          <div class="no-results-icon">🔍</div>
          <p>没有找到匹配的风格</p>
        `;
        elements.galleryGrid.appendChild(noResults);
      }
      noResults.style.display = 'block';
    } else if (noResults) {
      noResults.style.display = 'none';
    }
  }

  // ========== Lightbox 信息卡片 - 左图右文 ==========
  function openLightbox(card) {
    const data = extractCardData(card);
    renderLightboxContent(data);
    elements.lightbox.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function extractCardData(card) {
    return {
      imageUrl: card.querySelector('.card-image')?.src || '',
      title: card.querySelector('.card-title')?.textContent || '',
      number: card.dataset.number || '',
      summary: card.dataset.summary || '',
      features: card.dataset.features?.split('|').filter(f => f) || [],
      triggers: card.dataset.triggers || '',
      tags: card.dataset.tags?.split(',').filter(t => t) || [],
      link: card.querySelector('.card-link')?.href || '',
      linkText: card.querySelector('.card-link')?.textContent || ''
    };
  }

  function renderLightboxContent(data) {
    const card = elements.lightboxCard;
    
    // 标题（不含编号）
    card.querySelector('.lightbox-title').textContent = data.title;
    card.querySelector('.lightbox-index').textContent = data.number ? `#${data.number}` : '';
    
    // 图片
    const img = card.querySelector('.lightbox-image');
    img.src = data.imageUrl;
    img.alt = data.title;
    
    // 一句话理解
    const summarySection = card.querySelector('.lightbox-summary-section');
    if (data.summary) {
      summarySection.querySelector('.lightbox-summary').textContent = data.summary;
      summarySection.style.display = 'block';
    } else {
      summarySection.style.display = 'none';
    }
    
    // 触发词
    const triggersSection = card.querySelector('.lightbox-triggers-section');
    if (data.triggers) {
      triggersSection.querySelector('.lightbox-triggers').textContent = data.triggers;
      triggersSection.style.display = 'block';
    } else {
      triggersSection.style.display = 'none';
    }
    
    // 核心特点
    const featuresSection = card.querySelector('.lightbox-features-section');
    const featuresList = featuresSection.querySelector('.lightbox-features');
    if (data.features.length > 0) {
      featuresList.innerHTML = data.features.map(f => `<li>${f}</li>`).join('');
      featuresSection.style.display = 'block';
    } else {
      featuresSection.style.display = 'none';
    }
    
    // 标签
    const tagsSection = card.querySelector('.lightbox-tags-section');
    const tagsContainer = tagsSection.querySelector('.lightbox-tags');
    if (data.tags.length > 0) {
      tagsContainer.innerHTML = data.tags.map(t => `<span class="lightbox-tag">${t}</span>`).join('');
      tagsSection.style.display = 'block';
    } else {
      tagsSection.style.display = 'none';
    }
    
    // 链接
    const linkSection = card.querySelector('.lightbox-link-section');
    const linkEl = linkSection.querySelector('.lightbox-link');
    if (data.link) {
      linkEl.href = data.link;
      linkEl.textContent = data.linkText || '🔗 查看原文';
      linkSection.style.display = 'block';
    } else {
      linkSection.style.display = 'none';
    }
  }

  function closeLightbox() {
    elements.lightbox.classList.remove('show');
    document.body.style.overflow = '';
  }

  // ========== 工具函数 ==========
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ========== 启动 ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();