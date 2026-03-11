/* ============================================
   796Helper - Cloudflare Workers 影视资源搜索代理
   v2.0.4 - 双搜索源竞速版（PanSearch + UP云搜）
   ============================================ */


// CORS 配置
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// ==================== 通用工具 ====================

// 资源来源类型映射（按关键词长度降序排列，长关键词优先匹配）
const SOURCE_ENTRIES = [
    ['百度网盘', { key: 'baidu', label: '百度网盘', color: '#3498DB' }],
    ['夸克网盘', { key: 'quark', label: '夸克网盘', color: '#9B59B6' }],
    ['迅雷网盘', { key: 'thunder', label: '迅雷网盘', color: '#E67E22' }],
    ['迅雷云盘', { key: 'thunder', label: '迅雷网盘', color: '#E67E22' }],
    ['阿里云盘', { key: 'ali', label: '阿里云盘', color: '#FF6A00' }],
    ['天翼云盘', { key: 'tianyi', label: '天翼云盘', color: '#0078D4' }],
    ['115网盘', { key: '115', label: '115网盘', color: '#00B894' }],
    ['百度云', { key: 'baidu', label: '百度网盘', color: '#3498DB' }],
    ['迅雷', { key: 'thunder', label: '迅雷网盘', color: '#E67E22' }],
    ['夸克', { key: 'quark', label: '夸克网盘', color: '#9B59B6' }],
    ['阿里', { key: 'ali', label: '阿里云盘', color: '#FF6A00' }],
];

const DEFAULT_SOURCE = { key: 'other', label: '其他', color: '#636E82' };

// 通过 URL 域名检测来源类型
const URL_SOURCE_MAP = [
    [/pan\.baidu\.com|yun\.baidu\.com/, { key: 'baidu', label: '百度网盘' }],
    [/drive\.quark\.cn/, { key: 'quark', label: '夸克网盘' }],
    [/www\.alipan\.com|www\.aliyundrive\.com/, { key: 'ali', label: '阿里云盘' }],
    [/pan\.xunlei\.com/, { key: 'thunder', label: '迅雷网盘' }],
    [/cloud\.189\.cn/, { key: 'tianyi', label: '天翼云盘' }],
    [/115\.com/, { key: '115', label: '115网盘' }],
    [/lanzou/, { key: 'other', label: '蓝奏云' }],
];

function detectSourceByUrl(url) {
    for (const [re, src] of URL_SOURCE_MAP) {
        if (re.test(url)) return src;
    }
    return null;
}

function detectSourceByText(text) {
    for (let i = 0; i < SOURCE_ENTRIES.length; i++) {
        if (text.includes(SOURCE_ENTRIES[i][0])) {
            return SOURCE_ENTRIES[i][1];
        }
    }
    return DEFAULT_SOURCE;
}

// 带超时的 fetch 封装
async function fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
}

// source 参数映射
const SOURCE_TO_PAN_CHANNEL = {
    'all': 'all', 'baidu': 'baidu', 'quark': 'kuake',
    'ali': 'ali', 'thunder': 'xunlei', 'tianyi': 'tianyi',
};

const SOURCE_TO_PANSEARCH = {
    'all': '', 'baidu': 'baidu', 'quark': 'quark',
    'ali': 'aliyun', 'thunder': 'xunlei', 'tianyi': '',
};

const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

const WORKER_VERSION = '2.0.4';
const JSON_HEADERS = {
    'Content-Type': 'application/json; charset=UTF-8'
};

function jsonResponse(payload, init = {}) {
    return new Response(JSON.stringify({
        version: WORKER_VERSION,
        ...payload
    }), {
        ...init,
        headers: { ...JSON_HEADERS, ...CORS_HEADERS, ...(init.headers || {}) }
    });
}




// ==================== PanSearch 搜索源 ====================
// PanSearch 搜索结果 HTML 中可能以裸链接、属性值或转义字符串形式包含真实的网盘链接

