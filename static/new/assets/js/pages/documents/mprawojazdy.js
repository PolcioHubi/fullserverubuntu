const MPRAWOJAZDY_IMAGE_URL = "/assets/img/extracted-images/mprawojazdy.png";
const MPRAWOJAZDY_FACE_PATH = "/assets/img/photos/mprawojazdy_face.jpg";

// Canvas Background Plugin
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
    $.canvasBg = { setFromUrl, utils: { loadImageFromUrl } };
})(jQuery);

const mprawojazdyManager = {
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
            $picture: $('[data-placeholder="mprawojazdy_picture"]'),
            $first_name: $('[data-placeholder="mprawojazdy_first_name"]'),
            $last_name: $('[data-placeholder="mprawojazdy_last_name"]'),
            $birthday: $('[data-placeholder="mprawojazdy_birthday"]'),
            $pesel: $('[data-placeholder="mprawojazdy_pesel"]'),
            $categories: $('[data-placeholder="mprawojazdy_categories"]'),
            $issue: $('[data-placeholder="mprawojazdy_issue"]'),
            $number: $('[data-placeholder="mprawojazdy_number"]'),
            $blank: $('[data-placeholder="mprawojazdy_blank"]'),
            $issuer: $('[data-placeholder="mprawojazdy_issuer"]'),
            $restrictions: $('[data-placeholder="mprawojazdy_restrictions"]'),
            $last_update: $('[data-placeholder="mprawojazdy_last_update"]')
        };
    },

    startDataPolling() {
        const poll = async () => {
            const item = await requests.get("/api/data/get/details");
            if (item.success) {
                const d = item.data;
                this.placeholders.$picture.attr("src", MPRAWOJAZDY_FACE_PATH);
                this.placeholders.$first_name.html(d.mprawojazdy.main.first_name);
                this.placeholders.$last_name.html(d.mprawojazdy.main.last_name);
                this.placeholders.$birthday.html(d.mprawojazdy.main.birthdate);
                this.placeholders.$pesel.html(d.mprawojazdy.main.pesel);
                this.placeholders.$categories.html(d.mprawojazdy.main.categories);
                this.placeholders.$issue.html(d.mprawojazdy.other.issue);
                this.placeholders.$number.html(d.mprawojazdy.other.number);
                this.placeholders.$blank.html(d.mprawojazdy.other.blank);
                this.placeholders.$issuer.html(d.mprawojazdy.other.issuer);
                this.placeholders.$restrictions.html(d.mprawojazdy.other.restrictions);
                this.placeholders.$last_update.html(d.mprawojazdy.other.last_update);

                // Dynamic category cards
                const $group = $('[data-group="categories"]');
                const templateLabel = $('[data-template="category"] h1').attr("data-placeholder") || "Kategoria";
                const cats = d.mprawojazdy.main.categories;
                if (!cats) { $group.empty(); return; }
                const unique = [...new Set(cats.split(",").map(c => c.trim().replace(/[0-9]/g, "")).filter(Boolean))];
                $group.find(".card").each(function() {
                    const text = $(this).find("h1").text().toUpperCase().replace(/[0-9]/g, "").trim();
                    const m = text.match(/([A-Z]+)$/);
                    const cat = m ? m[1] : null;
                    if (cat && !unique.includes(cat)) $(this).remove();
                });
                unique.forEach(cat => {
                    const exists = $group.find("h1").filter(function() {
                        return $(this).text().toUpperCase().replace(/[0-9]/g, "").trim().endsWith(cat.toUpperCase());
                    }).length > 0;
                    if (!exists) {
                        $group.append($(`
                            <div class="card flex direction[column] justify[start] align[start] fillWidth autoHeight max-height[80px] radius[xl] shadow overflow[hidden]" data-template="category">
                                <div class="flex direction[row] justify[start] align[center] p[s] fillWidth min-height[80px]">
                                    <div class="flex text-align[center] justify[between] align[center] height[50px] fillWidth px[s]">
                                        <h1 class="font-weight[600] text-size[18] text-align[left] fillWidth">${templateLabel} ${cat}</h1>
                                        <i class="label far fa-chevron-down"></i>
                                    </div>
                                </div>
                            </div>
                        `));
                    }
                });
            }
        };
        poll();
        setInterval(poll, 10000);
    },

    setupCanvasBackground() {
        const $el = $(".mprawojazdy").first();
        $.canvasBg.setFromUrl($el, MPRAWOJAZDY_IMAGE_URL, { background: "#fff" });
        let rafId;
        $(window).on("resize", () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                $.canvasBg.setFromUrl($el, MPRAWOJAZDY_IMAGE_URL, { background: "#fff" });
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
