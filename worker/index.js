/* ============================================
   796Helper - Cloudflare Workers 影视资源搜索代理
   ============================================ */

// CORS 配置
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// 资源来源类型映射
const SOURCE_MAP = {
    '百度网盘': { key: 'baidu', label: '百度网盘', color: '#3498DB' },
    '百度云': { key: 'baidu', label: '百度网盘', color: '#3498DB' },
    '夸克网盘': { key: 'quark', label: '夸克网盘', color: '#9B59B6' },
    '夸克': { key: 'quark', label: '夸克网盘', color: '#9B59B6' },
    '迅雷网盘': { key: 'thunder', label: '迅雷网盘', color: '#E67E22' },
    '迅雷云盘': { key: 'thunder', label: '迅雷网盘', color: '#E67E22' },
    '迅雷': { key: 'thunder', label: '迅雷网盘', color: '#E67E22' },
    '阿里云盘': { key: 'ali', label: '阿里云盘', color: '#FF6A00' },
    '阿里': { key: 'ali', label: '阿里云盘', color: '#FF6A00' },
    '115网盘': { key: '115', label: '115网盘', color: '#00B894' },
    '天翼云盘': { key: 'tianyi', label: '天翼云盘', color: '#0078D4' },
};

// 识别资源来源
function detectSource(text) {
    for (const [keyword, info] of Object.entries(SOURCE_MAP)) {
        if (text.includes(keyword)) {
            return info;
        }
    }
    return { key: 'other', label: '其他', color: '#636E82' };
}

