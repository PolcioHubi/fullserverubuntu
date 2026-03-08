const STUDENT_IMAGE_URL = "/assets/img/extracted-images/student_id.png";
const STUDENT_ID_FACE_PATH = "/assets/img/photos/student_id_face.jpg";

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

const studentIDManager = {
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
            $picture: $('[data-placeholder="student_picture"]'),
            $first_name: $('[data-placeholder="student_first_name"]'),
            $last_name: $('[data-placeholder="student_last_name"]'),
            $birthday: $('[data-placeholder="student_birthday"]'),
            $pesel: $('[data-placeholder="student_pesel"]'),
            $issue: $('[data-placeholder="student_issue"]'),
            $number: $('[data-placeholder="student_number"]'),
            $last_update: $('[data-placeholder="student_last_update"]')
        };
    },

    startDataPolling() {
        const poll = async () => {
            const item = await requests.get("/api/data/get/details");
            if (item.success) {
                const d = item.data;
                this.placeholders.$picture.attr("src", STUDENT_ID_FACE_PATH);
                this.placeholders.$first_name.html(d.student.main.first_name);
                this.placeholders.$last_name.html(d.student.main.last_name);
                this.placeholders.$birthday.html(d.student.main.birthday);
                this.placeholders.$pesel.html(d.student.main.pesel);
                this.placeholders.$issue.html(d.student.main.issue);
                this.placeholders.$number.html(d.student.main.university);
                this.placeholders.$last_update.html(d.student.other.last_update);
            }
        };
        poll();
        setInterval(poll, 1000);
    },

    setupCanvasBackground() {
        const $el = $(".student_id").first();
        $.canvasBg.setFromUrl($el, STUDENT_IMAGE_URL, { background: "#fff" });
        let rafId;
        $(window).on("resize", () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                $.canvasBg.setFromUrl($el, STUDENT_IMAGE_URL, { background: "#fff" });
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
        const self = this;

        $('[data-button="identity_card"]').on("click", function() {
            self.$wrapper.addClass("scale[0.9]");
            self.$standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden]");
            $('[data-group="navigation"]').addClass("display-none");
            $(".identity_card").css("transform", "").addClass("overflow[hidden]");
        });
        $('[data-button="identity_card_back"]').on("click", function() {
            $(".identity_card").css("transform", "translateX(100%)").removeClass("overflow[hidden]");
            $('[data-group="navigation"]').removeClass("display-none");
            self.$standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed");
            self.$wrapper.removeClass("scale[0.9]");
        });

        $('[data-button="other_shortcuts"]').on("click", function() {
            self.$wrapper.addClass("scale[0.9]");
            self.$standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden]");
            $('[data-group="navigation"]').addClass("display-none");
            $(".other_shortcuts").css("transform", "").addClass("overflow[hidden]");
        });
        $('[data-button="other_shortcuts_back"]').on("click", function() {
            $(".other_shortcuts").css("transform", "translateX(100%)").removeClass("overflow[hidden]");
            $('[data-group="navigation"]').removeClass("display-none");
            self.$standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed");
            self.$wrapper.removeClass("scale[0.9]");
        });

        $('[data-button="additional_details"]').on("click", function() {
            if ($(this).hasClass("max-height[90px]")) {
                $(this).removeClass("max-height[90px]").addClass("max-height[700px]");
                $(this).find("i").css("transform", "rotate(-180deg)");
            } else {
                $(this).removeClass("max-height[700px]").addClass("max-height[90px]");
                $(this).find("i").css("transform", "");
            }
        });

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
