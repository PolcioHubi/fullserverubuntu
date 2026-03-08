const documentsManager = {
    init() {
        this.setupLayout();
        this.listeners();
    },

    setupLayout() {
        this.$standalone = $("[data-standalone]");
        this.$wrapper = $("[data-wrapper]");
        this.$standalone.removeClass("overflow[hidden]").addClass("overflow[hidden] fixed");

        if ($(window).height() < 680) {
            this.$standalone.removeClass("overflow[hidden]").addClass("overflow[x-hidden]");
            $(".navigation").removeClass("sticky").addClass("fixed fillWidth");
        }
    },

    listeners() {
        const self = this;

        // Otwórz panel "Dostosuj"
        $('[data-button="documents"]').on("click", () => {
            // Odczytaj aktualny stan z localStorage
            let saved = {};
            try { saved = JSON.parse(localStorage.getItem('doc_visibility') || '{}'); } catch(e) {}
            const avail = window._docAvailability || {};
            $('[data-doc-toggle]').each(function () {
                const key = $(this).data('doc-toggle');
                const hasFile = Number(avail[key]) === 1;
                const isOn = hasFile ? (saved[key] !== undefined ? Number(saved[key]) === 1 : true) : false;
                $(this).prop('checked', isOn);
                $(this).prop('disabled', !hasFile);
            });

            self.$wrapper.addClass("scale[0.9]");
            self.$standalone
                .addClass("overflow[x-hidden] overflow[y-auto]")
                .removeClass("overflow[hidden]");
            $('[data-group="navigation"]').addClass("display-none");
            $(".customize_document_list").css("transform", "");
        });

        // Zamknij panel "Dostosuj"
        $('[data-button="customize_back"]').on("click", () => {
            $(".customize_document_list").css("transform", "translateX(100%)");
            self.$wrapper.removeClass("scale[0.9]");
            self.$standalone
                .removeClass("overflow[x-hidden] overflow[y-auto]")
                .addClass("overflow[hidden]");
            $('[data-group="navigation"]').removeClass("display-none");
        });

        // Toggle zmienia widoczność dokumentu
        $('[data-doc-toggle]').on('change', function () {
            const key = $(this).data('doc-toggle');
            const val = $(this).is(':checked') ? 1 : 0;
            let saved = {};
            try { saved = JSON.parse(localStorage.getItem('doc_visibility') || '{}'); } catch(e) {}
            saved[key] = val;
            localStorage.setItem('doc_visibility', JSON.stringify(saved));
            // Natychmiast aktualizuj karty
            if (window._updateDocumentCards) window._updateDocumentCards();
        });

        // Otwórz panel "Dodaj dokument"
        $('[data-button="add_document_list"]').on("click", () => {
            self.$wrapper.addClass("scale[0.9]");
            self.$standalone
                .addClass("overflow[x-hidden] overflow[y-auto]")
                .removeClass("overflow[hidden]");
            $('[data-group="navigation"]').addClass("display-none");
            $(".add_document_list").css("transform", "");
        });

        // Zamknij panel
        $('[data-button="add_document_list_back"]').on("click", () => {
            $(".add_document_list").css("transform", "translateX(100%)");
            self.$wrapper.removeClass("scale[0.9]");
            self.$standalone
                .removeClass("overflow[x-hidden] overflow[y-auto]")
                .addClass("overflow[hidden]");
            $('[data-group="navigation"]').removeClass("display-none");
        });

        // Wyszukiwarka dokumentów
        $('.add_document_list input[type="text"]').on("input", function () {
            const query = $(this).val().toLowerCase().trim();

            if (query.length >= 3) {
                $(".add_document_list .card").each(function () {
                    const $card = $(this);
                    let matchCount = 0;

                    $card.children("div").not(".separator\\[x\\]").each(function () {
                        const $row = $(this);
                        const title = $row.find("h1").text().toLowerCase().trim();
                        const queryWords = query.split(/\s+/);
                        const titleWords = title.split(/\s+/);

                        const isMatch = queryWords.every(qw =>
                            titleWords.some(tw => tw.includes(qw))
                        );

                        $row.toggle(isMatch);
                        $row.next(".separator\\[x\\]").toggle(isMatch);
                        if (isMatch) matchCount++;
                    });

                    $card.toggle(matchCount > 0);
                });
            } else {
                $(".add_document_list .card").show().find("> div").show();
                $(".add_document_list .card").find(".separator\\[x\\]").show();
            }
        });
    }
};
