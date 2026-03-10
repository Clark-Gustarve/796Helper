/* ============================================
   796Helper - Cloudflare Workers 影视资源搜索代理
   v1.3.0 - 性能优化版
   ============================================ */

// CORS 配置
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

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

// 预编译正则常量（模块级，避免每次调用重新创建）
const RE_ANCHOR = /<a[^>]*href=["']javascript:void\(0\);?["'][^>]*>([^<]+)<\/a>/gi;
const RE_TIME = /(\d{4}-\d{1,2}-\d{1,2})/g;
const RE_SKIP_TITLE = /^(复制链接|立即打开|UP云搜|首页|搜索|下一页|上一页)/;
const RE_SOURCE_BADGE = /^【[^】]+】\s*/;
const RE_SKIP_LINE = /^(复制链接|立即打开|UP云搜|首页|搜索|下一页|©|关于|加入|Ai资源帮|Nano|QQ群)/;
const RE_NUM_TITLE = /^\d+[、\.]\s*(.+)/;
const RE_HTML_TAGS = /<[^>]+>/g;
const RE_BODY = /<body[^>]*>([\s\S]*?)<\/body>/i;

// 识别资源来源（降序匹配，命中即返回）
function detectSource(text) {
    for (let i = 0; i < SOURCE_ENTRIES.length; i++) {
        if (text.includes(SOURCE_ENTRIES[i][0])) {
            return SOURCE_ENTRIES[i][1];
        }
    }
    return DEFAULT_SOURCE;
}

// 截取 HTML body 内容，减少 60%+ 扫描范围
function extractBody(html) {
    const m = RE_BODY.exec(html);
    RE_BODY.lastIndex = 0;
    return m ? m[1] : html;
}

// 解析 UP云搜 搜索结果 HTML
function parseUpyunsoResults(html, keyword, panChannel) {
    const results = [];

    // 截取 body 内容减少扫描范围
    const body = extractBody(html);

    // 构建跳转链接（所有结果共用同一个搜索页链接）
    const encodedKeyword = encodeURIComponent(keyword);
    const link = `https://www.upyunso.com/search?keyword=${encodedKeyword}&pan_channel=${panChannel || 'all'}`;

    // 收集所有时间戳
    const times = [];
    RE_TIME.lastIndex = 0;
    let match;
    while ((match = RE_TIME.exec(body)) !== null) {
        times.push(match[1]);
    }

    // 匹配 <a> 标签中的标题文本
    RE_ANCHOR.lastIndex = 0;
    let index = 0;
    while ((match = RE_ANCHOR.exec(body)) !== null) {
        let title = match[1].trim();
        if (title.length < 2 || RE_SKIP_TITLE.test(title)) continue;

        const source = detectSource(title);
        title = title.replace(RE_SOURCE_BADGE, '');
        const time = index < times.length ? times[index] : '';

        results.push({
            title,
            source: source.key,
            sourceLabel: source.label,
            link,
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
            if (line.length <= 3) continue;
            if (RE_SKIP_LINE.test(line)) continue;

            const m = line.match(RE_NUM_TITLE);
            if (m) {
                let title = m[1].trim();
                if (title.length < 2 || seenTitles.has(title)) continue;
                seenTitles.add(title);

                const source = detectSource(title);
                title = title.replace(RE_SOURCE_BADGE, '');

                results.push({
                    title,
                    source: source.key,
                    sourceLabel: source.label,
                    link,
                    code: '',
                    time: ''
                });
            }
        }
    }

    return results;
}

// source 参数映射到 UP云搜的 pan_channel 参数
const SOURCE_TO_PAN_CHANNEL = {
    'all': 'all',
    'baidu': 'baidu',
    'quark': 'kuake',
    'ali': 'ali',
    'thunder': 'xunlei',
    'tianyi': 'tianyi',
};

// 搜索影视资源（竞速策略：P1 优先返回）
async function searchMovieResources(keyword, source) {
    const encodedKeyword = encodeURIComponent(keyword);
    const panChannel = SOURCE_TO_PAN_CHANNEL[source] || 'all';
    const upyunsoUrl = `https://www.upyunso.com/search?keyword=${encodedKeyword}&pan_channel=${panChannel}`;

    const fetchHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.upyunso.com/',
    };

    const FETCH_TIMEOUT = 15000;
    const P1_SUFFICIENT_COUNT = 10;

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

    // 单页请求+解析
    async function fetchAndParse(url) {
        const response = await fetchWithTimeout(url, {
            headers: fetchHeaders,
            cf: { cacheTtl: 300 }
        }, FETCH_TIMEOUT);
        if (response.ok) {
            const html = await response.text();
            return parseUpyunsoResults(html, keyword, panChannel);
        }
        return [];
    }

    // 竞速策略：P1 先发，如果结果足够多则不等 P2
    const p1Promise = fetchAndParse(upyunsoUrl).catch(err => {
        console.error('UP云搜-P1 请求失败:', err.message);
        return [];
    });
    const p2Promise = fetchAndParse(`${upyunsoUrl}&pn=2`).catch(err => {
        console.error('UP云搜-P2 请求失败:', err.message);
        return [];
    });

    // P1 先返回
    const p1Results = await p1Promise;

    let allResults;
    if (p1Results.length >= P1_SUFFICIENT_COUNT) {
        // P1 结果足够，直接使用，不等 P2（P2 继续执行但不阻塞响应）
        allResults = p1Results;
    } else {
        // P1 结果不够，等待 P2 补充
        const p2Results = await p2Promise;
        allResults = [...p1Results, ...p2Results];
    }

    // 后置来源过滤
    if (source && source !== 'all') {
        allResults = allResults.filter(r => r.source === source || r.source === 'other');
    }

    // 去重（基于标题前20字符）
    const seen = new Set();
    allResults = allResults.filter(r => {
        const key = r.title.substring(0, 20);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return allResults.slice(0, 30);
}

// 请求处理入口
async function handleRequest(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/search') {
        const keyword = url.searchParams.get('keyword');
        const source = url.searchParams.get('source') || 'all';

        if (!keyword || keyword.trim().length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: '请输入搜索关键词',
                data: [],
                total: 0
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
            });
        }

        try {
            const WORKER_TIMEOUT = 25000;
            const searchPromise = searchMovieResources(keyword.trim(), source);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('WORKER_TIMEOUT')), WORKER_TIMEOUT)
            );

            const results = await Promise.race([searchPromise, timeoutPromise]);
            return new Response(JSON.stringify({
                success: true,
                data: results,
                total: results.length,
                keyword: keyword.trim()
            }), {
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
            });
        } catch (err) {
            const isTimeout = err.message === 'WORKER_TIMEOUT';
            return new Response(JSON.stringify({
                success: false,
                error: isTimeout ? '搜索超时，上游源响应过慢，请稍后重试' : '搜索服务暂时不可用，请稍后重试',
                data: [],
                total: 0
            }), {
                status: isTimeout ? 504 : 500,
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
            });
        }
    }

    if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok', service: '796Helper Movie Search Proxy' }), {
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
}

// Workers 入口
export default {
    async fetch(request, env, ctx) {
        return handleRequest(request);
    }
};
