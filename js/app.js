/* ============================================
   796Helper - App Entry Point
   Initializes all modules on DOM ready
   ============================================ */

(function () {
    function init() {
        // 1. Initialize theme (apply before rendering to avoid flash)
        Theme.init();

        // 2. Initialize sidebar controls
        Sidebar.init();

        // 3. Register page routes
        Router.register('dashboard', DashboardPage);
        Router.register('chat', ChatPage);
        Router.register('movie-search', MovieSearchPage);

        // 4. Initialize router (triggers first page render)
        Router.init();

        // 5. Initialize Lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }

        console.log('%c796Helper v1.0%c Initialized ✓', 
            'color: #6C5CE7; font-weight: bold; font-size: 14px;',
            'color: #00CEC9; font-size: 12px;'
        );
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
