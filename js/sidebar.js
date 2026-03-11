/* ============================================
   796Helper - Sidebar Module
   Sidebar expand/collapse & mobile controls
   ============================================ */

const Sidebar = (function () {
    const STORAGE_KEY = '796helper-sidebar-collapsed';
    let isCollapsed = false;
    let isMobileOpen = false;

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');

    function isMobile() {
        return window.innerWidth <= 768;
    }

    function syncMobileState(open) {
        isMobileOpen = open;

        if (sidebar) {
            sidebar.classList.toggle('mobile-open', open);
        }

        if (overlay) {
            overlay.classList.toggle('active', open);
        }

        document.body.classList.toggle('sidebar-mobile-open', open);

        if (mobileMenuBtn) {
            mobileMenuBtn.setAttribute('aria-expanded', String(open));
        }
    }

    function collapse() {
        if (!sidebar) return;
        isCollapsed = true;
        sidebar.classList.add('collapsed');
        localStorage.setItem(STORAGE_KEY, 'true');
    }

    function expand() {
        if (!sidebar) return;
        isCollapsed = false;
        sidebar.classList.remove('collapsed');
        localStorage.setItem(STORAGE_KEY, 'false');
    }

    function toggle() {
        if (isCollapsed) {
            expand();
        } else {
            collapse();
        }
    }

    function openMobile() {
        if (!isMobile()) return;
        syncMobileState(true);
    }

    function closeMobile() {
        syncMobileState(false);
    }

    function toggleMobile() {
        if (isMobileOpen) {
            closeMobile();
        } else {
            openMobile();
        }
    }

    function handleNavClick(e) {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;

        if (isMobile() && isMobileOpen) {
            closeMobile();
        }
    }

    function handleResize() {
        if (!isMobile()) {
            closeMobile();
        }
    }

    function handleKeydown(e) {
        if (e.key === 'Escape' && isMobileOpen) {
            closeMobile();
        }
    }

    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'true' && !isMobile()) {
            collapse();
        }

        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggle);
        }

        if (mobileMenuBtn) {
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
            mobileMenuBtn.addEventListener('click', toggleMobile);
        }

        if (overlay) {
            overlay.addEventListener('click', closeMobile);
        }

        if (sidebar) {
            sidebar.addEventListener('click', handleNavClick);
        }

        window.addEventListener('resize', handleResize);
        window.addEventListener('routechange', closeMobile);
        document.addEventListener('keydown', handleKeydown);
    }

    return {
        init,
        collapse,
        expand,
        toggle,
        openMobile,
        closeMobile
    };
})();

