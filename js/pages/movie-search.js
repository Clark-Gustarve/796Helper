/* ============================================
   796Helper - Movie Search Page Module
   影视资源搜索页面（v2.0.8 默认站外搜索版）

   ============================================ */

const MovieSearchPage = (function () {
    const title = '影视搜索';

    const DEFAULT_API_BASES = [];
    const SEARCH_TIMEOUT = 30000;
    const PROXY_STORAGE_KEY = '796helper-movie-search-api-bases';

    function normalizeApiBase(value) {

        return String(value || '').trim().replace(/\/+$/, '');
    }

    function pushUniqueApiBase(list, value) {
        const normalized = normalizeApiBase(value);
        if (!normalized || list.includes(normalized)) return;
        list.push(normalized);
    }

    function readSavedApiBases() {
        try {
            const raw = localStorage.getItem(PROXY_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed)
                ? parsed.map(normalizeApiBase).filter(Boolean)
                : [];
        } catch (err) {
            return [];
        }
    }

    function writeSavedApiBases(apiBases) {
        try {
            const normalized = Array.isArray(apiBases)
                ? apiBases.map(normalizeApiBase).filter(Boolean)
                : [];
            if (normalized.length === 0) {
                localStorage.removeItem(PROXY_STORAGE_KEY);
                return;
            }
            localStorage.setItem(PROXY_STORAGE_KEY, JSON.stringify(normalized));
        } catch (err) {
            // 忽略存储异常，仍允许继续使用当前配置
        }
    }

    function parseApiBasesInput(value) {
        return String(value || '')
            .split(/[\n,，;；]+/)
            .map(normalizeApiBase)
            .filter(Boolean)
            .filter((item, index, list) => list.indexOf(item) === index);
    }

    function formatApiBasesText(apiBases) {
        return Array.isArray(apiBases) ? apiBases.join('\n') : '';
    }

    function getApiConfig() {

        const globalConfig = window.__796HELPER_CONFIG__ || {};
        const movieSearchConfig = globalConfig.movieSearch || {};
        const savedApiBases = readSavedApiBases();
        const configuredApiBases = []
            .concat(savedApiBases)

            .concat(window.__MOVIE_SEARCH_API_BASES__ || [])
            .concat(window.__MOVIE_SEARCH_API_BASE__ || [])
            .concat(globalConfig.movieSearchApiBases || [])
            .concat(globalConfig.movieSearchApiBase || [])
            .concat(movieSearchConfig.apiBases || [])
            .concat(movieSearchConfig.apiBase || []);
        const apiBases = [];

        configuredApiBases.forEach(base => {
            if (Array.isArray(base)) {
                base.forEach(item => pushUniqueApiBase(apiBases, item));
                return;
            }
            pushUniqueApiBase(apiBases, base);
        });
        DEFAULT_API_BASES.forEach(base => pushUniqueApiBase(apiBases, base));

        return {
            apiBases,
            savedApiBases,
            usingCustomApiBases: savedApiBases.length > 0,
            defaultApiBases: [...DEFAULT_API_BASES],
            enableExternalFallback: movieSearchConfig.enableExternalFallback !== false &&
                globalConfig.enableMovieSearchExternalFallback !== false
        };

    }

    // ==================== 缓存管理器 ====================
    const CACHE_SCHEMA_VERSION = '2.0.8';

    const CACHE_PREFIX_BASE = '796h-mc-';
    const CACHE_PREFIX = `${CACHE_PREFIX_BASE}${CACHE_SCHEMA_VERSION}-`;
    const CACHE_VERSION_KEY = `${CACHE_PREFIX_BASE}schema-version`;
    const CACHE_TTL = 5 * 60 * 1000; // 5分钟
    const CACHE_MAX = 20;

    function buildTextSignature(text) {
        const source = String(text || 'default');
        let hash = 0;
        for (let i = 0; i < source.length; i++) {
            hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
        }
        return Math.abs(hash).toString(36);
    }

    function getApiCacheSignature() {
        const { apiBases } = getApiConfig();
        return buildTextSignature(apiBases.join('|'));
    }

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
        _storageReady: false,

        _ensureStorageReady() {
            if (!this._useStorage || this._storageReady) return;
            try {
                const currentVersion = sessionStorage.getItem(CACHE_VERSION_KEY);
                if (currentVersion !== CACHE_SCHEMA_VERSION) {
                    const keysToRemove = [];
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        if (key && key.startsWith(CACHE_PREFIX_BASE)) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach(key => sessionStorage.removeItem(key));
                    sessionStorage.setItem(CACHE_VERSION_KEY, CACHE_SCHEMA_VERSION);
                }
            } catch (e) {
                // 忽略存储异常，继续使用当前存储状态
            }
            this._storageReady = true;
        },

        _getKey(keyword, source) {
            return CACHE_PREFIX + keyword + '__' + source + '__' + getApiCacheSignature();
        },


        get(keyword, source) {
            const key = this._getKey(keyword, source);
            if (this._useStorage) {
                this._ensureStorageReady();
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
                this._ensureStorageReady();
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

    const sourceSearchParams = {
        all: { pansearch: '' },
        baidu: { pansearch: 'baidu' },
        quark: { pansearch: 'quark' },
        ali: { pansearch: 'aliyun' },
        thunder: { pansearch: 'xunlei' },
        tianyi: { pansearch: '' }
    };


    function getSourceStyle(source) {

        return sourceColors[source] || sourceColors.other;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // 判断是否为直接的网盘链接（而非搜索引擎页面）
    function isDirectPanLink(url) {
        if (!url) return false;
        return /(?:pan\.baidu\.com|yun\.baidu\.com|drive\.quark\.cn|www\.alipan\.com|www\.aliyundrive\.com|pan\.xunlei\.com|cloud\.189\.cn|115\.com|lanzou)/i.test(url);
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
                    ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="movie-result-link-btn" title="${isDirectPanLink(item.link) ? '打开网盘链接' : '前往搜索引擎查看资源'}">
                        <i data-lucide="${isDirectPanLink(item.link) ? 'external-link' : 'search'}"></i>
                    </a>` : ''}
                    <button class="movie-result-copy-btn" data-title="${escapeHtml(item.title)}" data-link="${escapeHtml(item.link)}" data-code="${escapeHtml(item.code)}" title="${isDirectPanLink(item.link) ? '复制网盘链接' : '复制资源信息'}">
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

    function renderProxySettings() {
        const { apiBases, savedApiBases, usingCustomApiBases } = getApiConfig();
        const usingConfiguredApiBases = !usingCustomApiBases && apiBases.length > 0;
        const summaryText = usingCustomApiBases
            ? '已启用自定义增强搜索'
            : (usingConfiguredApiBases ? '当前使用预设增强搜索' : '当前使用站外搜索模式');
        const description = usingCustomApiBases
            ? '当前会优先按顺序尝试你保存的增强搜索服务地址；如首个地址失败，会自动切换到后续地址。'
            : (usingConfiguredApiBases
                ? '当前会优先按顺序尝试预设的增强搜索服务地址；如首个地址失败，会自动切换到后续地址。'
                : '默认会直接给出 PanSearch 搜索结果页入口；如需返回更完整的直链结果，可在这里填入兼容 /api/search 的增强搜索服务地址。');
        const currentChain = apiBases.length > 0
            ? apiBases.map(base => `<code>${escapeHtml(base)}</code>`).join('<span class="movie-proxy-chain-sep">→</span>')
            : '<code>未配置增强服务，将直接使用 PanSearch 搜索页</code>';

        return `
            <details class="movie-proxy-card" ${usingCustomApiBases ? 'open' : ''}>
                <summary class="movie-proxy-summary">
                    <span class="movie-proxy-summary-main">
                        <i data-lucide="shield-check" style="width:16px;height:16px;"></i>
                        <span>增强搜索设置</span>
                    </span>
                    <span class="movie-proxy-summary-meta">${summaryText}</span>
                </summary>
                <div class="movie-proxy-panel">
                    <p class="movie-proxy-desc">${description}</p>
                    <div class="movie-proxy-current">
                        <span class="movie-proxy-current-label">当前顺序</span>
                        <div class="movie-proxy-chain">${currentChain}</div>
                    </div>
                    <textarea class="movie-proxy-input" id="movieProxyInput" placeholder="https://your-search-service.example.com">${escapeHtml(formatApiBasesText(savedApiBases))}</textarea>
                    <div class="movie-proxy-actions">
                        <button class="btn btn-primary movie-proxy-save-btn" id="movieProxySaveBtn" type="button">
                            <i data-lucide="save" style="width:16px;height:16px;"></i>
                            <span>保存地址</span>
                        </button>
                        <button class="btn btn-ghost movie-proxy-reset-btn" id="movieProxyResetBtn" type="button">
                            <i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i>
                            <span>清空配置</span>
                        </button>
                    </div>
                    <p class="movie-proxy-hint">每行一个地址；未配置时会直接进入 <code>PanSearch</code> 搜索页，有配置时才尝试增强直链搜索。</p>

                </div>
            </details>
        `;
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
                <p class="movie-state-desc">默认会为你打开 <code>PanSearch</code> 搜索结果页；如已配置增强搜索服务，将优先尝试返回真实网盘直链。</p>
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

    let lastResultMode = 'normal';
    let lastSearchNotice = '';

    function setSearchNotice(mode, message) {

        lastResultMode = mode || 'normal';
        lastSearchNotice = message || '';
    }

    function clearSearchNotice() {
        lastResultMode = 'normal';
        lastSearchNotice = '';
    }

    function renderSearchNotice() {
        if (!lastSearchNotice) return '';
        const icon = lastResultMode === 'fallback'
            ? 'shield-alert'
            : (lastResultMode === 'external' ? 'compass' : 'info');
        const borderColor = lastResultMode === 'fallback'
            ? 'rgba(241, 196, 15, 0.28)'
            : (lastResultMode === 'external' ? 'rgba(0, 206, 201, 0.24)' : 'rgba(108, 92, 231, 0.28)');
        const background = lastResultMode === 'fallback'
            ? 'rgba(241, 196, 15, 0.08)'
            : (lastResultMode === 'external' ? 'rgba(0, 206, 201, 0.08)' : 'rgba(108, 92, 231, 0.08)');
        const iconColor = lastResultMode === 'fallback'
            ? '#F1C40F'
            : (lastResultMode === 'external' ? 'var(--accent)' : 'var(--primary)');

        return `
            <div class="movie-results-notice" style="display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;padding:12px 14px;border-radius:14px;border:1px solid ${borderColor};background:${background};color:var(--text-secondary);">
                <i data-lucide="${icon}" style="width:16px;height:16px;color:${iconColor};flex-shrink:0;margin-top:1px;"></i>
                <span>${escapeHtml(lastSearchNotice)}</span>
            </div>
        `;
    }

    function getResultsHeaderText() {
        return (lastResultMode === 'fallback' || lastResultMode === 'external')
            ? '已准备 <strong>' + filteredResults.length + '</strong> 个可继续打开的搜索入口'
            : '找到 <strong>' + filteredResults.length + '</strong> 个资源';
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
            ${renderSearchNotice()}
            <div class="movie-results-header">
                <span>${getResultsHeaderText()}</span>
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

                    <div class="movie-proxy-settings" id="movieProxySettings">
                        ${renderProxySettings()}
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
                    resultsHeader.innerHTML = `<span>${getResultsHeaderText()}</span>`;
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

    function updateProxySettings() {
        const settings = document.getElementById('movieProxySettings');
        if (settings) {
            settings.innerHTML = renderProxySettings();
            if (window.lucide) lucide.createIcons();
        }
    }

    // ==================== 核心搜索流程 ====================

    function buildSearchUrl(apiBase, keyword, source) {
        const sourceParam = source !== 'all' ? `&source=${encodeURIComponent(source)}` : '';
        return `${apiBase}/api/search?keyword=${encodeURIComponent(keyword)}${sourceParam}`;
    }

    function safeParseJson(text) {
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    function normalizeRequestError(err) {
        if (!err) return '搜索服务请求失败';
        if (err.message === 'SEARCH_TIMEOUT') return '搜索超时，请检查网络后重试（已超过30秒）';
        if (err.name === 'AbortError') return '请求已取消';
        if (err.message && /failed to fetch|networkerror|load failed|fetch failed/i.test(err.message)) {
            return '搜索服务当前不可达，请检查增强搜索地址或网络环境';
        }
        return err.message || '搜索服务请求失败';
    }

    async function requestSearchFromApis(keyword, source, signal) {
        const { apiBases, enableExternalFallback } = getApiConfig();
        const attemptErrors = [];

        for (let i = 0; i < apiBases.length; i++) {
            const apiBase = apiBases[i];
            try {
                const response = await fetch(buildSearchUrl(apiBase, keyword, source), {
                    signal,
                    headers: { 'Accept': 'application/json' },
                    cache: 'no-store'
                });
                const responseText = await response.text();
                const data = safeParseJson(responseText);

                if (!response.ok) {
                    const errorMsg = data && data.error
                        ? data.error
                        : `搜索服务响应异常（HTTP ${response.status}）`;
                    attemptErrors.push(errorMsg);
                    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                        return { success: false, error: errorMsg, attemptErrors, enableExternalFallback: false };
                    }
                    continue;
                }

                if (data && data.success === true) {
                    return {
                        success: true,
                        data: Array.isArray(data.data) ? data.data : [],
                        apiBase,
                        attemptErrors,
                        notice: i > 0 ? '首个增强搜索地址不可达，已自动切换到后续地址。' : ''
                    };
                }

                const errorMsg = data && data.error
                    ? data.error
                    : '搜索服务暂时不可用，请稍后重试';
                attemptErrors.push(errorMsg);

                if (data && data.code === 'INVALID_KEYWORD') {
                    return { success: false, error: errorMsg, attemptErrors, enableExternalFallback: false };
                }
            } catch (err) {
                if (err.name === 'AbortError') throw err;
                attemptErrors.push(normalizeRequestError(err));
            }
        }

        return {
            success: false,
            error: attemptErrors[attemptErrors.length - 1] || '搜索服务当前不可达，请稍后重试',
            attemptErrors,
            enableExternalFallback
        };
    }

    function generateFallbackResults(keyword, source) {
        const sourceConfig = sourceSearchParams[source] || sourceSearchParams.all;
        const sourceOption = searchSourceOptions.find(item => item.key === source);
        const fallbackSource = source === 'all' ? 'other' : source;
        const fallbackLabel = fallbackSource === 'other' ? '搜索页' : (sourceOption ? sourceOption.label : '搜索页');
        const encodedKeyword = encodeURIComponent(keyword);
        const panParam = sourceConfig.pansearch ? `&pan=${sourceConfig.pansearch}` : '';

        return [
            {
                title: `${keyword} - 打开 PanSearch 搜索结果页`,
                source: fallbackSource,
                sourceLabel: fallbackLabel,
                link: `https://www.pansearch.me/search?keyword=${encodedKeyword}${panParam}`,
                code: '',
                time: '站外搜索'
            },

        ];
    }

    async function performSearch(keyword) {
        if (!keyword || keyword.trim().length === 0) return;
        if (isLoading) return; // 防止重复搜索

        currentKeyword = keyword.trim();
        clearSearchNotice();

        if (abortController) {
            abortController.abort();
        }

        const { apiBases } = getApiConfig();
        const cachedData = CacheManager.get(currentKeyword, currentSearchSource);
        if (cachedData) {
            searchResults = cachedData;
            filteredResults = [...searchResults];
            currentSource = 'all';
            isLoading = false;
            updateContent();
            return;
        }

        if (apiBases.length === 0) {
            searchResults = generateFallbackResults(currentKeyword, currentSearchSource);
            filteredResults = [...searchResults];
            currentSource = 'all';
            isLoading = false;
            setSearchNotice('external', '当前未配置增强搜索服务，已直接为你准备 PanSearch 搜索页入口。');
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

        const input = document.getElementById('movieSearchInput');
        if (input) input.value = currentKeyword;
        const clearBtn = document.getElementById('movieSearchClear');
        if (clearBtn) clearBtn.classList.remove('hidden');

        abortController = new AbortController();
        const signal = abortController.signal;
        let timeoutId = null;

        try {
            const requestPromise = requestSearchFromApis(currentKeyword, currentSearchSource, signal);
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    if (abortController) abortController.abort();
                    reject(new Error('SEARCH_TIMEOUT'));
                }, SEARCH_TIMEOUT);
            });

            const outcome = await Promise.race([requestPromise, timeoutPromise]);
            clearTimeout(timeoutId);
            timeoutId = null;

            if (signal.aborted) return;

            if (outcome.success) {
                searchResults = outcome.data;
                filteredResults = [...searchResults];
                CacheManager.set(currentKeyword, currentSearchSource, searchResults);
                if (outcome.notice) {
                    setSearchNotice('notice', outcome.notice);
                }
            } else if (outcome.enableExternalFallback !== false) {
                searchResults = generateFallbackResults(currentKeyword, currentSearchSource);
                filteredResults = [...searchResults];
                setSearchNotice('fallback', `${outcome.error || '增强搜索服务暂时不可用'}，已切换为 PanSearch 搜索页，可继续尝试获取真实网盘链接。`);

            } else {
                searchResults = [];
                filteredResults = [];
                isLoading = false;
                stopSearchTimer();
                setSearchBtnLoading(false);
                const contentArea = document.getElementById('movieContentArea');
                if (contentArea) {
                    contentArea.innerHTML = renderErrorState(outcome.error || '搜索失败');
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
            searchResults = generateFallbackResults(currentKeyword, currentSearchSource);
            filteredResults = [...searchResults];
            setSearchNotice('fallback', `${normalizeRequestError(err)}，已切换为 PanSearch 搜索页，可继续尝试获取真实网盘链接。`);

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
            let text = '';
            if (isDirectPanLink(link)) {
                // 网盘直链：直接复制链接（+ 提取码）
                text = link;
                if (code) text += '\n提取码: ' + code;
            } else {
                // 搜索页链接：复制标题 + 链接
                text = title;
                if (link) text += '\n' + link;
                if (code) text += '\n提取码: ' + code;
            }
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

    function handleProxySettingsClick(e) {
        const saveBtn = e.target.closest('.movie-proxy-save-btn');
        if (saveBtn) {
            const input = document.getElementById('movieProxyInput');
            const apiBases = parseApiBasesInput(input ? input.value : '');
            writeSavedApiBases(apiBases);
            updateProxySettings();
            showToast(apiBases.length > 0 ? `已保存 ${apiBases.length} 个增强搜索地址` : '已清空增强搜索配置');
            if (currentKeyword && !isLoading) {
                performSearch(currentKeyword);
            }
            return;
        }

        const resetBtn = e.target.closest('.movie-proxy-reset-btn');
        if (resetBtn) {
            writeSavedApiBases([]);
            updateProxySettings();
            showToast('已清空增强搜索配置');
            if (currentKeyword && !isLoading) {
                performSearch(currentKeyword);
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
        const proxySettings = document.getElementById('movieProxySettings');


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

        // 事件委托绑定（每次 init 重新绑定，因为路由切换会重建 DOM）
        if (contentArea) contentArea.addEventListener('click', handleContentAreaClick);
        if (filterBar) filterBar.addEventListener('click', handleFilterBarClick);
        if (sourceSelector) sourceSelector.addEventListener('click', handleSourceSelectorClick);
        if (proxySettings) proxySettings.addEventListener('click', handleProxySettingsClick);
    }


    return { title, render, init };
})();
