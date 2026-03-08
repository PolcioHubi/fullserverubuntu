const moreManager = {
    init() {
        this.functions();
        this.listeners();
        this.setupLayout();
    },

    setupLayout() {
        this.$standalone = $("[data-standalone]");
        this.$wrapper = $("[data-wrapper]");
        this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden] fixed");
        if ($(window).height() < 680) {
            this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden]");
        }
    },

    functions() {
        this.setTabOpen = function (tab) {
            const url = new URL(window.location.href);
            url.searchParams.set("tabOpen", tab);
            window.history.replaceState({}, "", url.toString());
        };

        this.removeTabOpen = function () {
            const url = new URL(window.location.href);
            url.searchParams.delete("tabOpen");
            window.history.replaceState({}, "", url.toString());
        };

        this.postPurge = function (params = {}) {
            try {
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: "PURGE_HTML" });
                }
            } catch {}

            const url = new URL(window.location.href);
            Object.entries(params).forEach(([key, value]) => {
                if (value != null) url.searchParams.set(key, value);
            });
            url.searchParams.set("ts", Date.now().toString());
            (window._navigateTo || window.location.replace.bind(window.location))(url.toString());
        };
    },

    listeners() {
        const self = this;
        const $wrapper = $("[data-wrapper]");
        const $standalone = $("[data-standalone]");

        // --- Język ---
        $('[data-button="language"]').on("click", function () {
            if (!navigator.onLine) return;
            self.setTabOpen("language");
            $wrapper.addClass("scale[0.9]");
            $standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden]");
            $(".language").css("transform", "").addClass("overflow[hidden]");
        });

        $('[data-button="language_back"]').on("click", function () {
            self.removeTabOpen();
            $(".language").css("transform", "translateX(100%)").removeClass("overflow[hidden]");
            $standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed");
            $wrapper.removeClass("scale[0.9]");
        });

        $('[data-button="polish"]').on("click", async function () {
            await requests.post("/api/language/set", { language: "pl" });
            self.postPurge({ tabOpen: "language", lang: "pl" });
        });

        $('[data-button="english"]').on("click", async function () {
            await requests.post("/api/language/set", { language: "en" });
            self.postPurge({ tabOpen: "language", lang: "en" });
        });

        $('[data-button="ukrainian"]').on("click", async function () {
            await requests.post("/api/language/set", { language: "ua" });
            self.postPurge({ tabOpen: "language", lang: "ua" });
        });

        // --- Motyw ---
        $('[data-button="theme"]').on("click", function () {
            if (!navigator.onLine) return;
            self.setTabOpen("theme");
            $wrapper.addClass("scale[0.9]");
            $standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden]");
            $(".theme").css("transform", "").addClass("overflow[hidden]");
        });

        $('[data-button="theme_back"]').on("click", function () {
            self.removeTabOpen();
            $(".theme").css("transform", "translateX(100%)").removeClass("overflow[hidden]");
            $standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed");
            $wrapper.removeClass("scale[0.9]");
        });

        $('[data-button="light"]').on("click", async function () {
            await requests.post("/api/theme/set", { theme: "light" });
            self.postPurge({ tabOpen: "themes", theme: "light" });
        });

        $('[data-button="dark"]').on("click", async function () {
            await requests.post("/api/theme/set", { theme: "dark" });
            self.postPurge({ tabOpen: "themes", theme: "dark" });
        });

        // --- Kontakt ---
        $('[data-button="contact"]').on("click", function () {
            if (!navigator.onLine) return;
            self.setTabOpen("contact");
            $wrapper.addClass("scale[0.9]");
            $standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden]");
            $(".contact").css("transform", "").addClass("overflow[hidden]");
        });

        $('[data-button="contact_back"]').on("click", function () {
            self.removeTabOpen();
            $(".contact").css("transform", "translateX(100%)").removeClass("overflow[hidden]");
            $standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed");
            $wrapper.removeClass("scale[0.9]");
        });

        // --- Wyczyść cache ---
        $('[data-button="refreshCache"]').on("click", async function () {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
            if ("serviceWorker" in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister()));
            }
            location.reload();
        });

        // --- Collapsible navigation header ---
        const $scrollable = $("[data-standalone]");
        const $nav = $(".dashboard-navigation");
        const $largeTitle = $(".dashboard-navigation-large-title");
        const $smallTitle = $(".dashboard-navigation-small-title");

        const COLLAPSE_THRESHOLD = 0.7;
        const EXPAND_THRESHOLD = 0.35;
        const ANIM_DURATION = 160;
        const DEBOUNCE_MS = 90;

        let collapsed = false;
        let animating = false;
        let debounceTimer = null;

        function clamp(val, min, max) {
            return Math.max(min, Math.min(max, val));
        }

        function getLargeTitleOffset() {
            const scrollTop = $scrollable.scrollTop();
            const containerRect = $scrollable[0].getBoundingClientRect();
            const titleRect = $largeTitle[0].getBoundingClientRect();
            return (titleRect.top - containerRect.top) + scrollTop;
        }

        function getScrollState() {
            const st = $scrollable.scrollTop();
            const navH = $nav.outerHeight();
            const largeTop = getLargeTitleOffset();
            const largeH = Math.max(1, $largeTitle.outerHeight());
            const progress = clamp(((st + navH) - largeTop) / largeH, 0, 1);
            const expanded = Math.max(0, largeTop - navH);
            const collapsedPos = Math.max(0, (largeTop + largeH) - navH);
            return { st, navH, largeTop, largeH, progress, expanded, collapsed: collapsedPos };
        }

        function applyProgress(p) {
            $largeTitle.css({
                opacity: 1 - p,
                transform: "translateY(" + (-8 * p) + "px) scale(" + (1 - 0.02 * p) + ")"
            });
            $smallTitle.toggleClass("is-visible", p > 0.55);
            $nav.toggleClass("background[backdrop] scrolled", p > 0.55);
        }

        function setCollapsed() {
            collapsed = true;
            applyProgress(1);
        }

        function setExpanded() {
            collapsed = false;
            applyProgress(0);
        }

        function scrollTo(target, callback) {
            animating = true;
            $scrollable.stop().animate({ scrollTop: target }, ANIM_DURATION, function () {
                animating = false;
                if (callback) callback();
            });
        }

        const snapRange = $largeTitle.outerHeight() * 0.1;

        $scrollable.on("scroll", function () {
            if (animating) return;

            const state = getScrollState();
            applyProgress(state.progress);

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                if (animating) return;

                const s = getScrollState();
                const nearCollapsed = Math.abs(s.st - s.collapsed) <= snapRange;
                const nearExpanded = Math.abs(s.st - s.expanded) <= snapRange;

                if (!collapsed && s.progress >= COLLAPSE_THRESHOLD) {
                    nearCollapsed
                        ? scrollTo(s.collapsed, setCollapsed)
                        : setCollapsed();
                    return;
                }
                if (collapsed && s.progress <= EXPAND_THRESHOLD) {
                    nearExpanded
                        ? scrollTo(s.expanded, setExpanded)
                        : setExpanded();
                }
            }, DEBOUNCE_MS);
        });
    }
};
