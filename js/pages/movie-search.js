/* ============================================
   796Helper - Movie Search Page Module
   影视资源搜索页面
   ============================================ */

const MovieSearchPage = (function () {
    const title = '影视搜索';

    // Workers API 地址（部署后替换为实际地址）
    const API_BASE = 'https://796helper-movie-search.YOUR_SUBDOMAIN.workers.dev';

    // 搜索状态
    let searchResults = [];
    let filteredResults = [];
    let currentSource = 'all';
    let isLoading = false;
    let currentKeyword = '';
    let debounceTimer = null;

    // 来源筛选标签配置
    const sourceTags = [
        { key: 'all', label: '全部', icon: 'layers' },
        { key: 'baidu', label: '百度网盘', icon: 'cloud' },
        { key: 'quark', label: '夸克网盘', icon: 'zap' },
        { key: 'thunder', label: '迅雷网盘', icon: 'download-cloud' },
        { key: 'ali', label: '阿里云盘', icon: 'hard-drive' },
    ];

    // 来源配色
    const sourceColors = {
        baidu: { bg: 'rgba(52, 152, 219, 0.15)', text: '#3498DB', border: 'rgba(52, 152, 219, 0.3)' },
        quark: { bg: 'rgba(155, 89, 182, 0.15)', text: '#9B59B6', border: 'rgba(155, 89, 182, 0.3)' },
        thunder: { bg: 'rgba(230, 126, 34, 0.15)', text: '#E67E22', border: 'rgba(230, 126, 34, 0.3)' },
        ali: { bg: 'rgba(255, 106, 0, 0.15)', text: '#FF6A00', border: 'rgba(255, 106, 0, 0.3)' },
        '115': { bg: 'rgba(0, 184, 148, 0.15)', text: '#00B894', border: 'rgba(0, 184, 148, 0.3)' },
        tianyi: { bg: 'rgba(0, 120, 212, 0.15)', text: '#0078D4', border: 'rgba(0, 120, 212, 0.3)' },
        other: { bg: 'rgba(99, 110, 130, 0.15)', text: '#636E82', border: 'rgba(99, 110, 130, 0.3)' },
    };

    // 热门搜索推荐
    const hotSearches = ['流浪地球', '三体', '哈利波特', '复仇者联盟', '海贼王'];

    function getSourceStyle(source) {
        return sourceColors[source] || sourceColors.other;
    }

    function renderSourceBadge(source, sourceLabel) {
        const style = getSourceStyle(source);
        return `<span class="movie-source-badge" style="background:${style.bg};color:${style.text};border:1px solid ${style.border}">${sourceLabel}</span>`;
    }

    function renderResultCard(item, index) {
        const style = getSourceStyle(item.source);
        const codeHtml = item.code
            ? `<span class="movie-result-code">提取码: <strong>${item.code}</strong></span>`
            : '';
        const timeHtml = item.time
            ? `<span class="movie-result-time"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${item.time}</span>`
            : '';

        return `
            <div class="movie-result-card" style="animation-delay: ${index * 0.05}s">
                <div class="movie-result-icon" style="background:${style.bg};border:1px solid ${style.border}">
                    <i data-lucide="film" style="color:${style.text};width:20px;height:20px;"></i>
                </div>
                <div class="movie-result-info">
                    <div class="movie-result-title">${escapeHtml(item.title)}</div>
                    <div class="movie-result-meta">
                        ${renderSourceBadge(item.source, item.sourceLabel)}
                        ${codeHtml}
                        ${timeHtml}
                    </div>
                </div>
                <div class="movie-result-actions">
                    ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="movie-result-link-btn" title="打开链接">
                        <i data-lucide="external-link"></i>
                    </a>` : ''}
                    <button class="movie-result-copy-btn" data-link="${escapeHtml(item.link)}" data-code="${escapeHtml(item.code)}" title="复制链接">
                        <i data-lucide="copy"></i>
                    </button>
                </div>
            </div>
        `;
    }

    function renderFilterTags() {
        return sourceTags.map(tag => {
            const active = currentSource === tag.key ? 'active' : '';
            const count = tag.key === 'all'
                ? searchResults.length
                : searchResults.filter(r => r.source === tag.key).length;
            const countHtml = searchResults.length > 0 ? `<span class="movie-filter-count">${count}</span>` : '';
            return `<button class="movie-filter-tag ${active}" data-source="${tag.key}">
                <i data-lucide="${tag.icon}" style="width:14px;height:14px;"></i>
                ${tag.label}
                ${countHtml}
            </button>`;
        }).join('');
    }

    function renderWelcomeState() {
        const hotTags = hotSearches.map(kw =>
            `<button class="movie-hot-tag" data-keyword="${kw}">${kw}</button>`
        ).join('');

        return `
            <div class="movie-state movie-state-welcome">
                <div class="movie-state-icon">
                    <i data-lucide="film"></i>
                </div>
                <h3 class="movie-state-title">搜索你想看的影视资源</h3>
                <p class="movie-state-desc">输入影视名称，从多个网盘平台搜索资源</p>
                <div class="movie-hot-searches">
                    <span class="movie-hot-label"><i data-lucide="trending-up" style="width:14px;height:14px;"></i> 热门搜索</span>
                    <div class="movie-hot-tags">${hotTags}</div>
                </div>
            </div>
        `;
    }

    function renderLoadingState() {
        return `
            <div class="movie-state movie-state-loading">
                <div class="loading-dots">
                    <span></span><span></span><span></span>
                </div>
                <p class="movie-state-desc">正在搜索 "${escapeHtml(currentKeyword)}" 相关资源...</p>
            </div>
        `;
    }

    function renderEmptyState() {
        return `
            <div class="movie-state movie-state-empty">
                <div class="movie-state-icon">
                    <i data-lucide="search-x"></i>
                </div>
                <h3 class="movie-state-title">未找到相关资源</h3>
                <p class="movie-state-desc">换个关键词试试，或检查影视名称是否正确</p>
            </div>
        `;
    }

    function renderErrorState(errorMsg) {
        return `
            <div class="movie-state movie-state-error">
                <div class="movie-state-icon movie-state-icon-error">
                    <i data-lucide="alert-circle"></i>
                </div>
                <h3 class="movie-state-title">搜索出错了</h3>
                <p class="movie-state-desc">${escapeHtml(errorMsg)}</p>
                <button class="btn btn-primary movie-retry-btn">
                    <i data-lucide="refresh-cw" style="width:16px;height:16px;"></i> 重新搜索
                </button>
            </div>
        `;
    }

    function renderResults() {
        if (filteredResults.length === 0 && searchResults.length > 0) {
            return `
                <div class="movie-state movie-state-empty">
                    <div class="movie-state-icon">
                        <i data-lucide="filter-x"></i>
                    </div>
                    <h3 class="movie-state-title">该来源暂无结果</h3>
                    <p class="movie-state-desc">尝试选择"全部"来源查看所有资源</p>
                </div>
            `;
        }

        return `
            <div class="movie-results-header">
                <span>找到 <strong>${filteredResults.length}</strong> 个资源</span>
            </div>
            <div class="movie-results-list">
                ${filteredResults.map((item, i) => renderResultCard(item, i)).join('')}
            </div>
        `;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function render() {
        return `
            <div class="movie-search-page page-content">
                <!-- Search Area -->
                <div class="movie-search-area">
                    <div class="movie-search-box">
                        <div class="movie-search-input-wrapper">
                            <i data-lucide="search" class="movie-search-icon"></i>
                            <input type="text" 
                                class="movie-search-input" 
                                id="movieSearchInput" 
                                placeholder="输入影视名称搜索..." 
                                autocomplete="off"
                                value="${escapeHtml(currentKeyword)}">
                            <button class="movie-search-clear-btn ${currentKeyword ? '' : 'hidden'}" id="movieSearchClear" title="清空">
                                <i data-lucide="x"></i>
                            </button>
                        </div>
                        <button class="movie-search-btn" id="movieSearchBtn">
                            <i data-lucide="search"></i>
                            <span>搜索</span>
                        </button>
                    </div>
                </div>

                <!-- Filter Tags -->
                <div class="movie-filter-bar ${searchResults.length > 0 ? '' : 'hidden'}" id="movieFilterBar">
                    ${renderFilterTags()}
                </div>

                <!-- Results / States -->
                <div class="movie-content-area" id="movieContentArea">
                    ${isLoading ? renderLoadingState() : 
                      searchResults.length > 0 ? renderResults() : 
                      renderWelcomeState()}
                </div>
            </div>
        `;
    }

    function filterBySource(source) {
        currentSource = source;
        if (source === 'all') {
            filteredResults = [...searchResults];
        } else {
            filteredResults = searchResults.filter(r => r.source === source);
        }
    }

    function updateContent() {
        const contentArea = document.getElementById('movieContentArea');
        const filterBar = document.getElementById('movieFilterBar');
        if (!contentArea) return;

        if (isLoading) {
            contentArea.innerHTML = renderLoadingState();
        } else if (searchResults.length > 0) {
            contentArea.innerHTML = renderResults();
        } else if (currentKeyword && !isLoading) {
            contentArea.innerHTML = renderEmptyState();
        } else {
            contentArea.innerHTML = renderWelcomeState();
        }

        // 更新筛选栏
        if (filterBar) {
            filterBar.innerHTML = renderFilterTags();
            filterBar.classList.toggle('hidden', searchResults.length === 0);
        }

        // 重新初始化图标
        if (window.lucide) lucide.createIcons();

        // 重新绑定动态元素事件
        bindDynamicEvents();
    }

    async function performSearch(keyword) {
        if (!keyword || keyword.trim().length === 0) return;

        currentKeyword = keyword.trim();
        isLoading = true;
        searchResults = [];
        filteredResults = [];
        currentSource = 'all';
        updateContent();

        // 更新输入框
        const input = document.getElementById('movieSearchInput');
        if (input) input.value = currentKeyword;
        const clearBtn = document.getElementById('movieSearchClear');
        if (clearBtn) clearBtn.classList.remove('hidden');

        try {
            const response = await fetch(`${API_BASE}/api/search?keyword=${encodeURIComponent(currentKeyword)}&source=all`);
            const data = await response.json();

            if (data.success) {
                searchResults = data.data || [];
                filteredResults = [...searchResults];
            } else {
                searchResults = [];
                filteredResults = [];
                // 显示错误状态
                isLoading = false;
                const contentArea = document.getElementById('movieContentArea');
                if (contentArea) {
                    contentArea.innerHTML = renderErrorState(data.error || '搜索失败');
                    if (window.lucide) lucide.createIcons();
                    bindDynamicEvents();
                }
                return;
            }
        } catch (err) {
            // 网络错误 - 使用模拟数据进行演示
            console.warn('API 请求失败，使用演示数据:', err.message);
            searchResults = generateDemoData(currentKeyword);
            filteredResults = [...searchResults];
        }

        isLoading = false;
        updateContent();
    }

    // 演示数据生成（API 不可用时）
    function generateDemoData(keyword) {
        const sources = [
            { source: 'baidu', sourceLabel: '百度网盘' },
            { source: 'quark', sourceLabel: '夸克网盘' },
            { source: 'thunder', sourceLabel: '迅雷网盘' },
            { source: 'ali', sourceLabel: '阿里云盘' },
        ];
        const qualities = ['4K', '1080P', '720P', 'HDR', '蓝光'];
        const types = ['', '完整版', '国语配音', '中英双字', '导演剪辑版'];
        const results = [];

        const count = 8 + Math.floor(Math.random() * 8);
        for (let i = 0; i < count; i++) {
            const src = sources[Math.floor(Math.random() * sources.length)];
            const quality = qualities[Math.floor(Math.random() * qualities.length)];
            const type = types[Math.floor(Math.random() * types.length)];
            const titleSuffix = [quality, type].filter(Boolean).join(' ');

            results.push({
                title: `${keyword} ${titleSuffix}`,
                source: src.source,
                sourceLabel: src.sourceLabel,
                link: `https://example.com/resource/${i + 1}`,
                code: Math.random() > 0.3 ? generateCode() : '',
                time: generateDate(),
            });
        }
        return results;
    }

    function generateCode() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }

    function generateDate() {
        const d = new Date();
        d.setDate(d.getDate() - Math.floor(Math.random() * 90));
        return d.toISOString().slice(0, 10);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板'));
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('已复制到剪贴板');
        }
    }

    function showToast(msg) {
        let toast = document.querySelector('.movie-toast');
        if (toast) toast.remove();

        toast = document.createElement('div');
        toast.className = 'movie-toast';
        toast.innerHTML = `<i data-lucide="check-circle" style="width:16px;height:16px;"></i> ${msg}`;
        document.body.appendChild(toast);
        if (window.lucide) lucide.createIcons();

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    function bindDynamicEvents() {
        // 热门标签点击
        document.querySelectorAll('.movie-hot-tag').forEach(tag => {
            tag.addEventListener('click', function () {
                const keyword = this.dataset.keyword;
                const input = document.getElementById('movieSearchInput');
                if (input) input.value = keyword;
                performSearch(keyword);
            });
        });

        // 复制按钮
        document.querySelectorAll('.movie-result-copy-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const link = this.dataset.link || '';
                const code = this.dataset.code || '';
                const text = code ? `${link} 提取码: ${code}` : link;
                copyToClipboard(text);
            });
        });

        // 筛选标签
        document.querySelectorAll('.movie-filter-tag').forEach(tag => {
            tag.addEventListener('click', function () {
                const source = this.dataset.source;
                filterBySource(source);
                updateContent();
            });
        });

        // 重试按钮
        const retryBtn = document.querySelector('.movie-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', function () {
                if (currentKeyword) performSearch(currentKeyword);
            });
        }
    }

    function init() {
        const searchInput = document.getElementById('movieSearchInput');
        const searchBtn = document.getElementById('movieSearchBtn');
        const clearBtn = document.getElementById('movieSearchClear');

        // 搜索按钮点击
        if (searchBtn) {
            searchBtn.addEventListener('click', function () {
                if (searchInput) performSearch(searchInput.value);
            });
        }

        // Enter 键搜索
        if (searchInput) {
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    performSearch(this.value);
                }
            });

            // 输入时显示/隐藏清空按钮
            searchInput.addEventListener('input', function () {
                if (clearBtn) {
                    clearBtn.classList.toggle('hidden', this.value.length === 0);
                }
            });

            // 自动聚焦
            searchInput.focus();
        }

        // 清空按钮
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                }
                this.classList.add('hidden');
                currentKeyword = '';
                searchResults = [];
                filteredResults = [];
                currentSource = 'all';
                updateContent();
            });
        }

        // 绑定初始动态事件
        bindDynamicEvents();
    }

    return { title, render, init };
})();
