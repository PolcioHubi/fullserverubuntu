const servicesManager = {
    init() {
        this.listeners();
    },

    listeners() {
        // === Search / filter services ===
        $('input[type="text"]').on('input', function () {
            const query = $(this).val().toLowerCase().trim();

            if (query.length >= 3) {
                $('.navigation').addClass('fixed fillWidth').removeClass('sticky');

                $('.card').each(function () {
                    const $card = $(this);
                    const $buttons = $card.find('[data-button="service"]');
                    let visibleCount = 0;

                    $buttons.each(function () {
                        const $btn = $(this);
                        const title = $btn.find('h1').text().toLowerCase().trim();
                        const queryWords = query.split(' ');
                        const titleWords = title.split(' ');
                        const matches = queryWords.every(qw => titleWords.some(tw => tw.includes(qw)));

                        $btn.toggle(matches);
                        $btn.next('.separator\\[x\\]').toggle(matches);
                        if (matches) visibleCount++;
                    });

                    if (visibleCount > 1) {
                        $card.find('.separator\\[x\\]').show();
                    } else {
                        $card.find('.separator\\[x\\]').hide();
                    }
                    $card.toggle(visibleCount > 0);
                });

                $('[data-title]').each(function () {
                    const $el = $(this);
                    const group = $el.data('title');
                    const hasVisible = $(`.card[data-group="${group}"]:visible`).length > 0;
                    $el.toggle(hasVisible);
                });
            } else {
                $('.navigation').removeClass('fixed fillWidth').addClass('sticky');
                $('.card').each(function () {
                    $(this).show();
                    $(this).find('[data-button="service"]').show();
                    $(this).find('.separator\\[x\\]').show();
                });
                $('[data-title]').show();
            }
        });

        // === Collapsible navigation header (large → small title on scroll) ===
        const $standalone = $('[data-standalone]');
        const $nav = $('.dashboard-navigation');
        const $largeTitle = $('.dashboard-navigation-large-title');
        const $smallTitle = $('.dashboard-navigation-small-title');

        const COLLAPSE_THRESHOLD = 0.7;
        const EXPAND_THRESHOLD = 0.35;
        const ANIM_DURATION = 160;
        const SNAP_DELAY = 90;
        const SNAP_TOLERANCE_FACTOR = 0.1;

        let isCollapsed = false;
        let isAnimating = false;
        let snapTimer = null;

        function clamp(val, min, max) {
            return Math.max(min, Math.min(max, val));
        }

        function getLargeTitleTop() {
            const scrollTop = $standalone.scrollTop();
            const containerRect = $standalone[0].getBoundingClientRect();
            const titleRect = $largeTitle[0].getBoundingClientRect();
            return (titleRect.top - containerRect.top) + scrollTop;
        }

        function getScrollMetrics() {
            const scrollTop = $standalone.scrollTop();
            const navHeight = $nav.outerHeight();
            const largeTitleTop = getLargeTitleTop();
            const largeTitleHeight = Math.max(1, $largeTitle.outerHeight());
            const overlap = (scrollTop + navHeight) - largeTitleTop;
            const progress = clamp(overlap / largeTitleHeight, 0, 1);
            const expandedPos = Math.max(0, largeTitleTop - navHeight);
            const collapsedPos = Math.max(0, (largeTitleTop + largeTitleHeight) - navHeight);

            return { scrollTop, navHeight, largeTitleTop, largeTitleHeight, progress, expandedPos, collapsedPos };
        }

        function applyProgress(progress) {
            $largeTitle.css({
                opacity: 1 - progress,
                transform: `translateY(${-8 * progress}px) scale(${1 - 0.02 * progress})`
            });
            $smallTitle.toggleClass('is-visible', progress > 0.55);
            $nav.toggleClass('background[backdrop] scrolled', progress > 0.55);
        }

        function collapse() {
            isCollapsed = true;
            applyProgress(1);
        }

        function expand() {
            isCollapsed = false;
            applyProgress(0);
        }

        function scrollTo(target, callback) {
            isAnimating = true;
            $standalone.stop().animate({ scrollTop: target }, ANIM_DURATION, function () {
                isAnimating = false;
                if (callback) callback();
            });
        }

        $standalone.on('scroll', function () {
            if (isAnimating) return;

            const m = getScrollMetrics();
            applyProgress(m.progress);

            clearTimeout(snapTimer);
            snapTimer = setTimeout(function () {
                if (isAnimating) return;

                const m2 = getScrollMetrics();
                const snapTolerance = $largeTitle.outerHeight() * SNAP_TOLERANCE_FACTOR;
                const nearCollapsed = Math.abs(m2.scrollTop - m2.collapsedPos) <= snapTolerance;
                const nearExpanded = Math.abs(m2.scrollTop - m2.expandedPos) <= snapTolerance;

                if (!isCollapsed && m2.progress >= COLLAPSE_THRESHOLD) {
                    if (nearCollapsed) {
                        scrollTo(m2.collapsedPos, collapse);
                    } else {
                        collapse();
                    }
                    return;
                }

                if (isCollapsed && m2.progress <= EXPAND_THRESHOLD) {
                    if (nearExpanded) {
                        scrollTo(m2.expandedPos, expand);
                    } else {
                        expand();
                    }
                }
            }, SNAP_DELAY);
        });
    }
};
