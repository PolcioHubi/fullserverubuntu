const WOZEK_IMAGE_URL = "/assets/img/extracted-images/wozek.png";

(function($) {
    function loadImageFromUrl(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = url;
        });
    }
    function drawCover(ctx, image, w, h, bgColor) {
        if (bgColor) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, w, h); }
        const imgR = image.width / image.height, canR = w / h;
        let dx = 0, dy = 0, dw = w, dh = h;
        if (imgR > canR) { dh = h; dw = dh * imgR; dx = (w - dw) / 2; }
        else { dw = w; dh = dw / imgR; dy = (h - dh) / 2; }
        ctx.drawImage(image, dx, dy, dw, dh);
    }
    async function renderToCanvas($el, imageUrl, options) {
        const el = $el[0];
        if (!el) return;
        let canvas = el.querySelector("canvas.bg");
        if (!canvas) { canvas = document.createElement("canvas"); canvas.className = "bg"; el.prepend(canvas); }
        const rect = el.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width));
        canvas.height = Math.max(1, Math.round(rect.height));
        const ctx = canvas.getContext("2d", { alpha: true });
        const image = await loadImageFromUrl(imageUrl);
        drawCover(ctx, image, canvas.width, canvas.height, options && options.background);
    }
    async function setFromUrl($el, imageUrl, options) {
        return renderToCanvas($el, imageUrl, options || {});
    }
    $.canvasBg = $.canvasBg || { setFromUrl, utils: { loadImageFromUrl } };
})(jQuery);

const wozekManager = {
    init() {
        this.setupLayout();
        this.setupPlaceholders();
        this.startDataPolling();
        this.setupCanvasBackground();
        this.setupTimeDisplay();
        this.listeners();
    },

    setupLayout() {
        this.$standalone = $("[data-standalone]");
        this.$wrapper = $("[data-wrapper]");
        this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden] fixed");
        if ($(window).height() < 680) {
            this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden]");
        }
    },

    setupPlaceholders() {
        this.placeholders = {
            $picture: $('[data-placeholder="wozek_picture"]'),
            $first_name: $('[data-placeholder="wozek_first_name"]'),
            $last_name: $('[data-placeholder="wozek_last_name"]'),
            $birthdate: $('[data-placeholder="wozek_birthdate"]'),
            $pesel: $('[data-placeholder="wozek_pesel"]'),
            $category: $('[data-placeholder="wozek_category"]'),
            $number: $('[data-placeholder="wozek_number"]'),
            $issue: $('[data-placeholder="wozek_issue"]'),
            $expiration: $('[data-placeholder="wozek_expiration"]'),
            $issuer: $('[data-placeholder="wozek_issuer"]'),
            $scope: $('[data-placeholder="wozek_scope"]'),
            $certificate: $('[data-placeholder="wozek_certificate"]'),
            $last_update: $('[data-placeholder="wozek_last_update"]')
        };
    },

    startDataPolling() {
        const poll = async () => {
            const item = await requests.get("/api/data/get/details");
            if (!item.success || !item.data || !item.data.wozek) return;
            const d = item.data.wozek;
            const currentSrc = this.placeholders.$picture.attr("src") || "";
            if (window.__USER_PHOTO_BASE64) {
                this.placeholders.$picture.attr("src", window.__USER_PHOTO_BASE64);
            } else if (currentSrc) {
                this.placeholders.$picture.attr("src", currentSrc);
            }
            this.placeholders.$first_name.html(d.main.first_name);
            this.placeholders.$last_name.html(d.main.last_name);
            this.placeholders.$birthdate.html(d.main.birthdate);
            this.placeholders.$pesel.html(d.main.pesel);
            this.placeholders.$category.html(d.main.category);
            this.placeholders.$number.html(d.other.number);
            this.placeholders.$issue.html(d.other.issue);
            this.placeholders.$expiration.html(d.other.expiration);
            this.placeholders.$issuer.html(d.other.issuer);
            this.placeholders.$scope.html(d.other.scope);
            this.placeholders.$certificate.html(d.other.certificate);
            this.placeholders.$last_update.html(d.other.last_update);
        };
        poll();
        setInterval(poll, 10000);
    },

    setupCanvasBackground() {
        const $el = $(".wozek").first();
        $.canvasBg.setFromUrl($el, WOZEK_IMAGE_URL, { background: "#fff" });
        let rafId;
        $(window).on("resize", () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                $.canvasBg.setFromUrl($el, WOZEK_IMAGE_URL, { background: "#fff" });
            });
        });
    },

    setupTimeDisplay() {
        function formatTime(prefix) {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, "0");
            const mm = String(now.getMinutes()).padStart(2, "0");
            const ss = String(now.getSeconds()).padStart(2, "0");
            const dd = String(now.getDate()).padStart(2, "0");
            const mo = String(now.getMonth() + 1).padStart(2, "0");
            return prefix + " " + hh + ":" + mm + ":" + ss + " " + dd + "." + mo + "." + now.getFullYear();
        }
        setInterval(() => {
            const $el = $('[data-p="time"]');
            $el.text(formatTime($el.data("time")));
        });
    },

    listeners() {
        $("[data-standalone]").on("scroll", function() {
            const scrollTop = $(this).scrollTop();
            $(".dashboard-navigation").each(function() {
                const $nav = $(this);
                if ($nav.hasClass("ignore-scroll")) return;
                scrollTop > 0
                    ? $nav.addClass("background[backdrop] scrolled")
                    : $nav.removeClass("background[backdrop] scrolled");
            });
        });
    }
};
