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
        const $body = $("body");
        const $addDocumentButton = $(".add-document-list-footer button");
        const $addDocumentPanel = $(".add_document_list");
        const $customizePanel = $(".customize_document_list");
        const $customizeOrderPanel = $(".customize_document_order_list");
        const layoutStorageKey = "documents_layout_mode";
        const closeAddDocumentPanel = () => {
            $addDocumentPanel.css("transform", "translateX(100%)");
            self.$wrapper.removeClass("scale[0.9]");
            $body.removeClass("add-document-list-open");
        };
        const closeCustomizePanel = () => {
            $customizePanel.css("transform", "translateX(100%)");
            $customizeOrderPanel.css("transform", "translateX(100%)");
            $body.removeClass("customize-document-open");
        };
        const preloadCustomizeLayoutIcons = () => {
            const seen = new Set();

            $('[data-layout-option]').each(function () {
                const activeSrc = $(this).data("layout-active-src");
                const inactiveSrc = $(this).data("layout-inactive-src");

                [activeSrc, inactiveSrc].forEach((src) => {
                    if (!src || seen.has(src)) return;
                    seen.add(src);
                    const image = new Image();
                    image.src = src;
                });
            });
        };
        const updateAddDocumentButtonState = () => {
            const hasSelection = $('.add_document_list input[type="checkbox"]:checked').length > 0;
            $addDocumentButton.prop("disabled", !hasSelection);
        };
        const getSavedLayout = () => {
            const savedLayout = localStorage.getItem(layoutStorageKey);
            return ["overlap", "grid", "list"].includes(savedLayout) ? savedLayout : "overlap";
        };
        const updateCustomizeLayoutState = (layout) => {
            $('[data-layout-option]').each(function () {
                const $option = $(this);
                const isActive = $option.data("layout-option") === layout;
                const nextIcon = isActive ? $option.data("layout-active-src") : $option.data("layout-inactive-src");

                $option.toggleClass("is-active", isActive);
                $option.attr("aria-pressed", isActive ? "true" : "false");
                $option.find("[data-layout-icon]").attr("src", nextIcon);
            });

            localStorage.setItem(layoutStorageKey, layout);
            if (window._updateDocumentCards) window._updateDocumentCards();
        };

        updateAddDocumentButtonState();
        preloadCustomizeLayoutIcons();
        updateCustomizeLayoutState(getSavedLayout());

        // Otwórz panel "Dostosuj"
        $('[data-button="documents"]').on("click", () => {
            closeAddDocumentPanel();

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

            updateCustomizeLayoutState(getSavedLayout());
            $body.addClass("customize-document-open");
            $customizePanel.css("transform", "translateX(0)");
            $customizeOrderPanel.css("transform", "translateX(100%)");
        });

        // Zamknij panel "Dostosuj"
        $('[data-button="customize_back"]').on("click", () => {
            closeCustomizePanel();
        });

        $('[data-button="customize_order_view"]').on("click", () => {
            $customizeOrderPanel.css("transform", "translateX(0)");
        });

        $('[data-button="customize_order_back"]').on("click", () => {
            $customizeOrderPanel.css("transform", "translateX(100%)");
        });

        $('[data-layout-option]').on("click", function () {
            updateCustomizeLayoutState($(this).data("layout-option"));
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
            closeCustomizePanel();
            self.$wrapper.addClass("scale[0.9]");
            $body.addClass("add-document-list-open");
            $addDocumentPanel.css("transform", "translateX(0)");
            updateAddDocumentButtonState();
        });

        // Zamknij panel
        $('[data-button="add_document_list_back"]').on("click", () => {
            closeAddDocumentPanel();
        });

        $('.add_document_list input[type="checkbox"]').on("change", updateAddDocumentButtonState);

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
