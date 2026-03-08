const indexManager = {
    init() {
        this.$standalone = $("[data-standalone]");
        this.$wrapper = $("[data-wrapper]");
        this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden] overflow[x-hidden]");

        this.setupInstallPrompt();
    },

    setupInstallPrompt() {
        const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches
            || (isIOS && window.navigator.standalone);

        if (isStandalone) return;

        const $iosOverlay = $('[data-div="ios_overlay"]');
        const $androidOverlay = $('[data-div="android_overlay"]');

        if (isIOS) {
            // iOS: pokaż overlay z instrukcją "Dodaj do ekranu głównego"
            $androidOverlay.addClass("hide");
            setTimeout(() => $androidOverlay.addClass("display-none"), 300);
            $iosOverlay.removeClass("display-none");
            setTimeout(() => $iosOverlay.removeClass("hide"), 50);
        } else {
            // Android: pokaż overlay + przechwytuj beforeinstallprompt
            $androidOverlay.removeClass("display-none");
            setTimeout(() => $androidOverlay.removeClass("hide"), 50);
            $iosOverlay.addClass("hide");
            setTimeout(() => $iosOverlay.addClass("display-none"), 300);

            let installEvent = null;
            let clickCount = 0;

            $(window).on("beforeinstallprompt", function (e) {
                e.originalEvent.preventDefault();
                installEvent = e.originalEvent;
            });

            $(document).on("click", '[data-button="android_install"]', async function () {
                clickCount++;
                if (clickCount >= 2) {
                    $("[data-hints]").removeClass("hide");
                }
                if (installEvent) {
                    installEvent.prompt();
                    await installEvent.userChoice;
                    installEvent = null;
                }
            });
        }
    }
};
