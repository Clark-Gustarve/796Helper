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

// 解析搜索结果 HTML（适配常见网盘资源聚合站结构）
function parseSearchResults(html, keyword) {
    const results = [];

    // 通用提取模式：匹配包含关键信息的区块
    // 模式1：匹配 <a> 标签中的资源链接和标题
    const linkPattern = /<a[^>]*href=["']([^"']*(?:pan\.baidu|quark\.cn|thunder|xunlei|aliyundrive|115\.com|cloud\.189)[^"']*)["'][^>]*>([^<]*)</gi;
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
        const link = match[1];
        const title = match[2].trim();
        if (title.length > 2) {
            const source = detectSource(link + title);
            results.push({
                title: title,
                source: source.key,
                sourceLabel: source.label,
                link: link,
                code: '',
                time: ''
            });
        }
    }

    // 模式2：匹配常见列表结构 <li> 或 <div class="item"> 等
    const itemPattern = /<(?:li|div|article)[^>]*class=["'][^"']*(?:item|result|resource|entry)[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|div|article)>/gi;

    while ((match = itemPattern.exec(html)) !== null) {
        const block = match[1];

        // 提取标题
        const titleMatch = block.match(/<(?:a|h[2-4]|span|div)[^>]*class=["'][^"']*(?:title|name)[^"']*["'][^>]*>([^<]+)/i)
            || block.match(/<a[^>]*>([^<]{4,})</i);
        if (!titleMatch) continue;

        const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        if (title.length < 2) continue;

        // 提取链接
        const linkMatch = block.match(/href=["']([^"']+)["']/i);
        const link = linkMatch ? linkMatch[1] : '';

        // 提取提取码
        const codeMatch = block.match(/(?:提取码|密码|提取码)[：:\s]*([a-zA-Z0-9]{4})/i);
        const code = codeMatch ? codeMatch[1] : '';

        // 提取时间
        const timeMatch = block.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
        const time = timeMatch ? timeMatch[1] : '';

        const source = detectSource(block);

        // 去重检查
        if (!results.some(r => r.title === title && r.link === link)) {
            results.push({ title, source: source.key, sourceLabel: source.label, link, code, time });
        }
    }

    return results;
}

// 搜索影视资源（从多个公开聚合站获取）
async function searchMovieResources(keyword, source) {
    const encodedKeyword = encodeURIComponent(keyword);

    // 可配置的搜索源列表（公开网盘资源聚合站）
    const searchSources = [
        {
            name: 'UP云搜',
            url: `https://www.upyunso.com/search.html?keyword=${encodedKeyword}`,
            enabled: true
        },
        {
            name: '小纸条',
            url: `https://u.gitcafe.net/?q=${encodedKeyword}`,
            enabled: true
        }
    ];

    let allResults = [];

    for (const src of searchSources) {
        if (!src.enabled) continue;
        try {
            const response = await fetch(src.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                },
                cf: { cacheTtl: 300 }  // Cloudflare 边缘缓存 5 分钟
            });

            if (response.ok) {
                const html = await response.text();
                const results = parseSearchResults(html, keyword);
                allResults = allResults.concat(results);
            }
        } catch (err) {
            console.error(`搜索源 ${src.name} 请求失败:`, err.message);
        }
    }

    // 按来源类型筛选
    if (source && source !== 'all') {
        allResults = allResults.filter(r => r.source === source);
    }

    // 去重（基于标题相似度）
    const seen = new Set();
    allResults = allResults.filter(r => {
        const key = r.title.substring(0, 20) + r.source;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return allResults.slice(0, 30); // 限制返回条数
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
            const results = await searchMovieResources(keyword.trim(), source);
            return new Response(JSON.stringify({
                success: true,
                data: results,
                total: results.length,
                keyword: keyword.trim()
            }), {
                headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
            });
        } catch (err) {
            return new Response(JSON.stringify({
                success: false,
                error: '搜索服务暂时不可用，请稍后重试',
                data: [],
                total: 0
            }), {
                status: 500,
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
