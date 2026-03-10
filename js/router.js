/* ============================================
   796Helper - Router Module
   Hash-based SPA routing
   ============================================ */

const Router = (function () {
    const routes = {};
    let currentRoute = null;
    const pageContainer = document.getElementById('pageContainer');

    function register(path, module) {
        routes[path] = module;
    }

    function navigate(path) {
        if (!path || !routes[path]) {
            path = 'dashboard'; // default route
        }

        if (currentRoute === path) return;
        currentRoute = path;

        const module = routes[path];
        if (!module) return;

        // Update page container
        if (pageContainer) {
            pageContainer.innerHTML = module.render();
            pageContainer.scrollTop = 0;

            // Reinitialize Lucide icons for new content
            if (window.lucide) {
                lucide.createIcons();
            }

            // Call module init for event bindings
            if (typeof module.init === 'function') {
                module.init();
            }
        }

        // Update header title
        const headerTitle = document.getElementById('headerTitle');
        if (headerTitle && module.title) {
            headerTitle.textContent = module.title;
        }

        // Update sidebar active state
        updateNavActive(path);

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('routechange', { detail: { path } }));
    }

    function updateNavActive(path) {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const route = item.getAttribute('data-route');
            if (route === path) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    function getCurrentRoute() {
        return currentRoute;
    }

    function handleHashChange() {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        navigate(hash);
    }

    function init() {
        window.addEventListener('hashchange', handleHashChange);
        // Initial route
        handleHashChange();
    }

    return {
        register,
        navigate,
        getCurrentRoute,
        init
    };
})();
