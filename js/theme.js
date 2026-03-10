/* ============================================
   796Helper - Theme Module
   Dark/Light theme switching with persistence
   ============================================ */

const Theme = (function () {
    const STORAGE_KEY = '796helper-theme';
    let currentTheme = 'dark';

    function getSystemPreference() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }

    function getSavedTheme() {
        return localStorage.getItem(STORAGE_KEY);
    }

    function saveTheme(theme) {
        localStorage.setItem(STORAGE_KEY, theme);
    }

    function applyTheme(theme) {
        currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        saveTheme(theme);
    }

    function toggle() {
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
    }

    function getCurrent() {
        return currentTheme;
    }

    function init() {
        // Priority: saved > system > default(dark)
        const saved = getSavedTheme();
        if (saved) {
            applyTheme(saved);
        } else {
            applyTheme(getSystemPreference());
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!getSavedTheme()) {
                    applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }

        // Bind toggle button
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggle);
        }
    }

    return {
        init,
        toggle,
        getCurrent
    };
})();
