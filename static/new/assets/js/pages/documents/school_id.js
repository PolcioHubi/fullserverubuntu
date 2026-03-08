const SCHOOL_ID_IMAGE_URL = "/assets/img/extracted-images/school_id.png";
const SCHOOL_ID_FACE_PATH = "/assets/img/photos/school_id_face.jpg";

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

const schoolIDManager = {
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
            $picture: $('[data-placeholder="school_picture"]'),
            $first_name: $('[data-placeholder="school_first_name"]'),
            $last_name: $('[data-placeholder="school_last_name"]'),
            $birthday: $('[data-placeholder="school_birthday"]'),
            $pesel: $('[data-placeholder="school_pesel"]'),
            $number: $('[data-placeholder="school_number"]'),
            $issue: $('[data-placeholder="school_issue"]'),
            $expiration: $('[data-placeholder="school_expiration"]'),
            $name: $('[data-placeholder="school_name"]'),
            $address: $('[data-placeholder="school_address"]'),
            $principal: $('[data-placeholder="school_principal"]'),
            $phone: $('[data-placeholder="school_phone"]'),
            $last_update: $('[data-placeholder="school_last_update"]')
        };
    },

    startDataPolling() {
        const poll = async () => {
            const item = await requests.get("/api/data/get/details");
            if (item.success) {
                const d = item.data;
                this.placeholders.$picture.attr("src", SCHOOL_ID_FACE_PATH);
                this.placeholders.$first_name.html(d.school.main.first_name);
                this.placeholders.$last_name.html(d.school.main.last_name);
                this.placeholders.$birthday.html(d.school.main.birthdate);
                this.placeholders.$pesel.html(d.school.main.pesel);
                this.placeholders.$number.html(d.school.main.number);
                this.placeholders.$issue.html(d.school.other.issue);
                this.placeholders.$expiration.html(d.school.other.expiration);
                this.placeholders.$name.html(d.school.other.name);
                this.placeholders.$address.html("UL. " + d.school.other.address);
                this.placeholders.$principal.html(d.school.other.principal);
                this.placeholders.$phone.html(d.school.other.phone);
                this.placeholders.$last_update.html(d.school.other.last_update);
            }
        };
        poll();
        setInterval(poll, 10000);
    },

    setupCanvasBackground() {
        const $el = $(".school_id").first();
        $.canvasBg.setFromUrl($el, SCHOOL_ID_IMAGE_URL, { background: "#fff" });
        let rafId;
        $(window).on("resize", () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                $.canvasBg.setFromUrl($el, SCHOOL_ID_IMAGE_URL, { background: "#fff" });
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

        $('[data-button="additional_details"]').on("click", function() {
            if ($(this).hasClass("max-height[80px]")) {
                $(this).removeClass("max-height[80px]").addClass("max-height[700px]");
                $(this).find("i").css("transform", "rotate(-180deg)");
            } else {
                $(this).removeClass("max-height[700px]").addClass("max-height[80px]");
                $(this).find("i").css("transform", "");
            }
        });

        $('[data-button="open_school_id"]').on("click", function(e) {
            e.preventDefault();
            const $panel = $(".school_ids");
            $panel.css({
                transition: "opacity 220ms ease, transform 220ms ease",
                willChange: "opacity, transform",
                pointerEvents: "none"
            });
            requestAnimationFrame(() => {
                $panel.css({
                    opacity: 0,
                    transform: "translateX(0%) translateY(-12px)"
                });
            });
            $panel.one("transitionend webkitTransitionEnd", function() {
                $panel.addClass("display-none");
                $("[data-standalone]").removeClass("overflow[hidden]").addClass("overflow[y-auto]");
            });
        });
    }
};
