const requests = {
    request(url, method = 'GET', data = {}, params = {}) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: url,
                method: method,
                data: method === 'GET' ? params : data,
                dataType: 'json',
                cache: true,
                success: (response) => {
                    resolve(response);
                },
                error: (xhr) => {
                    console.error(`${method} request failed:`, xhr.statusText);
                    reject(new Error(xhr.statusText));
                },
            });
        });
    },

    get(url, params = {}) {
        return this.request(url, 'GET', {}, params);
    },

    post(url, data = {}) {
        return this.request(url, 'POST', data);
    },
};

$(async function() {
    // Service Worker registration is handled by worker-starter.js
    const currentUrl = new URL(window.location.href);
    const path = currentUrl.pathname
        .replace(/^\/+|\/+$/g, '')
        .toLowerCase()
        .split('/')
        .pop();

    $('[data-route]').on('click', function() {
        navigateTo($(this).data('route'));
    });

    $('[data-redirect]').on('click', function (e) {
        const $el = $(this);
        const target = '/' + String($el.data('redirect') || '').replace(/^\/+/, '');
        if ($el.is('[data-document-card]')) {
            e.preventDefault();
            if ($el.data('busy')) return;
            $el.data('busy', true);
            const lift = parseInt($el.attr('data-lift'), 10) || 20;
            $el.css('transition', 'top 300ms ease');
            setTimeout(() => {
                const cls = $el.attr('class') || '';
                const m = cls.match(/top\[(\d+)px\]/);
                if (m) {
                    const cur = parseInt(m[1], 10);
                    const next = Math.max(0, cur - lift);
                    const updated = cls.replace(/top\[\d+px\]/, `top[${next}px]`);
                    $el.attr('class', updated);
                } else {
                    const curTop = parseInt($el.css('top')) || 0;
                    $el.css('top', (curTop - lift) + 'px');
                }
            }, 60);
            setTimeout(() => {
                navigateTo(target);
            }, 200);
        } else {
            navigateTo(target);
        }
    });

    $('[data-button="copy_mdowod_series"]').on('click', async function() {
        let text = $(this).data('notification');
        $('[data-p="notification-text"]').text(text);
        $('.notification-group').removeClass('display-none');
        if ($('.notification-group').data('busy')) return;
        $('.notification-group').data('busy', true);
        setTimeout(() => {
            $('.notification').toggleClass('hide show');
            setTimeout(() => {
                $('.notification').toggleClass('hide show');
                setTimeout(() => {
                    $('.notification-group').addClass('display-none');
                    $('.notification-group').data('busy', false);
                }, 500);
            }, 3000);
        }, 50);
    });

    $('[data-button="copy_id_card_series"]').on('click', async function() {
        let text = $(this).data('notification');
        $('[data-p="notification-text"]').text(text);
        $('.notification-group').removeClass('display-none');
        if ($('.notification-group').data('busy')) return;
        $('.notification-group').data('busy', true);
        setTimeout(() => {
            $('.notification').toggleClass('hide show');
            setTimeout(() => {
                $('.notification').toggleClass('hide show');
                setTimeout(() => {
                    $('.notification-group').addClass('display-none');
                    $('.notification-group').data('busy', false);
                }, 500);
            }, 3000);
        }, 50);
    });

    $('[data-button="last_update_popup"]').on('click', async function() {
        let text = $('[data-p="notification-text"]').data('default');
        $('[data-p="notification-text"]').text(text);
        $('.notification-group').removeClass('display-none');
        if ($('.notification-group').data('busy')) return;
        $('.notification-group').data('busy', true);
        setTimeout(() => {
            $('.notification').toggleClass('hide show');
            setTimeout(() => {
                $('.notification').toggleClass('hide show');
                setTimeout(() => {
                    $('.notification-group').addClass('display-none');
                    $('.notification-group').data('busy', false);
                }, 500);
            }, 3000);
        }, 50);
    })

    $('[data-button="hide_popup"').on('click', async function() {
        if(!document.cookie.match(/hide-popup=true/))document.cookie="hide-popup=true;max-age=315360000;path=/";
        $('[data-button="hide_popup"]').parent().addClass('display-none');
    });
    
    $('[data-button="logout"]').on('click', async function() {
        const response = await requests.post('/api/authorization/logout');
        if (response.success) {
            navigateTo('/login');
        }
    });

    switch (path) {
        case '':
            indexManager.init();
            break;
        case 'login':
            loginManager.init();
            break;
        case 'qr_code':
            qrCodeManager.init();
            break;
        case 'services':
            servicesManager.init();
            break;
        case 'documents':
            documentsManager.init();
            break;
        case 'mdowod':
            mdowodManager.init();
            break;
        case 'mprawojazdy':
            mprawojazdyManager.init();
            break;
        case 'wozek':
            wozekManager.init();
            break;
        case 'school_id':
            schoolIDManager.init();
            break;
        case 'student_id':
            studentIDManager.init();
            break;
        case 'more':
            moreManager.init();
            break;
        default:
            break;
    }

    let document_interval;
    if (path === 'documents') {
        const DOCUMENT_KEYS = ['mdowod', 'mprawojazdy', 'wozek', 'school_id', 'student_id'];
        const DOC_AVAILABILITY_CACHE_KEY = 'doc_availability_cache';
        const $documentsLayoutRoot = $('[data-documents-layout-root]');
        const getDocumentsLayoutMode = () => {
            const savedLayout = localStorage.getItem('documents_layout_mode');
            return ['overlap', 'grid', 'list'].includes(savedLayout) ? savedLayout : 'overlap';
        };
        const readStoredJson = (key, fallback = {}) => {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
            } catch (e) {
                return fallback;
            }
        };
        const revealDocumentsLayout = () => {
            $documentsLayoutRoot.attr('data-documents-ready', '1');
        };
        const hasRenderableDocumentState = (data) => (
            !!data &&
            typeof data === 'object' &&
            DOCUMENT_KEYS.some((key) => Object.prototype.hasOwnProperty.call(data, key))
        );
        const readAvailabilityCache = () => {
            const cached = readStoredJson(DOC_AVAILABILITY_CACHE_KEY, null);
            if (!cached || typeof cached !== 'object') return null;
            if (cached.documents && typeof cached.documents === 'object') return cached.documents;
            return cached;
        };
        const persistAvailabilityCache = (documents) => {
            try {
                localStorage.setItem(DOC_AVAILABILITY_CACHE_KEY, JSON.stringify({
                    savedAt: Date.now(),
                    documents
                }));
            } catch (e) {
                // ignore localStorage quota/availability issues
            }
        };

        function updateDocumentCards(apiData) {
            const data = apiData || {};
            let saved = {};
            try { saved = JSON.parse(localStorage.getItem('doc_visibility') || '{}'); } catch(e) {}
            const activeLayout = getDocumentsLayoutMode();
            let visibleIndex = 0;
            const offset = 70;
            const order = DOCUMENT_KEYS;

            $('[data-layout-view]').addClass('display-none');
            $(`[data-layout-view="${activeLayout}"]`).removeClass('display-none');

            order.forEach((key) => {
                const hasFile = Number(data[key]) === 1;
                const enabled = hasFile && (saved[key] !== undefined ? Number(saved[key]) === 1 : true);
                const $overlapCard = $(`[data-layout-card="overlap"][data-document-key="${key}"]`);
                const $gridCard = $(`[data-layout-card="grid"][data-document-key="${key}"]`);
                const $listCard = $(`[data-layout-card="list"][data-document-key="${key}"]`);
                const $separator = $(`[data-document-separator="${key}"]`);
                const $addButton = $(`[data-document-add="${key}"]`);
                $overlapCard.removeClass(function(index, className) {
                    return (className.match(/top\[\d+px\]/g) || []).join(' ');
                });
                if (enabled) {
                    const newTopClass = `top[${visibleIndex * offset}px]`;
                    $overlapCard.removeClass('display-none').addClass(newTopClass);
                    $gridCard.removeClass('display-none');
                    $listCard.removeClass('display-none');
                    $separator.addClass('display-none');
                    $addButton.addClass('display-none');
                    visibleIndex++;
                } else {
                    $overlapCard.addClass('display-none');
                    $gridCard.addClass('display-none');
                    $listCard.addClass('display-none');
                    $separator.removeClass('display-none');
                    $addButton.removeClass('display-none');
                }
            });

            const $visibleListCards = $('[data-layout-card="list"]').not('.display-none');
            $visibleListCards.removeClass('document-list-row-last-visible document-list-row-divider-strong');
            $visibleListCards.last().addClass('document-list-row-last-visible');
            $visibleListCards.each(function(index) {
                const isStrongDivider = index === 0 || index === ($visibleListCards.length - 2);
                if (isStrongDivider) $(this).addClass('document-list-row-divider-strong');
            });

            const overlapHeight = visibleIndex > 0 ? (235 + ((visibleIndex - 1) * offset)) : 0;
            $('[data-layout-view="overlap"]').css('min-height', overlapHeight ? `${overlapHeight}px` : '0');
            revealDocumentsLayout();
        }

        const cachedDocuments = readAvailabilityCache();
        if (hasRenderableDocumentState(cachedDocuments)) {
            window._lastDocData = cachedDocuments;
            window._docAvailability = cachedDocuments;
            updateDocumentCards(cachedDocuments);
        }

        // Expose for instant toggle updates from documents.js
        window._updateDocumentCards = () => updateDocumentCards(window._lastDocData || cachedDocuments || {});

        const pollDocs = async () => {
            try {
                const response = await requests.get('/api/user-documents', { _ts: Date.now() });
                if (response.success) {
                    const documents = response.data.documents || {};
                    window._lastDocData = documents;
                    updateDocumentCards(documents);
                    persistAvailabilityCache(documents);

                    // Expose availability for Dostosuj panel (disabled toggles)
                    window._docAvailability = documents;
                }
            } catch (err) {
                if ($documentsLayoutRoot.attr('data-documents-ready') !== '1') {
                    updateDocumentCards({});
                }
                clearInterval(document_interval);
            }
        };
        pollDocs();
        document_interval = setInterval(pollDocs, 10000);

        // One-time document hash check for PWA cache invalidation
        (async () => {
            try {
                const hashResp = await requests.get('/api/document-hashes');
                if (!hashResp.success) return;
                const newHashes = hashResp.data;
                let oldHashes = {};
                try { oldHashes = JSON.parse(localStorage.getItem('doc_hashes') || '{}'); } catch(e) {}
                const changedUrls = [];
                const docUrlMap = {
                    mdowod: '/user_files/dowodnowy_new.html',
                    mprawojazdy: '/user_files/prawojazdy_new.html',
                    wozek: '/user_files/wozek_new.html',
                    school_id: '/user_files/school_id_new.html',
                    student_id: '/user_files/student_id_new.html'
                };
                for (const [key, hash] of Object.entries(newHashes)) {
                    if (hash && oldHashes[key] !== hash) {
                        if (docUrlMap[key]) changedUrls.push(docUrlMap[key]);
                    }
                }
                if (changedUrls.length > 0 && navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'INVALIDATE',
                        urls: changedUrls
                    });
                }
                localStorage.setItem('doc_hashes', JSON.stringify(newHashes));
            } catch(e) { /* silent */ }
        })();
    }

    if (path !== '' && path !== 'login') {
        const subscription_interval = setInterval(async () => {
            try {
                const subscription = await requests.get('/api/data/get/subscription');
                if (!subscription.success) {
                    clearInterval(subscription_interval);
                    if (document_interval) clearInterval(document_interval);
                    navigateTo('/login');
                }
            } catch (err) {
                clearInterval(subscription_interval);
            }
        }, 30000);
    }

    if (/(mdowod|dowodnowy|mprawojazdy|prawojazdy|wozek|school_id|student_id|qr_code)/.test(path)) {
        const emblemEntries = Array.from(document.querySelectorAll('.emblem[data-emblem]'))
            .map((wrap) => {
                const scope = wrap.querySelector('[id="emblem"]') || wrap.querySelector('.emblem\\[card\\]');
                if (!scope) return null;

                const style = getComputedStyle(scope);
                const base = {
                    tx: parseFloat(style.getPropertyValue('--em-tx')) || 0,
                    ty: parseFloat(style.getPropertyValue('--em-ty')) || 34,
                    ang: parseFloat(style.getPropertyValue('--em-ang')) || 0,
                    alpha: parseFloat(style.getPropertyValue('--em-alpha')) || 0.12
                };

                return {
                    wrap,
                    scope,
                    gif: wrap.querySelector('img'),
                    base,
                    last: { ...base }
                };
            })
            .filter(Boolean);

        if (emblemEntries.length) {
            const isAppleMobile =
                /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
                (navigator.vendor?.includes('Apple') && navigator.maxTouchPoints > 1);

            function setVars(entry, tx, ty, ang, alpha) {
                entry.scope.style.setProperty('--em-tx', tx.toFixed(2) + '%');
                entry.scope.style.setProperty('--em-ty', ty.toFixed(2) + '%');
                entry.scope.style.setProperty('--em-ang', ang.toFixed(2) + 'deg');
                entry.scope.style.setProperty('--em-alpha', alpha.toFixed(3));
            }

            function showEmblemCard() {
                emblemEntries.forEach((entry) => {
                    if (entry.gif) entry.gif.classList.add('display-none');
                    entry.scope.classList.remove('display-none');
                });
            }

            function showEmblemGif() {
                emblemEntries.forEach((entry) => {
                    if (entry.gif) {
                        entry.gif.classList.remove('display-none');
                        entry.scope.classList.add('display-none');
                        return;
                    }
                    entry.scope.classList.remove('display-none');
                });
            }

            const P = {
                dirY: -1,
                dirX: 1,
                sensY: 24,
                sensX: 18,
                maxY: 78,
                maxX: 18,
                maxAng: 11,
                alphaMin: 0.055,
                alphaMax: 0.52,
                topFadeStart: 0.76,
                topFadeEnd: 1.0,
                lerp: 0.18,
                deadband: 0.008
            };

            const S = {
                ok: false,
                center: { tiltX: 0, tiltY: 0 },
                live: { tiltX: 0, tiltY: 0 }
            };

            const clamp = (v, min, max) => v < min ? min : (v > max ? max : v);
            const lerp = (a, b, t) => a + (b - a) * t;
            const smooth = (e0, e1, x) => {
                const t = clamp((x - e0) / (e1 - e0), 0, 1);
                return t * t * (3 - 2 * t);
            };

            function getViewportAngle() {
                if (window.screen && window.screen.orientation && Number.isFinite(window.screen.orientation.angle)) {
                    return ((window.screen.orientation.angle % 360) + 360) % 360;
                }
                if (typeof window.orientation === 'number') {
                    return ((window.orientation % 360) + 360) % 360;
                }
                return window.innerWidth > window.innerHeight ? 90 : 0;
            }

            function getScreenAlignedTilt(beta, gamma) {
                const rawX = Number.isFinite(gamma) ? gamma : 0;
                const rawY = Number.isFinite(beta) ? beta : 0;
                const angle = getViewportAngle();

                switch (angle) {
                    case 90:
                        return { tiltX: rawY, tiltY: -rawX };
                    case 180:
                        return { tiltX: -rawX, tiltY: -rawY };
                    case 270:
                        return { tiltX: -rawY, tiltY: rawX };
                    default:
                        return { tiltX: rawX, tiltY: rawY };
                }
            }

            function targetFrom(base, tilt) {
                const dY = clamp((tilt.tiltY - S.center.tiltY) / P.sensY, -1, 1);
                const dX = clamp((tilt.tiltX - S.center.tiltX) / P.sensX, -1, 1);
                const signedY = dY * (P.dirY ?? 1);
                const signedX = dX * (P.dirX ?? 1);
                const mag = clamp(Math.hypot(dX, dY), 0, 1);

                const tx = base.tx + signedX * P.maxX;
                const ty = base.ty - signedY * P.maxY;
                const ang = base.ang + signedX * P.maxAng;
                const baseAlpha = P.alphaMin + mag * (P.alphaMax - P.alphaMin);

                const progressUp = clamp((base.ty - ty) / P.maxY, 0, 1);
                const topFade = 1 - smooth(P.topFadeStart, P.topFadeEnd, progressUp);
                const alpha = clamp(baseAlpha * topFade, P.alphaMin * 0.55, P.alphaMax);

                return { tx, ty, ang, alpha };
            }

            function animateTo(tilt) {
                const near = (a, b) => Math.abs(a - b) < P.deadband * (1 + Math.abs(b) / 100);
                const k = P.lerp;

                emblemEntries.forEach((entry) => {
                    const target = targetFrom(entry.base, tilt);
                    entry.last.tx = near(entry.last.tx, target.tx) ? target.tx : lerp(entry.last.tx, target.tx, k);
                    entry.last.ty = near(entry.last.ty, target.ty) ? target.ty : lerp(entry.last.ty, target.ty, k);
                    entry.last.ang = near(entry.last.ang, target.ang) ? target.ang : lerp(entry.last.ang, target.ang, k);
                    entry.last.alpha = near(entry.last.alpha, target.alpha) ? target.alpha : lerp(entry.last.alpha, target.alpha, k);
                    setVars(entry, entry.last.tx, entry.last.ty, entry.last.ang, entry.last.alpha);
                });
            }

            (function setupPermissionsGate() {
                const PERM_KEY = 'sensors:permGranted:9Btl3GZUkd';
                const COOKIE_NAME = 'sensors_perm_9Btl3GZUkd';
                const needsMotionPerm =
                    typeof DeviceMotionEvent !== 'undefined' &&
                    typeof DeviceMotionEvent.requestPermission === 'function';
                const needsOrientPerm =
                    typeof DeviceOrientationEvent !== 'undefined' &&
                    typeof DeviceOrientationEvent.requestPermission === 'function';

                let requesting = false;
                let motionActivated = false;
                let removeGestureListeners = null;

                function hasPermCookie() {
                    return document.cookie.split('; ').some(c => c === `${COOKIE_NAME}=1`);
                }

                function setPermCookie() {
                    const secure = location.protocol === 'https:' ? '; Secure' : '';
                    document.cookie = `${COOKIE_NAME}=1; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
                }

                function persistGrantedIfAllowed() {
                    if (isAppleMobile) return;
                    try { localStorage.setItem(PERM_KEY, '1'); } catch (_) {}
                    setPermCookie();
                }

                function onOrient(e) {
                    if (!S.ok || (e.beta == null && e.gamma == null)) return;

                    if (!motionActivated) {
                        motionActivated = true;
                        showEmblemCard();
                        persistGrantedIfAllowed();
                    }

                    const tilt = getScreenAlignedTilt(e.beta, e.gamma);
                    S.live.tiltX = tilt.tiltX;
                    S.live.tiltY = tilt.tiltY;
                    animateTo(tilt);
                }

                function startSensors() {
                    if (S.ok) return;
                    try {
                        S.ok = true;
                        window.addEventListener('deviceorientation', onOrient, true);
                        setTimeout(() => {
                            S.center.tiltX = S.live.tiltX;
                            S.center.tiltY = S.live.tiltY;
                        }, 180);
                    } catch (_) {}
                }

                function recenterToCurrentTilt() {
                    S.center.tiltX = S.live.tiltX;
                    S.center.tiltY = S.live.tiltY;
                }

                function probe(timeout = 240) {
                    return new Promise(resolve => {
                        let done = false;

                        const onAnyOrient = (ev) => {
                            if (!ev || ev.beta == null) return;
                            done = true;
                            cleanup();
                            resolve(true);
                        };

                        const onAnyMotion = () => {
                            done = true;
                            cleanup();
                            resolve(true);
                        };

                        const cleanup = () => {
                            window.removeEventListener('deviceorientation', onAnyOrient, true);
                            window.removeEventListener('devicemotion', onAnyMotion, true);
                        };

                        window.addEventListener('deviceorientation', onAnyOrient, { once: true, capture: true, passive: true });
                        window.addEventListener('devicemotion', onAnyMotion, { once: true, capture: true, passive: true });

                        requestAnimationFrame(() => requestAnimationFrame(() => {
                            if (done) return;
                            setTimeout(() => {
                                cleanup();
                                resolve(false);
                            }, timeout);
                        }));
                    });
                }

                function getProbeTimeout(baseTimeout) {
                    return isAppleMobile ? Math.max(baseTimeout, 560) : baseTimeout;
                }

                function armGesture(fn) {
                    if (removeGestureListeners) return;

                    const once = async () => {
                        if (removeGestureListeners) removeGestureListeners();
                        await fn();
                    };

                    removeGestureListeners = () => {
                        document.removeEventListener('click', once, true);
                        if (!isAppleMobile) {
                            document.removeEventListener('pointerdown', once, true);
                            document.removeEventListener('touchstart', once, true);
                        }
                        removeGestureListeners = null;
                    };

                    document.addEventListener('click', once, { capture: true });
                    if (!isAppleMobile) {
                        document.addEventListener('pointerdown', once, { capture: true, passive: true });
                        document.addEventListener('touchstart', once, { capture: true, passive: true });
                    }
                }

                async function requestAndStartOnce() {
                    if (requesting || S.ok) return;
                    requesting = true;

                    let ok = true;
                    try {
                        if (needsMotionPerm) ok = (await DeviceMotionEvent.requestPermission()) === 'granted' && ok;
                        if (needsOrientPerm) ok = (await DeviceOrientationEvent.requestPermission()) === 'granted' && ok;
                    } catch (_) {
                        ok = false;
                    }

                    if (ok) {
                        startSensors();
                        probe(getProbeTimeout(320)).then((fired) => {
                            if (!fired && !motionActivated) showEmblemGif();
                        });
                    } else {
                        showEmblemGif();
                        armGesture(requestAndStartOnce);
                    }

                    requesting = false;
                }

                const alreadyGranted = (() => {
                    if (isAppleMobile) return false;

                    try {
                        return localStorage.getItem(PERM_KEY) === '1' || hasPermCookie();
                    } catch (_) {
                        return hasPermCookie();
                    }
                })();

                if (!needsMotionPerm && !needsOrientPerm) {
                    startSensors();
                    probe(getProbeTimeout(240)).then((fired) => {
                        if (!fired && !motionActivated) showEmblemGif();
                    });
                } else if (alreadyGranted) {
                    startSensors();
                    probe(getProbeTimeout(280)).then((fired) => {
                        if (!fired && !motionActivated) showEmblemGif();
                    });
                } else {
                    showEmblemGif();
                    armGesture(requestAndStartOnce);
                }

                if (window.screen && window.screen.orientation && typeof window.screen.orientation.addEventListener === 'function') {
                    window.screen.orientation.addEventListener('change', () => {
                        setTimeout(recenterToCurrentTilt, 180);
                    });
                }
                window.addEventListener('orientationchange', () => {
                    setTimeout(recenterToCurrentTilt, 180);
                });
            })();

            emblemEntries.forEach((entry) => {
                setVars(entry, entry.base.tx, entry.base.ty, entry.base.ang, entry.base.alpha);
            });
        }
    }

    // Page transitions
    document.body.classList.add('pt-in');
    function navigateTo(url) {
        document.body.classList.remove('pt-in');
        document.body.classList.add('pt-out');
        setTimeout(() => { window.location.replace(url); }, 160);
    }
    window._navigateTo = navigateTo;
});
