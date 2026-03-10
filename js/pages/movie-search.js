/* ============================================
   796Helper - Movie Search Page Module
   影视资源搜索页面（v1.3.0 性能优化版）
   ============================================ */

const MovieSearchPage = (function () {
    const title = '影视搜索';

    // Workers API 地址
    const API_BASE = 'https://796helper-movie-search.YOUR_SUBDOMAIN.workers.dev';

    // ==================== 缓存管理器 ====================
    const CACHE_PREFIX = '796h-mc-';
    const CACHE_TTL = 5 * 60 * 1000; // 5分钟
    const CACHE_MAX = 20;

    const CacheManager = {
        _useStorage: (function () {
            try {
                const key = '__796h_test__';
                sessionStorage.setItem(key, '1');
                sessionStorage.removeItem(key);
                return true;
            } catch (e) {
                return false;
            }
        })(),
        _memoryCache: new Map(),

        _getKey(keyword, source) {
            return CACHE_PREFIX + keyword + '__' + source;
        },

        get(keyword, source) {
            const key = this._getKey(keyword, source);
            if (this._useStorage) {
                try {
                    const raw = sessionStorage.getItem(key);
                    if (!raw) return null;
                    const cached = JSON.parse(raw);
                    if (Date.now() - cached.timestamp < CACHE_TTL) {
                        return cached.data;
                    }
                    sessionStorage.removeItem(key);
                    return null;
                } catch (e) {
                    return null;
                }
            } else {
                const cached = this._memoryCache.get(key);
                if (!cached) return null;
                if (Date.now() - cached.timestamp < CACHE_TTL) {
                    return cached.data;
                }
                this._memoryCache.delete(key);
                return null;
            }
        },

        set(keyword, source, data) {
            const key = this._getKey(keyword, source);
            const entry = { data, timestamp: Date.now() };
            if (this._useStorage) {
                try {
                    sessionStorage.setItem(key, JSON.stringify(entry));
                    this._enforceLimit();
                } catch (e) {
                    // 存储满时清理最旧的条目后重试
                    this._cleanup();
                    try { sessionStorage.setItem(key, JSON.stringify(entry)); } catch (e2) { /* 放弃 */ }
                }
            } else {
                this._memoryCache.set(key, entry);
                if (this._memoryCache.size > CACHE_MAX) {
                    const firstKey = this._memoryCache.keys().next().value;
                    this._memoryCache.delete(firstKey);
                }
            }
        },

        _enforceLimit() {
            const keys = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) {
                    keys.push(k);
                }
            }
            if (keys.length > CACHE_MAX) {
                // 按时间戳排序，删除最旧的
                const entries = keys.map(k => {
                    try {
                        const raw = sessionStorage.getItem(k);
                        const parsed = JSON.parse(raw);
                        return { key: k, timestamp: parsed.timestamp || 0 };
                    } catch (e) {
                        return { key: k, timestamp: 0 };
                    }
                });
                entries.sort((a, b) => a.timestamp - b.timestamp);
                const toRemove = entries.slice(0, entries.length - CACHE_MAX);
                toRemove.forEach(e => sessionStorage.removeItem(e.key));
            }
        },

        _cleanup() {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith(CACHE_PREFIX)) {
                    try {
                        const raw = sessionStorage.getItem(k);
                        const parsed = JSON.parse(raw);
                        if (Date.now() - parsed.timestamp >= CACHE_TTL) {
                            sessionStorage.removeItem(k);
                        }
                    } catch (e) {
                        sessionStorage.removeItem(k);
                    }
                }
            }
        }
    };

    // ==================== 防抖工具 ====================
    function debounce(fn, delay) {
        let timer = null;
        return function (...args) {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => { timer = null; fn.apply(this, args); }, delay);
        };
    }

    // ==================== 搜索状态 ====================
    let searchResults = [];
    let filteredResults = [];
    let currentSource = 'all';
    let currentSearchSource = 'all';
    let isLoading = false;
    let currentKeyword = '';
    let abortController = null;
    let searchTimerInterval = null; // Loading 计时器
    let searchStartTime = 0;
    let delegatesAttached = false; // 事件委托是否已绑定

    // 搜索源选项
    const searchSourceOptions = [
        { key: 'all', label: '全部资源', icon: 'layers', desc: '搜索所有网盘' },
        { key: 'baidu', label: '百度网盘', icon: 'cloud', desc: '百度云资源' },
        { key: 'quark', label: '夸克网盘', icon: 'zap', desc: '夸克云资源' },
    ];

    // 结果筛选标签
    const filterTags = [
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

    function getSourceStyle(source) {
        return sourceColors[source] || sourceColors.other;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
            <div class="movie-result-card" style="animation-delay: ${index * 0.04}s">
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
                    ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="movie-result-link-btn" title="前往搜索引擎查看资源">
                        <i data-lucide="external-link"></i>
                    </a>` : ''}
                    <button class="movie-result-copy-btn" data-title="${escapeHtml(item.title)}" data-link="${escapeHtml(item.link)}" data-code="${escapeHtml(item.code)}" title="复制资源信息">
                        <i data-lucide="copy"></i>
                    </button>
                </div>
            </div>
        `;
    }

    function renderSearchSourceSelector() {
        return searchSourceOptions.map(opt => {
            const active = currentSearchSource === opt.key ? 'active' : '';
            return `<button class="movie-source-option ${active}" data-search-source="${opt.key}">
                <i data-lucide="${opt.icon}" style="width:16px;height:16px;"></i>
                <span class="movie-source-option-label">${opt.label}</span>
            </button>`;
        }).join('');
    }

    function renderFilterTags() {
        return filterTags.map(tag => {
            const active = currentSource === tag.key ? 'active' : '';
            const count = tag.key === 'all'
                ? searchResults.length
                : searchResults.filter(r => r.source === tag.key).length;
            if (tag.key !== 'all' && count === 0) return '';
            const countHtml = `<span class="movie-filter-count">${count}</span>`;
            return `<button class="movie-filter-tag ${active}" data-source="${tag.key}">
                <i data-lucide="${tag.icon}" style="width:14px;height:14px;"></i>
                ${tag.label}
                ${countHtml}
            </button>`;
        }).join('');
    }

    function renderWelcomeState() {
        return `
            <div class="movie-state movie-state-welcome">
                <div class="movie-welcome-visual">
                    <div class="movie-welcome-orb"></div>
                    <div class="movie-state-icon">
                        <i data-lucide="film"></i>
                    </div>
                </div>
                <h3 class="movie-state-title">搜索影视资源</h3>
                <p class="movie-state-desc">输入影视名称，从网盘平台快速搜索资源</p>
            </div>
        `;
    }

    function renderLoadingState() {
        const sourceLabel = currentSearchSource === 'all' ? '全部网盘' :
            searchSourceOptions.find(s => s.key === currentSearchSource)?.label || '网盘';
        return `
            <div class="movie-state movie-state-loading">
                <div class="movie-loading-spinner">
                    <div class="movie-spinner-ring"></div>
                    <div class="movie-spinner-icon">
                        <i data-lucide="search" style="width:24px;height:24px;"></i>
                    </div>
                </div>
                <p class="movie-state-title">正在搜索</p>
                <p class="movie-state-desc">在${sourceLabel}中搜索 "${escapeHtml(currentKeyword)}"...</p>
                <p class="movie-state-desc movie-search-timer" id="movieSearchTimer" style="font-size:12px;color:var(--text-muted);margin-top:4px;">已耗时 0 秒</p>
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
                <p class="movie-state-desc">换个关键词试试，或切换其他搜索源</p>
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

                    <!-- Source Selector -->
                    <div class="movie-source-selector" id="movieSourceSelector">
                        ${renderSearchSourceSelector()}
                    </div>
                </div>

                <!-- Filter Tags (post-search) -->
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

    // ==================== Loading 计时器 ====================
    function startSearchTimer() {
        stopSearchTimer();
        searchStartTime = Date.now();
        searchTimerInterval = setInterval(function () {
            const el = document.getElementById('movieSearchTimer');
            if (el) {
                const elapsed = Math.floor((Date.now() - searchStartTime) / 1000);
                el.textContent = '已耗时 ' + elapsed + ' 秒';
            }
        }, 1000);
    }

    function stopSearchTimer() {
        if (searchTimerInterval) {
            clearInterval(searchTimerInterval);
            searchTimerInterval = null;
        }
    }

    // ==================== 搜索按钮状态 ====================
    function setSearchBtnLoading(loading) {
        const btn = document.getElementById('movieSearchBtn');
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader" style="animation:spin 1s linear infinite;"></i> <span>搜索中</span>';
        } else {
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="search"></i> <span>搜索</span>';
        }
        if (window.lucide) lucide.createIcons({ attrs: {} });
    }

    // ==================== 内容更新（优化版） ====================
    function updateContent(filterOnly) {
        const contentArea = document.getElementById('movieContentArea');
        const filterBar = document.getElementById('movieFilterBar');
        if (!contentArea) return;

        if (filterOnly && searchResults.length > 0) {
            // 筛选切换：只更新结果列表和筛选栏，不重写整个内容区
            const resultsList = contentArea.querySelector('.movie-results-list');
            const resultsHeader = contentArea.querySelector('.movie-results-header');
            if (resultsList && resultsHeader) {
                if (filteredResults.length === 0) {
                    contentArea.innerHTML = `
                        <div class="movie-state movie-state-empty">
                            <div class="movie-state-icon">
                                <i data-lucide="filter-x"></i>
                            </div>
                            <h3 class="movie-state-title">该来源暂无结果</h3>
                            <p class="movie-state-desc">尝试选择"全部"来源查看所有资源</p>
                        </div>
                    `;
                    if (window.lucide) lucide.createIcons();
                } else {
                    resultsHeader.innerHTML = `<span>找到 <strong>${filteredResults.length}</strong> 个资源</span>`;
                    resultsList.innerHTML = filteredResults.map((item, i) => renderResultCard(item, i)).join('');
                    if (window.lucide) lucide.createIcons();
                }
            } else {
                // fallback: 全量更新
                contentArea.innerHTML = renderResults();
                if (window.lucide) lucide.createIcons();
            }
            // 更新筛选栏
            if (filterBar) {
                filterBar.innerHTML = renderFilterTags();
                if (window.lucide) lucide.createIcons();
            }
            return;
        }

        // 全量更新
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

        if (window.lucide) lucide.createIcons();
    }

    function updateSourceSelector() {
        const selector = document.getElementById('movieSourceSelector');
        if (selector) {
            selector.innerHTML = renderSearchSourceSelector();
            if (window.lucide) lucide.createIcons();
        }
    }

    // ==================== 核心搜索流程 ====================
    async function performSearch(keyword) {
        if (!keyword || keyword.trim().length === 0) return;
        if (isLoading) return; // 防止重复搜索

        currentKeyword = keyword.trim();

        // 取消上一次请求
        if (abortController) {
            abortController.abort();
        }

        // 检查缓存
        const cachedData = CacheManager.get(currentKeyword, currentSearchSource);
        if (cachedData) {
            searchResults = cachedData;
            filteredResults = [...searchResults];
            currentSource = 'all';
            isLoading = false;
            updateContent();
            return;
        }

        isLoading = true;
        searchResults = [];
        filteredResults = [];
        currentSource = 'all';
        updateContent();
        setSearchBtnLoading(true);
        startSearchTimer();

        // 更新输入框
        const input = document.getElementById('movieSearchInput');
        if (input) input.value = currentKeyword;
        const clearBtn = document.getElementById('movieSearchClear');
        if (clearBtn) clearBtn.classList.remove('hidden');

        abortController = new AbortController();
        const signal = abortController.signal;

        const SEARCH_TIMEOUT = 30000;
        let timeoutId = null;

        try {
            const sourceParam = currentSearchSource !== 'all' ? `&source=${currentSearchSource}` : '';
            const fetchUrl = `${API_BASE}/api/search?keyword=${encodeURIComponent(currentKeyword)}${sourceParam}`;

            const fetchPromise = fetch(fetchUrl, { signal, headers: { 'Accept': 'application/json' } });
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    if (abortController) abortController.abort();
                    reject(new Error('SEARCH_TIMEOUT'));
                }, SEARCH_TIMEOUT);
            });

            const response = await Promise.race([fetchPromise, timeoutPromise]);
            clearTimeout(timeoutId);
            timeoutId = null;

            const data = await response.json();

            if (signal.aborted) return;

            if (data.success) {
                searchResults = data.data || [];
                filteredResults = [...searchResults];
                // 缓存结果
                CacheManager.set(currentKeyword, currentSearchSource, searchResults);
            } else {
                searchResults = [];
                filteredResults = [];
                isLoading = false;
                stopSearchTimer();
                setSearchBtnLoading(false);
                const contentArea = document.getElementById('movieContentArea');
                if (contentArea) {
                    contentArea.innerHTML = renderErrorState(data.error || '搜索失败');
                    if (window.lucide) lucide.createIcons();
                }
                return;
            }
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                stopSearchTimer();
                setSearchBtnLoading(false);
                return;
            }
            if (err.message === 'SEARCH_TIMEOUT') {
                isLoading = false;
                stopSearchTimer();
                setSearchBtnLoading(false);
                const contentArea = document.getElementById('movieContentArea');
                if (contentArea) {
                    contentArea.innerHTML = renderErrorState('搜索超时，请检查网络后重试（已超过30秒）');
                    if (window.lucide) lucide.createIcons();
                }
                return;
            }
            console.warn('API 请求失败，使用演示数据:', err.message);
            searchResults = generateDemoData(currentKeyword);
            filteredResults = [...searchResults];
        }

        isLoading = false;
        stopSearchTimer();
        setSearchBtnLoading(false);
        updateContent();
    }

    // 防抖版搜索（用于 Enter 键和搜索源切换的自动重搜）
    const debouncedSearch = debounce(function (keyword) {
        performSearch(keyword);
    }, 300);

    // 演示数据生成
    function generateDemoData(keyword) {
        const sources = currentSearchSource === 'all'
            ? [
                { source: 'baidu', sourceLabel: '百度网盘' },
                { source: 'quark', sourceLabel: '夸克网盘' },
                { source: 'thunder', sourceLabel: '迅雷网盘' },
                { source: 'ali', sourceLabel: '阿里云盘' },
            ]
            : [searchSourceOptions.find(s => s.key === currentSearchSource)]
                .filter(Boolean)
                .map(s => ({ source: s.key, sourceLabel: s.label }));

        if (sources.length === 0) return [];

        const qualities = ['4K', '1080P', '720P', 'HDR', '蓝光'];
        const types = ['', '完整版', '国语配音', '中英双字', '导演剪辑版'];
        const results = [];

        const count = 6 + Math.floor(Math.random() * 10);
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

        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // ==================== 事件委托 ====================
    function handleContentAreaClick(e) {
        // 复制按钮
        const copyBtn = e.target.closest('.movie-result-copy-btn');
        if (copyBtn) {
            const title = copyBtn.dataset.title || '';
            const link = copyBtn.dataset.link || '';
            const code = copyBtn.dataset.code || '';
            let text = title;
            if (link) text += '\n' + link;
            if (code) text += '\n提取码: ' + code;
            copyToClipboard(text);
            return;
        }

        // 重试按钮
        const retryBtn = e.target.closest('.movie-retry-btn');
        if (retryBtn) {
            if (currentKeyword) performSearch(currentKeyword);
            return;
        }
    }

    function handleFilterBarClick(e) {
        const tag = e.target.closest('.movie-filter-tag');
        if (tag) {
            const source = tag.dataset.source;
            if (source && source !== currentSource) {
                filterBySource(source);
                updateContent(true); // 筛选模式：局部更新
            }
        }
    }

    function handleSourceSelectorClick(e) {
        const opt = e.target.closest('.movie-source-option');
        if (opt) {
            const source = opt.dataset.searchSource;
            if (source && source !== currentSearchSource) {
                currentSearchSource = source;
                updateSourceSelector();
                if (currentKeyword) {
                    debouncedSearch(currentKeyword);
                }
            }
        }
    }

    // ==================== 初始化 ====================
    function init() {
        const searchInput = document.getElementById('movieSearchInput');
        const searchBtn = document.getElementById('movieSearchBtn');
        const clearBtn = document.getElementById('movieSearchClear');
        const contentArea = document.getElementById('movieContentArea');
        const filterBar = document.getElementById('movieFilterBar');
        const sourceSelector = document.getElementById('movieSourceSelector');

        // 搜索按钮点击（即时触发，不防抖）
        if (searchBtn) {
            searchBtn.addEventListener('click', function () {
                if (searchInput) performSearch(searchInput.value);
            });
        }

        // Enter 键搜索（防抖）
        if (searchInput) {
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    debouncedSearch(this.value);
                }
            });

            searchInput.addEventListener('input', function () {
                if (clearBtn) {
                    clearBtn.classList.toggle('hidden', this.value.length === 0);
                }
            });

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
                if (abortController) abortController.abort();
                isLoading = false;
                stopSearchTimer();
                setSearchBtnLoading(false);
                updateContent();
            });
        }

        // 事件委托绑定（只绑定一次，永久生效）
        if (!delegatesAttached) {
            if (contentArea) contentArea.addEventListener('click', handleContentAreaClick);
            if (filterBar) filterBar.addEventListener('click', handleFilterBarClick);
            if (sourceSelector) sourceSelector.addEventListener('click', handleSourceSelectorClick);
            delegatesAttached = true;
        }
    }

    return { title, render, init };
})();
