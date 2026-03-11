const MDOWOD_IMAGE_URL = "/assets/img/extracted-images/mdowod.png";
const MDOWOD_FACE_PATH = "/assets/img/photos/mdowod_face.jpg";
const MDOWOD_ISSUER_FALLBACK = "PREZYDENT M.ST. WARSZAWY";

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

const mdowodManager = {
    init() {
        this.setupLayout();
        this.setupPlaceholders();
        this.startDataPolling();
        this.setupCanvasBackground();
        this.setupTimeDisplay();
        this.setupHelpers();
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
            $picture: $('[data-placeholder="mdowod_picture"]'),
            $first_name: $('[data-placeholder="mdowod_first_name"]'),
            $last_name: $('[data-placeholder="mdowod_last_name"]'),
            $birthday: $('[data-placeholder="mdowod_birthday"]'),
            $pesel: $('[data-placeholder="mdowod_pesel"]'),
            $id_series: $('[data-placeholder="personal_id_series"]'),
            $id_issuer: $('[data-placeholder="personal_id_issuer"]'),
            $id_expiration: $('[data-placeholder="personal_id_expiration"]'),
            $id_issue: $('[data-placeholder="personal_id_issue"]'),
            $mdowod_series: $('[data-placeholder="mdowod_series"]'),
            $mdowod_expiration: $('[data-placeholder="mdowod_expiration"]'),
            $mdowod_issue: $('[data-placeholder="mdowod_issue"]'),
            $fathers_name: $('[data-placeholder="mdowod_fathers_name"]'),
            $mothers_name: $('[data-placeholder="mdowod_mothers_name"]'),
            $family_name: $('[data-placeholder="mdowod_family_name"]'),
            $fathers_family: $('[data-placeholder="mdowod_fathers_family"]'),
            $mothers_family: $('[data-placeholder="mdowod_mothers_family"]'),
            $place_of_birth: $('[data-placeholder="mdowod_place_of_birth"]'),
            $residence: $('[data-placeholder="mdowod_residence"]'),
            $residence_date: $('[data-placeholder="mdowod_residence_date"]'),
            $last_update: $('[data-placeholder="mdowod_last_update"]')
        };
    },

    startDataPolling() {
        const poll = async () => {
            const item = await requests.get("/api/data/get/details");
            if (item.success) {
                const d = item.data;
                const issuer = typeof d.mdowod?.personal?.issuer === "string" && d.mdowod.personal.issuer.trim()
                    ? d.mdowod.personal.issuer
                    : MDOWOD_ISSUER_FALLBACK;
                this.placeholders.$first_name.html(d.mdowod.main.first_name);
                this.placeholders.$last_name.html(d.mdowod.main.last_name);
                this.placeholders.$birthday.html(d.mdowod.main.birthday);
                this.placeholders.$pesel.html(d.mdowod.main.pesel);
                this.placeholders.$picture.attr("src", MDOWOD_FACE_PATH);
                this.placeholders.$id_series.html(d.mdowod.personal.series);
                this.placeholders.$id_issuer.html(issuer);
                this.placeholders.$id_expiration.html(d.mdowod.personal.expiration);
                this.placeholders.$id_issue.html(d.mdowod.personal.issue);
                this.placeholders.$mdowod_series.html(d.mdowod.other.series);
                this.placeholders.$mdowod_expiration.html(d.mdowod.other.expiration);
                this.placeholders.$mdowod_issue.html(d.mdowod.other.issue);
                this.placeholders.$fathers_name.html(d.mdowod.other.fathers_name);
                this.placeholders.$mothers_name.html(d.mdowod.other.mothers_name);
                this.placeholders.$family_name.html(d.mdowod.additional.family_name);
                this.placeholders.$fathers_family.html(d.mdowod.additional.fathers_family);
                this.placeholders.$mothers_family.html(d.mdowod.additional.mothers_family);
                this.placeholders.$place_of_birth.html(d.mdowod.additional.place_of_birth);
                this.placeholders.$residence.html("UL. " + d.mdowod.additional.residence);
                this.placeholders.$residence_date.html(d.mdowod.additional.residence_date);
                this.placeholders.$last_update.html(d.mdowod.personal.last_update);
            }
        };
        poll();
        setInterval(poll, 10000);
    },

    setupCanvasBackground() {
        const $el = $(".mdowod").first();
        $.canvasBg.setFromUrl($el, MDOWOD_IMAGE_URL, { background: "#fff" });
        let rafId;
        $(window).on("resize", () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                $.canvasBg.setFromUrl($el, MDOWOD_IMAGE_URL, { background: "#fff" });
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

    setupHelpers() {
        this.setTabOpen = function(tab) {
            const url = new URL(window.location.href);
            url.searchParams.set("tabOpen", tab);
            window.history.replaceState({}, "", url.toString());
        };
        this.removeTabOpen = function() {
            const url = new URL(window.location.href);
            url.searchParams.delete("tabOpen");
            window.history.replaceState({}, "", url.toString());
        };
    },

    listeners() {
        const self = this;

        $('[data-button="identity_card"]').on("click", function() {
            self.setTabOpen("identity_card");
            self.$wrapper.addClass("scale[0.9]");
            self.$standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden] overflow[x-hidden]");
            $(".identity_card").css("transform", "").addClass("overflow[hidden]");
        });
        $('[data-button="identity_card_back"]').on("click", function() {
            self.removeTabOpen();
            $(".identity_card").css("transform", "translateX(100%)").removeClass("overflow[hidden]");
            self.$standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed");
            self.$wrapper.removeClass("scale[0.9]");
        });

        $('[data-button="restrict_pesel"]').on("click", function() {
            self.setTabOpen("restrict_pesel");
            self.$wrapper.addClass("scale[0.9]");
            self.$standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden] overflow[x-hidden]");
            $(".restrict_pesel").css("transform", "").addClass("overflow[hidden]");
        });
        $('[data-button="restrict_pesel_back"]').on("click", function() {
            self.removeTabOpen();
            $(".restrict_pesel").css("transform", "translateX(100%)").removeClass("overflow[hidden]");
            self.$standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed");
            self.$wrapper.removeClass("scale[0.9]");
        });

        $('[data-button="other_shortcuts"]').on("click", function() {
            self.setTabOpen("other_shortcuts");
            self.$wrapper.addClass("scale[0.9]");
            self.$standalone.removeClass("overflow[x-hidden] overflow[y-auto] fixed").addClass("overflow[hidden] overflow[x-hidden]");
            $(".other_shortcuts").css("transform", "").addClass("overflow[hidden]");
        });
        $('[data-button="other_shortcuts_back"]').on("click", function() {
            self.removeTabOpen();
            $(".other_shortcuts").css("transform", "translateX(100%)").removeClass("overflow[hidden] overflow[x-hidden]");
            self.$standalone.addClass("overflow[x-hidden] overflow[y-auto] fixed");
            self.$wrapper.removeClass("scale[0.9]");
        });

        $('[data-button="additional_details"]').on("click", function() {
            if ($(this).hasClass("max-height[80px]")) {
                $(this).removeClass("max-height[80px]").addClass("max-height[720px]");
                $(this).find("i").css("transform", "rotate(-180deg)");
            } else {
                $(this).removeClass("max-height[720px]").addClass("max-height[80px]");
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
