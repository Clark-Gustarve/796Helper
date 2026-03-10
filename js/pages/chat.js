/* ============================================
   796Helper - Chat Page Module
   AI chat interface with local simulation
   ============================================ */

const ChatPage = (function () {
    const title = 'AI 助手';
    let messages = [];

    const aiResponses = [
        '你好！我是 796Helper，你的个人 AI 助手。有什么可以帮你的吗？',
        '这是一个很有趣的问题！让我来帮你分析一下...',
        '好的，我理解你的需求了。这里有几个建议供你参考：\n\n1. 首先，可以从问题的核心出发\n2. 然后，逐步拆解各个细节\n3. 最后，综合考虑整体方案',
        '没问题！我可以帮你处理这个任务。请给我更多细节，我会尽力提供最好的解答。',
        '这是一个值得深入探讨的话题。从我的分析来看，有以下几个关键点需要注意...',
        '很高兴为你效劳！如果还有其他问题，随时都可以问我。'
    ];

    function getTimeStr() {
        const now = new Date();
        return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }

    function renderMessage(msg) {
        const isUser = msg.role === 'user';
        const avatarContent = isUser
            ? '<i data-lucide="user"></i>'
            : '<i data-lucide="bot"></i>';

        return `
            <div class="message message-${msg.role} animate-slide-up">
                <div class="message-avatar">
                    ${avatarContent}
                </div>
                <div>
                    <div class="message-bubble">${msg.content.replace(/\n/g, '<br>')}</div>
                    <div class="message-time">${msg.time}</div>
                </div>
            </div>
        `;
    }

    function renderTypingIndicator() {
        return `
            <div class="message message-ai message-typing" id="typingIndicator">
                <div class="message-avatar">
                    <i data-lucide="bot"></i>
                </div>
                <div>
                    <div class="message-bubble">
                        <div class="loading-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function render() {
        const hasMessages = messages.length > 0;

        const messagesHtml = hasMessages
            ? messages.map(renderMessage).join('')
            : `
                <div class="chat-welcome">
                    <div class="welcome-icon">
                        <i data-lucide="bot"></i>
                    </div>
                    <h2 class="welcome-title">你好，我是 <span class="text-gradient">796Helper</span></h2>
                    <p class="welcome-subtitle">你的个人 AI 助手，随时为你提供帮助。试试问我些什么吧！</p>
                    <div class="welcome-tags">
                        <span class="tag" data-prompt="帮我写一段代码"><i data-lucide="code-2"></i> 写代码</span>
                        <span class="tag" data-prompt="帮我翻译一段文字"><i data-lucide="languages"></i> 翻译</span>
                        <span class="tag" data-prompt="帮我分析这个问题"><i data-lucide="brain"></i> 分析问题</span>
                        <span class="tag" data-prompt="帮我写一篇文章"><i data-lucide="pen-tool"></i> 写文章</span>
                        <span class="tag" data-prompt="今天的天气怎么样"><i data-lucide="cloud-sun"></i> 聊天</span>
                    </div>
                </div>
            `;

        return `
            <div class="chat-page page-content">
                <div class="chat-messages" id="chatMessages">
                    ${messagesHtml}
                </div>
                <div class="chat-input-area">
                    <div class="chat-input-wrapper">
                        <div class="chat-input-container">
                            <textarea class="chat-input" id="chatInput" 
                                placeholder="输入消息... (Enter 发送，Shift+Enter 换行)" 
                                rows="1"></textarea>
                        </div>
                        <button class="chat-send-btn" id="chatSendBtn" title="发送">
                            <i data-lucide="send"></i>
                        </button>
                    </div>
                    <div class="chat-input-hint">796Helper 可能会产生不准确的信息，请注意甄别</div>
                </div>
            </div>
        `;
    }

    function scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            requestAnimationFrame(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
        }
    }

    function addMessage(role, content) {
        messages.push({
            role,
            content,
            time: getTimeStr()
        });
    }

    function appendMessageToDOM(msg) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        // Remove welcome state if present
        const welcome = chatMessages.querySelector('.chat-welcome');
        if (welcome) {
            welcome.remove();
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderMessage(msg);
        const msgEl = tempDiv.firstElementChild;
        chatMessages.appendChild(msgEl);

        // Reinit lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }

        scrollToBottom();
    }

    function showTyping() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderTypingIndicator();
        const typingEl = tempDiv.firstElementChild;
        chatMessages.appendChild(typingEl);

        if (window.lucide) {
            lucide.createIcons();
        }

        scrollToBottom();
    }

    function removeTyping() {
        const typing = document.getElementById('typingIndicator');
        if (typing) {
            typing.remove();
        }
    }

    function getRandomAIResponse() {
        const idx = Math.floor(Math.random() * aiResponses.length);
        return aiResponses[idx];
    }

    function sendMessage(text) {
        if (!text.trim()) return;

        // Add user message
        const userMsg = { role: 'user', content: text.trim(), time: getTimeStr() };
        addMessage('user', text.trim());
        appendMessageToDOM(userMsg);

        // Show typing indicator
        showTyping();

        // Simulate AI response delay
        const delay = 800 + Math.random() * 1200;
        setTimeout(() => {
            removeTyping();
            const aiContent = getRandomAIResponse();
            const aiMsg = { role: 'ai', content: aiContent, time: getTimeStr() };
            addMessage('ai', aiContent);
            appendMessageToDOM(aiMsg);
        }, delay);
    }

    function autoResizeInput(textarea) {
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 120);
        textarea.style.height = newHeight + 'px';
    }

    function init() {
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('chatSendBtn');

        if (chatInput) {
            // Enter to send, Shift+Enter for new line
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const text = chatInput.value;
                    if (text.trim()) {
                        sendMessage(text);
                        chatInput.value = '';
                        autoResizeInput(chatInput);
                    }
                }
            });

            // Auto resize
            chatInput.addEventListener('input', () => {
                autoResizeInput(chatInput);
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                const text = chatInput ? chatInput.value : '';
                if (text.trim()) {
                    sendMessage(text);
                    chatInput.value = '';
                    autoResizeInput(chatInput);
                }
            });
        }

        // Welcome tag click
        const tags = document.querySelectorAll('.welcome-tags .tag');
        tags.forEach(tag => {
            tag.addEventListener('click', () => {
                const prompt = tag.getAttribute('data-prompt');
                if (prompt && chatInput) {
                    sendMessage(prompt);
                    chatInput.value = '';
                }
            });
        });
    }

    return {
        title,
        render,
        init
    };
})();