// 解析 UP云搜 搜索结果 HTML
function parseUpyunsoResults(html, keyword, panChannel) {
    const results = [];

    // UP云搜结构：每个结果项包含标题文本（可能含来源标识如【夸克】）和更新时间
    // 链接为 javascript:void(0)，无法直接获取真实网盘链接
    // 策略：提取标题和时间，生成搜索引擎跳转链接

    // 匹配标题：数字序号 + 标题文本模式（如 "1、哈利波特"）
    // 或匹配 <a> 标签中的标题
    const titleTimePattern = /(?:(\d+)[、\.]\s*)([^<\n]+?)(?:\s*(?:复制链接|立即打开))/g;
    const timePattern = /(\d{4}-\d{1,2}-\d{1,2})/g;
    let match;

    // 收集所有时间戳
    const times = [];
    while ((match = timePattern.exec(html)) !== null) {
        times.push(match[1]);
    }

    // 重置 titleTimePattern
    // 更健壮的方式：匹配每个 <a> 标签中的标题文本
    const anchorPattern = /<a[^>]*href=["']javascript:void\(0\);?["'][^>]*>([^<]+)<\/a>/gi;
    let index = 0;
    while ((match = anchorPattern.exec(html)) !== null) {
        let title = match[1].trim();
        if (title.length < 2 || /^(复制链接|立即打开|UP云搜|首页|搜索|下一页|上一页)/.test(title)) continue;

        // 从标题中检测来源
        const source = detectSource(title);

        // 清理标题中的来源标识
        title = title.replace(/^【[^】]+】\s*/, '');

        const time = index < times.length ? times[index] : '';

        // 构建跳转链接 —— 指向 UP云搜搜索结果页，用户可在该页面操作
        const encodedKeyword = encodeURIComponent(keyword);
        const link = `https://www.upyunso.com/search?keyword=${encodedKeyword}&pan_channel=${panChannel || 'all'}`;

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

    // 备用模式：如果上面没匹配到，尝试匹配纯文本中的标题
    if (results.length === 0) {
        const lines = html.replace(/<[^>]+>/g, '\n').split('\n').map(l => l.trim()).filter(l => l.length > 3);
        const seenTitles = new Set();
        for (const line of lines) {
            // 跳过无关行
            if (/^(复制链接|立即打开|UP云搜|首页|搜索|下一页|©|关于|加入|Ai资源帮|Nano|QQ群)/.test(line)) continue;
            // 匹配 "数字、标题" 格式
            const m = line.match(/^\d+[、\.]\s*(.+)/);
            if (m) {
                let title = m[1].trim();
                if (title.length < 2 || seenTitles.has(title)) continue;
                seenTitles.add(title);

                const source = detectSource(title);
                title = title.replace(/^【[^】]+】\s*/, '');

                const encodedKeyword = encodeURIComponent(keyword);
                const link = `https://www.upyunso.com/search?keyword=${encodedKeyword}&pan_channel=${panChannel || 'all'}`;

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

// 通用解析搜索结果 HTML（兼容其他聚合站）
function parseSearchResults(html, keyword, searchSourceUrl) {
    const results = [];
    let match;

    // 模式1：匹配 <a> 标签中的真实网盘链接
    const linkPattern = /<a[^>]*href=["']([^"']*(?:pan\.baidu|quark\.cn|thunder|xunlei|aliyundrive|115\.com|cloud\.189)[^"']*)["'][^>]*>([^<]*)</gi;

    while ((match = linkPattern.exec(html)) !== null) {
        const link = match[1];
        const title = match[2].trim();
        if (title.length > 2) {
            const source = detectSource(link + title);
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

    // 模式2：匹配列表结构
    const itemPattern = /<(?:li|div|article)[^>]*class=["'][^"']*(?:item|result|resource|entry)[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|div|article)>/gi;

    while ((match = itemPattern.exec(html)) !== null) {
        const block = match[1];

        const titleMatch = block.match(/<(?:a|h[2-4]|span|div)[^>]*class=["'][^"']*(?:title|name)[^"']*["'][^>]*>([^<]+)/i)
            || block.match(/<a[^>]*>([^<]{4,})</i);
        if (!titleMatch) continue;

        const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        if (title.length < 2) continue;

        const linkMatch = block.match(/href=["']([^"']+)["']/i);
        let link = linkMatch ? linkMatch[1] : '';
        // 如果链接是 javascript:void(0) 等无效链接，使用搜索源 URL 作为跳转
        if (!link || link.startsWith('javascript:') || link === '#') {
            link = searchSourceUrl || '';
        }

        const codeMatch = block.match(/(?:提取码|密码)[：:\s]*([a-zA-Z0-9]{4})/i);
        const code = codeMatch ? codeMatch[1] : '';

        const timeMatch = block.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
        const time = timeMatch ? timeMatch[1] : '';

        const source = detectSource(block);

        if (!results.some(r => r.title === title && r.link === link)) {
            results.push({ title, source: source.key, sourceLabel: source.label, link, code, time });
        }
    }

    return results;
}

// source 参数映射到 UP云搜的 pan_channel 参数
const SOURCE_TO_PAN_CHANNEL = {
    'all': 'all',
    'baidu': 'baidu',
    'quark': 'kuake',  // UP云搜使用 kuake 而非 quark
    'ali': 'ali',
    'thunder': 'xunlei',
    'tianyi': 'tianyi',
};

// 搜索影视资源（并发请求多个源，优化速度）
async function searchMovieResources(keyword, source) {
    const encodedKeyword = encodeURIComponent(keyword);
    const panChannel = SOURCE_TO_PAN_CHANNEL[source] || 'all';

    // UP云搜搜索源（主力源，支持 pan_channel 筛选）
    const upyunsoUrl = `https://www.upyunso.com/search?keyword=${encodedKeyword}&pan_channel=${panChannel}`;

    const fetchHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.upyunso.com/',
    };

    // 单个请求超时时间（15秒）
    const FETCH_TIMEOUT = 15000;

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

    // 并发请求多页（提升结果数量和速度）
    const pageUrls = [
        { url: upyunsoUrl, name: 'UP云搜-P1' },
        { url: `${upyunsoUrl}&pn=2`, name: 'UP云搜-P2' },
    ];

    const promises = pageUrls.map(async (src) => {
        try {
            const response = await fetchWithTimeout(src.url, {
                headers: fetchHeaders,
                cf: { cacheTtl: 300 }
            }, FETCH_TIMEOUT);
            if (response.ok) {
                const html = await response.text();
                return parseUpyunsoResults(html, keyword, panChannel);
            }
        } catch (err) {
            console.error(`搜索源 ${src.name} 请求失败:`, err.message);
        }
        return [];
    });

    const resultsArrays = await Promise.all(promises);
    let allResults = resultsArrays.flat();

    // 后置来源过滤（UP云搜的 pan_channel 已在 URL 中指定，这里做二次保障）
    if (source && source !== 'all') {
        // 将 "other" 来源也保留（可能是识别不精确的结果）
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

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS });
    }

    // 路由：/api/search
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
            // 整体搜索超时 25 秒
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

    // 健康检查
    if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok', service: '796Helper Movie Search Proxy' }), {
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
    }

    // 404
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
