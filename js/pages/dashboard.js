/* ============================================
   796Helper - Dashboard Page Module
   ============================================ */

const DashboardPage = (function () {
    const title = '仪表盘';

    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 6) return '夜深了';
        if (hour < 12) return '早上好';
        if (hour < 14) return '中午好';
        if (hour < 18) return '下午好';
        return '晚上好';
    }

    function getDateStr() {
        const now = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        return now.toLocaleDateString('zh-CN', options);
    }

    function render() {
        return `
            <div class="dashboard-page page-content">
                <!-- Welcome Section -->
                <div class="dashboard-welcome">
                    <h2 class="greeting">
                        ${getGreeting()}，<span class="greeting-name">欢迎回来</span>
                    </h2>
                    <p class="date-info">${getDateStr()}</p>
                </div>

                <!-- Feature Cards Grid -->
                <div class="dashboard-grid">
                    <a href="#chat" class="card card-clickable feature-card">
                        <div class="card-icon" style="background: linear-gradient(135deg, rgba(108,92,231,0.15), rgba(162,155,254,0.08));">
                            <i data-lucide="message-square"></i>
                        </div>
                        <div class="card-title">AI 助手</div>
                        <div class="card-desc">与 AI 智能对话，获取信息、生成内容、解答问题</div>
                        <div class="card-status">
                            <span class="badge badge-success">可用</span>
                        </div>
                    </a>

                    <a href="#movie-search" class="card card-clickable feature-card">
                        <div class="card-icon" style="background: linear-gradient(135deg, rgba(155,89,182,0.15), rgba(162,155,254,0.08));">
                            <i data-lucide="film"></i>
                        </div>
                        <div class="card-title">影视搜索</div>
                        <div class="card-desc">搜索百度网盘、夸克网盘、迅雷等平台的影视资源</div>
                        <div class="card-status">
                            <span class="badge badge-success">可用</span>
                        </div>
                    </a>

                    <div class="card feature-card">
                        <div class="card-icon" style="background: linear-gradient(135deg, rgba(0,206,201,0.15), rgba(85,239,196,0.08));">
                            <i data-lucide="check-square"></i>
                        </div>
                        <div class="card-title">待办事项</div>
                        <div class="card-desc">管理你的日常任务，追踪进度与截止日期</div>
                        <div class="card-status">
                            <span class="badge badge-soon">即将推出</span>
                        </div>
                    </div>

                    <div class="card feature-card">
                        <div class="card-icon" style="background: linear-gradient(135deg, rgba(116,185,255,0.15), rgba(116,185,255,0.08));">
                            <i data-lucide="file-text"></i>
                        </div>
                        <div class="card-title">笔记</div>
                        <div class="card-desc">随时记录灵感和想法，支持 Markdown 格式</div>
                        <div class="card-status">
                            <span class="badge badge-soon">即将推出</span>
                        </div>
                    </div>

                    <div class="card feature-card">
                        <div class="card-icon" style="background: linear-gradient(135deg, rgba(253,203,110,0.15), rgba(253,203,110,0.08));">
                            <i data-lucide="settings"></i>
                        </div>
                        <div class="card-title">设置</div>
                        <div class="card-desc">个性化配置你的 AI 助手偏好与外观</div>
                        <div class="card-status">
                            <span class="badge badge-soon">即将推出</span>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="dashboard-footer">
                    796Helper v1.0 · 你的个人 AI 助手
                </div>
            </div>
        `;
    }

    function init() {
        // Dashboard has no dynamic interactions for now
    }

    return {
        title,
        render,
        init
    };
})();
