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
        if (!sidebar || !overlay) return;
        isMobileOpen = true;
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
        overlay.style.display = 'block';
        // Trigger reflow for animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    }

    function closeMobile() {
        if (!sidebar || !overlay) return;
        isMobileOpen = false;
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        setTimeout(() => {
            if (!isMobileOpen) {
                overlay.style.display = '';
            }
        }, 300);
    }

    function handleNavClick(e) {
        const navItem = e.target.closest('.nav-item');
        if (!navItem) return;

        // Close mobile sidebar on nav click
        if (isMobile() && isMobileOpen) {
            closeMobile();
        }
    }

    function handleResize() {
        if (!isMobile()) {
            closeMobile();
        }
    }

    function init() {
        // Restore collapsed state (desktop only)
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'true' && !isMobile()) {
            collapse();
        }

        // Toggle button (desktop collapse)
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggle);
        }

        // Mobile menu button
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', openMobile);
        }

        // Overlay click to close
        if (overlay) {
            overlay.addEventListener('click', closeMobile);
        }

        // Nav item click
        if (sidebar) {
            sidebar.addEventListener('click', handleNavClick);
        }

        // Resize handler
        window.addEventListener('resize', handleResize);
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
