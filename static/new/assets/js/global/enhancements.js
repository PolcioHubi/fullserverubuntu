// UI Enhancements — skeleton, swipe, haptic, pull-to-refresh, active tab
(function () {
    "use strict";

    // ───── 1. SKELETON LOADING ─────
    var skeletonEls = document.querySelectorAll("[data-placeholder]");
    skeletonEls.forEach(function (el) {
        if (el.tagName === "IMG") return;
        el.classList.add("skeleton");
    });
    function removeAllSkeletons() {
        skeletonEls.forEach(function (el) { el.classList.remove("skeleton"); });
    }
    var skeletonObserver = new MutationObserver(function () {
        removeAllSkeletons();
        skeletonObserver.disconnect();
        clearTimeout(skeletonTimeout);
    });
    skeletonEls.forEach(function (el) {
        if (el.tagName === "IMG") return;
        skeletonObserver.observe(el, { childList: true, characterData: true, subtree: true });
    });
    // Fallback: remove skeletons after 3s even if no mutations observed
    var skeletonTimeout = setTimeout(function () {
        removeAllSkeletons();
        skeletonObserver.disconnect();
    }, 3000);

    // ───── 2. SWIPE BACK GESTURE ─────
    var touchStartX = 0, touchStartY = 0, swiping = false;
    document.addEventListener("touchstart", function (e) {
        var t = e.touches[0];
        if (t.clientX < 30) { touchStartX = t.clientX; touchStartY = t.clientY; swiping = true; }
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
        if (!swiping) return;
        swiping = false;
        var t = e.changedTouches[0], dx = t.clientX - touchStartX, dy = Math.abs(t.clientY - touchStartY);
        if (dx > 80 && dy < dx * 0.5) { if (navigator.vibrate) navigator.vibrate(8); history.back(); }
    }, { passive: true });

    // ───── 3. HAPTIC FEEDBACK ─────
    document.addEventListener("click", function (e) {
        var el = e.target.closest("button, a, [data-button], [data-route], [data-redirect]");
        if (el && navigator.vibrate) navigator.vibrate(10);
    }, { passive: true });

    // ───── 4. PULL-TO-REFRESH (DISABLED) ─────
    (function () {
        return; // wyłączone
        var standalone = document.querySelector("[data-standalone]");
        if (!standalone) return;
        var startY = 0, pulling = false;
        var indicator = document.createElement("div");
        indicator.className = "ptr-indicator";
        indicator.innerHTML = '<div class="ptr-spinner"></div>';
        standalone.parentNode.insertBefore(indicator, standalone);

        standalone.addEventListener("touchstart", function (e) {
            if (standalone.scrollTop <= 0) { startY = e.touches[0].clientY; pulling = true; }
        }, { passive: true });
        standalone.addEventListener("touchmove", function (e) {
            if (!pulling) return;
            var dy = e.touches[0].clientY - startY;
            if (dy > 0 && dy < 280) { indicator.style.height = dy * 0.2 + "px"; indicator.style.opacity = Math.min(1, dy / 220); }
        }, { passive: true });
        standalone.addEventListener("touchend", function (e) {
            if (!pulling) return; pulling = false;
            var dy = e.changedTouches[0].clientY - startY;
            if (dy > 220) {
                indicator.classList.add("ptr-refreshing");
                indicator.style.height = "36px"; indicator.style.opacity = "1";
                if (navigator.vibrate) navigator.vibrate(15);
                setTimeout(function () { indicator.classList.remove("ptr-refreshing"); indicator.style.height = "0"; indicator.style.opacity = "0"; location.reload(); }, 600);
            } else { indicator.style.height = "0"; indicator.style.opacity = "0"; }
        }, { passive: true });
    })();

    // ───── 5. ACTIVE TAB INDICATOR ─────
    (function () {
        var nav = document.querySelector('[data-group="navigation"]');
        if (!nav) return;
        var path = location.pathname.replace(/^\/+|\/+$/g, "") || "documents";
        var segment = path.split("/").pop().replace(/\.html$/, "");
        var docPages = ["mdowod", "mprawojazdy", "school_id", "student_id", "dowodnowy_new", "prawojazdy_new", "school_id_new", "student_id_new"];
        var activeSection = (path.indexOf("user_files/") === 0 || docPages.indexOf(segment) !== -1) ? "documents" : path;
        var links = nav.querySelectorAll("a[href]");

        links.forEach(function (a) {
            var href = a.getAttribute("href").replace(/^\/+/, "");
            var img = a.querySelector("img");
            var span = a.querySelector("span");
            if (!img) return;
            if (href === activeSection) {
                var src = img.getAttribute("src");
                if (src && !src.includes("_active")) img.setAttribute("src", src.replace(".svg", "_active.svg"));
                if (span) span.classList.add("active");
                a.classList.add("nav-active");
            } else {
                var src2 = img.getAttribute("src");
                if (src2 && src2.includes("_active")) img.setAttribute("src", src2.replace("_active.svg", ".svg"));
                if (span) span.classList.remove("active");
                a.classList.remove("nav-active");
            }
        });

        links.forEach(function (a) {
            a.addEventListener("click", function (e) {
                var href = a.getAttribute("href");
                if (href && !href.startsWith("http")) {
                    e.preventDefault();
                    if (navigator.vibrate) navigator.vibrate(10);
                    if (window._navigateTo) window._navigateTo(href); else window.location.replace(href);
                }
            });
        });
    })();
})();
