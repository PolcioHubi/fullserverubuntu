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
        const getDocumentsLayoutMode = () => {
            const savedLayout = localStorage.getItem('documents_layout_mode');
            return ['overlap', 'grid', 'list'].includes(savedLayout) ? savedLayout : 'overlap';
        };

        function updateDocumentCards(apiData) {
            const data = apiData || {};
            let saved = {};
            try { saved = JSON.parse(localStorage.getItem('doc_visibility') || '{}'); } catch(e) {}
            const activeLayout = getDocumentsLayoutMode();
            let visibleIndex = 0;
            const offset = 70;
            const order = ['mdowod', 'mprawojazdy', 'school_id', 'student_id'];

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

            const overlapHeight = visibleIndex > 0 ? (235 + ((visibleIndex - 1) * offset)) : 0;
            $('[data-layout-view="overlap"]').css('min-height', overlapHeight ? `${overlapHeight}px` : '0');
        }
        // Expose for instant toggle updates from documents.js
        window._updateDocumentCards = () => updateDocumentCards(window._lastDocData || {});

        const pollDocs = async () => {
            try {
                const response = await requests.get('/api/user-documents');
                if (response.success) {
                    window._lastDocData = response.data.documents;
                    updateDocumentCards(response.data.documents);

                    // Expose availability for Dostosuj panel (disabled toggles)
                    window._docAvailability = response.data.documents;
                }
            } catch (err) {
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
                    mprawojazdy: '/user_files/prawojazdy_new.html'
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

    if (/(mdowod|dowodnowy|mprawojazdy|prawojazdy|school_id|student_id|qr_code)/.test(path)) {
        const $wrap = document.querySelector('.emblem[data-emblem]');
        const $scope = document.getElementById('emblem');
        const $gif = $wrap ? $wrap.querySelector('img') : null;

        if (!$wrap || !$scope) return;

        const isAppleMobile =
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
            /iPad|iPhone|iPod/.test(navigator.userAgent);

        function showEmblemCard() {
            if ($gif) $gif.classList.add('display-none');
            $scope.classList.remove('display-none');
        }

        function showEmblemGif() {
            if ($gif) $gif.classList.remove('display-none');
            $scope.classList.add('display-none');
        }

        const P = {
            dirY: -1,
            dirX: 1,
            sensY: 24,
            sensX: 18,
            maxY: 78,
            maxX: 18,
            maxAng: 11,
            base: {
                tx: parseFloat(getComputedStyle($scope).getPropertyValue('--em-tx')) || 0,
                ty: parseFloat(getComputedStyle($scope).getPropertyValue('--em-ty')) || 34,
                ang: parseFloat(getComputedStyle($scope).getPropertyValue('--em-ang')) || 0,
                alpha: parseFloat(getComputedStyle($scope).getPropertyValue('--em-alpha')) || 0.12
            },
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
            last: {
                tx: P.base.tx,
                ty: P.base.ty,
                ang: P.base.ang,
                alpha: P.base.alpha
            },
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

        function setVars(tx, ty, ang, alpha) {
            $scope.style.setProperty('--em-tx', tx.toFixed(2) + '%');
            $scope.style.setProperty('--em-ty', ty.toFixed(2) + '%');
            $scope.style.setProperty('--em-ang', ang.toFixed(2) + 'deg');
            $scope.style.setProperty('--em-alpha', alpha.toFixed(3));
        }

        function targetFrom(tilt) {
            const dY = clamp((tilt.tiltY - S.center.tiltY) / P.sensY, -1, 1);
            const dX = clamp((tilt.tiltX - S.center.tiltX) / P.sensX, -1, 1);
            const signedY = dY * (P.dirY ?? 1);
            const signedX = dX * (P.dirX ?? 1);
            const mag = clamp(Math.hypot(dX, dY), 0, 1);

            const tx = P.base.tx + signedX * P.maxX;
            const ty = P.base.ty - signedY * P.maxY;
            const ang = P.base.ang + signedX * P.maxAng;
            const baseA = P.alphaMin + mag * (P.alphaMax - P.alphaMin);

            const progressUp = clamp((P.base.ty - ty) / P.maxY, 0, 1);
            const topFade = 1 - smooth(P.topFadeStart, P.topFadeEnd, progressUp);
            const alpha = clamp(baseA * topFade, P.alphaMin * 0.55, P.alphaMax);

            return { tx, ty, ang, alpha };
        }

        function animateTo(t) {
            const near = (a, b) => Math.abs(a - b) < P.deadband * (1 + Math.abs(b) / 100);
            const k = P.lerp;

            S.last.tx = near(S.last.tx, t.tx) ? t.tx : lerp(S.last.tx, t.tx, k);
            S.last.ty = near(S.last.ty, t.ty) ? t.ty : lerp(S.last.ty, t.ty, k);
            S.last.ang = near(S.last.ang, t.ang) ? t.ang : lerp(S.last.ang, t.ang, k);
            S.last.alpha = near(S.last.alpha, t.alpha) ? t.alpha : lerp(S.last.alpha, t.alpha, k);
            setVars(S.last.tx, S.last.ty, S.last.ang, S.last.alpha);
        }

        (function setupPermissionsGate() {
            const PERM_KEY = 'sensors:permGranted:9Btl3GZUkd';
            const COOKIE_NAME = 'sensors_perm_9Btl3GZUkd';
            let requesting = false;
            let motionActivated = false;

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

            const needsMotionPerm =
                typeof DeviceMotionEvent !== 'undefined' &&
                typeof DeviceMotionEvent.requestPermission === 'function';
            const needsOrientPerm =
                typeof DeviceOrientationEvent !== 'undefined' &&
                typeof DeviceOrientationEvent.requestPermission === 'function';

            function onOrient(e) {
                if (!S.ok) return;

                if (e.beta == null && e.gamma == null) return;

                if (!motionActivated) {
                    motionActivated = true;
                    showEmblemCard();
                    persistGrantedIfAllowed();
                }

                const tilt = getScreenAlignedTilt(e.beta, e.gamma);
                S.live.tiltX = tilt.tiltX;
                S.live.tiltY = tilt.tiltY;
                animateTo(targetFrom(tilt));
            }

            function startSensors() {
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

            function probe(timeout = 220) {
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

            function armGesture(fn) {
                const once = async (e) => {
                    if (!e.target.closest('[data-emblem]')) return;
                    remove();
                    await fn();
                };

                function remove() {
                    document.removeEventListener('pointerdown', once, true);
                    document.removeEventListener('touchstart', once, true);
                    document.removeEventListener('click', once, true);
                }

                document.addEventListener('pointerdown', once, { capture: true });
                document.addEventListener('touchstart', once, { capture: true });
                document.addEventListener('click', once, { capture: true });
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

                    probe(260).then(fired => {
                        if (!fired && !motionActivated) showEmblemGif();
                    });
                } else {
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

            $wrap.addEventListener('click', () => {
                requestAndStartOnce();
            }, true);

            if (!needsMotionPerm && !needsOrientPerm) {
                startSensors();
                probe(220).then(fired => {
                    if (!fired && !motionActivated) showEmblemGif();
                });
                if (window.screen && window.screen.orientation && typeof window.screen.orientation.addEventListener === 'function') {
                    window.screen.orientation.addEventListener('change', () => {
                        setTimeout(recenterToCurrentTilt, 180);
                    });
                }
                window.addEventListener('orientationchange', () => {
                    setTimeout(recenterToCurrentTilt, 180);
                });
                return;
            }

            if (alreadyGranted) {
                startSensors();
                probe(240).then(fired => {
                    if (!fired) armGesture(requestAndStartOnce);
                });
            } else {
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

        setVars(P.base.tx, P.base.ty, P.base.ang, P.base.alpha);
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