const RE_DIRECT_PAN_LINK = /https?:\/\/(?:pan\.baidu\.com|yun\.baidu\.com|drive\.quark\.cn|(?:www\.)?alipan\.com|(?:www\.)?aliyundrive\.com|pan\.xunlei\.com|cloud\.189\.cn|115\.com|lanzou[a-z]*\.com)[^\s"'<>)}\]\,]+/i;
const RE_PAN_LINK = /https?:\/\/(?:pan\.baidu\.com|yun\.baidu\.com|drive\.quark\.cn|(?:www\.)?alipan\.com|(?:www\.)?aliyundrive\.com|pan\.xunlei\.com|cloud\.189\.cn|115\.com|lanzou[a-z]*\.com)[^\s"'<>)}\]\,]+/gi;
const RE_ESCAPED_PAN_LINK = /https?:\\\/\\\/(?:pan\.baidu\.com|yun\.baidu\.com|drive\.quark\.cn|(?:www\.)?alipan\.com|(?:www\.)?aliyundrive\.com|pan\.xunlei\.com|cloud\.189\.cn|115\.com|lanzou[a-z]*\.com)[^\s"'<>)}\]\,]+/gi;
const RE_ENCODED_PAN_LINK = /https?%3A%2F%2F(?:pan\.baidu\.com|yun\.baidu\.com|drive\.quark\.cn|(?:www\.)?alipan\.com|(?:www\.)?aliyundrive\.com|pan\.xunlei\.com|cloud\.189\.cn|115\.com|lanzou[a-z]*\.com)[^\s"'<>)}\]\,]+/gi;
const RE_PAN_ATTR = /(?:data-url|data-link|data-href|href|data-clipboard-text)=["']([^"']*(?:pan\.baidu\.com|yun\.baidu\.com|drive\.quark\.cn|alipan\.com|aliyundrive\.com|pan\.xunlei\.com|cloud\.189\.cn|115\.com|lanzou)[^"']*)["']/gi;
const RE_TRAILING_JUNK = /(?:[.,;:!?）)}\]]|&(?:quot|gt|lt|nbsp);)+$/gi;
const RE_PWD = /[?&]pwd=([^&\s"'<>]+)/i;
const RE_TIME_IN_TEXT = /(\d{4}-\d{1,2}-\d{1,2})/;
const RE_CODE_IN_TEXT = /(?:提取码|访问码|密码)[:：\s]*([a-zA-Z0-9]{4,8})/i;
const RE_SKIP_PAN_TITLE = /^(链接|展开|收起|描述|来源|标签|复制|打开|下载|搜索|分享|PanSearch|网盘|资源|立即打开|查看详情|\d+\s*(条|页|个)|共\s*\d+)/;
const RE_UNICODE_ESCAPE = /\\u([0-9a-fA-F]{4})/g;
const RE_HEX_ESCAPE = /\\x([0-9a-fA-F]{2})/g;

function isDirectPanLink(url) {
    return !!(url && RE_DIRECT_PAN_LINK.test(url));
}

function decodeEscapedText(text) {
    return String(text || '')
        .replace(RE_UNICODE_ESCAPE, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(RE_HEX_ESCAPE, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\\//g, '/')
        .replace(/&amp;/g, '&')
        .replace(/&#x2F;/gi, '/')
        .replace(/&#47;/g, '/')
        .replace(/&#x3A;/gi, ':')
        .replace(/&#58;/g, ':');
}

function safeDecodeURIComponent(value) {
    let result = String(value || '');
    for (let i = 0; i < 2; i++) {
        if (!/%[0-9a-fA-F]{2}/.test(result)) break;
        try {
            const decoded = decodeURIComponent(result);
            if (decoded === result) break;
            result = decoded;
        } catch (err) {
            break;
        }
    }
    return result;
}

function normalizePanUrl(rawUrl) {
    if (!rawUrl) return '';

    let normalized = safeDecodeURIComponent(decodeEscapedText(String(rawUrl).trim()))
        .replace(/^[\s"'`(\[]+/, '')
        .replace(/[\s"'`)\]]+$/, '')
        .trim();

    const directMatch = normalized.match(RE_DIRECT_PAN_LINK);
    if (!directMatch) return '';

    normalized = safeDecodeURIComponent(decodeEscapedText(directMatch[0])).replace(RE_TRAILING_JUNK, '');

    if (!/^https?:\/\//i.test(normalized)) {
        normalized = 'https://' + normalized.replace(/^\/+/, '');
    }

    return normalized;
}

function getPanLinkDedupeKey(url) {
    return url.split('?')[0].toLowerCase();
}

function extractPanUrls(html) {
    const candidates = [];
    const pushMatches = (regex, source, groupIndex) => {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(source)) !== null) {
            candidates.push(groupIndex != null ? match[groupIndex] : match[0]);
        }
    };

    pushMatches(RE_PAN_LINK, html);
    pushMatches(RE_ESCAPED_PAN_LINK, html);
    pushMatches(RE_ENCODED_PAN_LINK, html);
    pushMatches(RE_PAN_ATTR, html, 1);

    const urls = [];
    const urlIndexMap = new Map();

    for (const candidate of candidates) {
        const normalized = normalizePanUrl(candidate);
        if (!normalized) continue;

        const dedupeKey = getPanLinkDedupeKey(normalized);
        const existingIndex = urlIndexMap.get(dedupeKey);

        if (existingIndex == null) {
            urlIndexMap.set(dedupeKey, urls.length);
            urls.push(normalized);
            continue;
        }

        const currentHasPwd = RE_PWD.test(normalized);
        const existingHasPwd = RE_PWD.test(urls[existingIndex]);
        if (currentHasPwd && !existingHasPwd) {
            urls[existingIndex] = normalized;
        }
    }

    return urls;
}

function extractPanContext(cleanHtml, link) {
    const searchTokens = [
        link,
        decodeEscapedText(link),
        safeDecodeURIComponent(link),
        link.split('?')[0]
    ].filter(Boolean);

    for (const token of searchTokens) {
        const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = new RegExp('([\\s\\S]{0,1600})' + escapedToken + '([\\s\\S]{0,500})', 'i').exec(cleanHtml);
        if (match) {
            return (match[1] || '') + '\n' + (match[2] || '');
        }
    }

    return '';
}

function extractPanTitle(context, keyword) {
    if (!context) return keyword;

    const lines = context
        .replace(/<[^>]+>/g, '\n')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 2 && line.length < 220);

    let fallback = keyword;
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (/https?:\/\//i.test(line) || RE_SKIP_PAN_TITLE.test(line)) continue;
        if (line.includes(keyword)) return line.replace(/^\s*[\d.、]+\s*/, '').trim();
        if (fallback === keyword && /[\u4e00-\u9fa5A-Za-z0-9]/.test(line)) {
            fallback = line;
        }
    }

    return fallback.replace(/^\s*[\d.、]+\s*/, '').trim() || keyword;
}

function parsePanSearchResults(html, keyword) {
    const results = [];
    const cleanHtml = extractBody(html)
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '');

    const allLinks = extractPanUrls(cleanHtml);
    if (allLinks.length === 0) return results;

    for (const link of allLinks) {
        const context = extractPanContext(cleanHtml, link);
        const title = extractPanTitle(context, keyword);
        const timeMatch = context.match(RE_TIME_IN_TEXT);
        const pwdMatch = link.match(RE_PWD);
        const codeMatch = pwdMatch || context.match(RE_CODE_IN_TEXT);
        const source = detectSourceByUrl(link) || detectSourceByText(title);

        results.push({
            title,
            source: source.key,
            sourceLabel: source.label,
            link,
            code: codeMatch ? codeMatch[1] : '',
            time: timeMatch ? timeMatch[1] : ''
        });
    }

    return results;
}


// PanSearch 搜索请求
async function searchPanSearch(keyword, source) {
    const encodedKeyword = encodeURIComponent(keyword);
    const panType = SOURCE_TO_PANSEARCH[source] || '';
    const panParam = panType ? `&pan=${panType}` : '';
    const url = `https://www.pansearch.me/search?keyword=${encodedKeyword}${panParam}`;

    const response = await fetchWithTimeout(url, {
        headers: { ...FETCH_HEADERS, 'Referer': 'https://www.pansearch.me/' },
        cf: { cacheTtl: 300 }
    }, 12000);

    if (!response.ok) return [];

    const html = await response.text();
    return parsePanSearchResults(html, keyword);
}

// ==================== UP云搜 搜索源（兜底） ====================

const RE_ANCHOR = /<a[^>]*href=["']javascript:void\(0\);?["'][^>]*>([^<]+)<\/a>/gi;
const RE_TIME = /(\d{4}-\d{1,2}-\d{1,2})/g;
const RE_SKIP_TITLE = /^(复制链接|立即打开|UP云搜|首页|搜索|下一页|上一页)/;
const RE_SOURCE_BADGE = /^【[^】]+】\s*/;
const RE_SKIP_LINE = /^(复制链接|立即打开|UP云搜|首页|搜索|下一页|©|关于|加入|Ai资源帮|Nano|QQ群)/;
const RE_NUM_TITLE = /^\d+[、\.]\s*(.+)/;
const RE_HTML_TAGS = /<[^>]+>/g;
const RE_BODY = /<body[^>]*>([\s\S]*?)<\/body>/i;

function extractBody(html) {
    const m = RE_BODY.exec(html);
    RE_BODY.lastIndex = 0;
    return m ? m[1] : html;
}

function parseUpyunsoResults(html, keyword, panChannel) {
    const results = [];
    const body = extractBody(html);
    const encodedKeyword = encodeURIComponent(keyword);
    const searchPageLink = `https://www.upyunso.com/search?keyword=${encodedKeyword}&pan_channel=${panChannel || 'all'}`;

    const times = [];
    RE_TIME.lastIndex = 0;
    let match;
    while ((match = RE_TIME.exec(body)) !== null) {
        times.push(match[1]);
    }

    RE_ANCHOR.lastIndex = 0;
    let index = 0;
    while ((match = RE_ANCHOR.exec(body)) !== null) {
        let title = match[1].trim();
        if (title.length < 2 || RE_SKIP_TITLE.test(title)) continue;

        const source = detectSourceByText(title);
        title = title.replace(RE_SOURCE_BADGE, '');
        const time = index < times.length ? times[index] : '';

        results.push({
            title,
            source: source.key,
            sourceLabel: source.label,
            link: searchPageLink,
            code: '',
            time
        });
        index++;
    }

    // 备用模式：纯文本匹配
    if (results.length === 0) {
        const lines = body.replace(RE_HTML_TAGS, '\n').split('\n');
        const seenTitles = new Set();
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length <= 3 || RE_SKIP_LINE.test(line)) continue;
            const m = line.match(RE_NUM_TITLE);
            if (m) {
                let title = m[1].trim();
                if (title.length < 2 || seenTitles.has(title)) continue;
                seenTitles.add(title);
                const source = detectSourceByText(title);
                title = title.replace(RE_SOURCE_BADGE, '');
                results.push({
                    title, source: source.key, sourceLabel: source.label,
                    link: searchPageLink, code: '', time: ''
                });
            }
        }
    }

    return results;
}

async function searchUpyunso(keyword, source) {
    const encodedKeyword = encodeURIComponent(keyword);
    const panChannel = SOURCE_TO_PAN_CHANNEL[source] || 'all';
    const url = `https://www.upyunso.com/search?keyword=${encodedKeyword}&pan_channel=${panChannel}`;

    const response = await fetchWithTimeout(url, {
        headers: { ...FETCH_HEADERS, 'Referer': 'https://www.upyunso.com/' },
        cf: { cacheTtl: 300 }
    }, 12000);

    if (!response.ok) return [];

    const html = await response.text();
    return parseUpyunsoResults(html, keyword, panChannel);
}

// ==================== 双搜索源竞速策略 ====================

const MIN_DIRECT_LINK_COUNT = 3; // PanSearch 至少返回 3 条真实链接才算有效

async function searchMovieResources(keyword, source) {
    // 同时发起 PanSearch 和 UP云搜 请求
    const panSearchPromise = searchPanSearch(keyword, source).catch(err => {
        console.error('PanSearch 请求失败:', err.message);
        return [];
    });

    const upyunsoPromise = searchUpyunso(keyword, source).catch(err => {
        console.error('UP云搜 请求失败:', err.message);
        return [];
    });

    // 真正的竞速策略：谁先返回充足结果就先用谁
    // 包装成带标识的 Promise
    const taggedPanSearch = panSearchPromise.then(r => ({ source: 'pansearch', results: r }));
    const taggedUpyunso = upyunsoPromise.then(r => ({ source: 'upyunso', results: r }));

    let allResults;

    // 等待第一个完成的源
    const first = await Promise.race([taggedPanSearch, taggedUpyunso]);

    if (first.source === 'pansearch' && first.results.length >= MIN_DIRECT_LINK_COUNT) {
        // PanSearch 先返回且结果充足 → 直接使用
        allResults = first.results;
    } else if (first.source === 'upyunso' && first.results.length >= 10) {
        // UP云搜先返回且结果充足 → 等 PanSearch，合并后 PanSearch 排前
        const second = await (first.source === 'pansearch' ? taggedUpyunso : taggedPanSearch);
        allResults = [...second.results, ...first.results];
    } else {
        // 首个结果不够 → 等待另一个源补充
        const second = await (first.source === 'pansearch' ? taggedUpyunso : taggedPanSearch);
        // PanSearch 结果始终排在前面
        const panResults = first.source === 'pansearch' ? first.results : second.results;
        const upResults = first.source === 'upyunso' ? first.results : second.results;
        allResults = [...panResults, ...upResults];
    }

    // 后置来源过滤
    if (source && source !== 'all') {
        allResults = allResults.filter(r => r.source === source || r.source === 'other');
    }

    // 去重（基于链接 URL 或标题前20字符）
    const seenLinks = new Set();
    const seenTitles = new Set();
    allResults = allResults.filter(r => {
        // 链接去重（跳过搜索页链接）
        if (r.link && !r.link.includes('upyunso.com/search')) {
            const baseLink = r.link.split('?')[0];
            if (seenLinks.has(baseLink)) return false;
            seenLinks.add(baseLink);
        }
        // 标题去重
        const titleKey = r.title.substring(0, 20);
        if (seenTitles.has(titleKey)) return false;
        seenTitles.add(titleKey);
        return true;
    });

    return allResults.slice(0, 30);
}

// ==================== 请求处理入口 ====================

async function handleRequest(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/search') {
        const keyword = url.searchParams.get('keyword');
        const source = url.searchParams.get('source') || 'all';

        if (!keyword || keyword.trim().length === 0) {
            return jsonResponse({
                success: false,
                code: 'INVALID_KEYWORD',
                error: '请输入搜索关键词',
                data: [],
                total: 0,
                source
            }, {
                status: 400
            });
        }

        try {
            const WORKER_TIMEOUT = 25000;
            const searchPromise = searchMovieResources(keyword.trim(), source);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('WORKER_TIMEOUT')), WORKER_TIMEOUT)
            );

            const results = await Promise.race([searchPromise, timeoutPromise]);
            return jsonResponse({
                success: true,
                data: results,
                total: results.length,
                keyword: keyword.trim(),
                source
            });
        } catch (err) {
            const isTimeout = err.message === 'WORKER_TIMEOUT';
            return jsonResponse({
                success: false,
                code: isTimeout ? 'SEARCH_TIMEOUT' : 'SEARCH_UNAVAILABLE',
                error: isTimeout ? '搜索超时，上游源响应过慢，请稍后重试' : '搜索服务暂时不可用，请稍后重试',
                data: [],
                total: 0,
                keyword: keyword ? keyword.trim() : '',
                source
            }, {
                status: isTimeout ? 504 : 500
            });
        }
    }


    if (url.pathname === '/health') {
        return jsonResponse({
            status: 'ok',
            service: '796Helper Movie Search Proxy',
            routes: ['/api/search', '/health'],
            sources: ['pansearch', 'upyunso']
        });
    }

    return jsonResponse({
        success: false,
        code: 'NOT_FOUND',
        error: 'Not Found'
    }, {
        status: 404
    });
}


// Workers 入口
export default {
    async fetch(request, env, ctx) {
        return handleRequest(request);
    }
};
