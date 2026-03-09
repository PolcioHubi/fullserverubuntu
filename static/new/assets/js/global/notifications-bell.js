/**
 * Shared notification bell module.
 * Auto-initializes when #notif-bell exists on the page.
 * CSS is injected inline so it's never stale from SW cache.
 */
(function () {
    // Inject CSS inline — not dependent on cached style.css
    var css =
        '@keyframes bell-shake{0%{transform:rotate(0)}10%{transform:rotate(14deg)}20%{transform:rotate(-14deg)}30%{transform:rotate(10deg)}40%{transform:rotate(-10deg)}50%{transform:rotate(6deg)}60%{transform:rotate(-6deg)}70%{transform:rotate(2deg)}80%{transform:rotate(-2deg)}90%,100%{transform:rotate(0)}}' +
        '.bell-shake{animation:bell-shake .6s ease-in-out infinite;transform-origin:top center}' +
        '.notif-card{background:var(--card-background,#fff);border-radius:16px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}' +
        '.notif-card .notif-type{display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;margin-bottom:6px;text-transform:uppercase}' +
        '.notif-card .notif-type.info{background:#e3f2fd;color:#1565c0}' +
        '.notif-card .notif-type.warning{background:#fff3e0;color:#e65100}' +
        '.notif-card .notif-type.error{background:#ffebee;color:#c62828}' +
        '.notif-card .notif-title{font-family:Inter,sans-serif;font-weight:600;font-size:15px;margin-bottom:4px}' +
        '.notif-card .notif-msg{font-family:Inter,sans-serif;font-size:13px;opacity:.8;line-height:1.4}' +
        '.notif-card .notif-time{font-size:11px;opacity:.5;margin-top:6px}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
})();

var notifBell = {
    _data: [],
    _dismissed: [],

    init: function () {
        if (!document.getElementById('notif-bell')) return;

        var self = this;
        this._dismissed = JSON.parse(localStorage.getItem('dismissed_notifs') || '[]');

        $('#notif-bell').on('click', function () { self.openPanel(); });
        $('#notif-back').on('click', function () { self.closePanel(); });

        this.fetch();
    },

    fetch: function () {
        var self = this;
        var aReq = $.getJSON('/api/announcements');
        var nReq = $.getJSON('/api/notifications');

        $.when(aReq, nReq).done(function (aRes, nRes) {
            var announcements = Array.isArray(aRes[0]) ? aRes[0] : [];
            var notifications = Array.isArray(nRes[0]) ? nRes[0] : [];

            var items = announcements.filter(function (a) {
                return self._dismissed.indexOf('a_' + a.id) === -1;
            }).map(function (a) {
                return {
                    _key: 'a_' + a.id,
                    title: a.title,
                    message: a.message,
                    type: a.type || 'info',
                    created_at: a.created_at,
                    source: 'announcement'
                };
            });

            notifications.filter(function (n) {
                return !n.is_read;
            }).forEach(function (n) {
                items.push({
                    _key: 'n_' + n.id,
                    _notifId: n.id,
                    title: 'Powiadomienie',
                    message: n.message,
                    type: 'info',
                    created_at: n.created_at,
                    source: 'notification'
                });
            });

            items.sort(function (a, b) {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });

            self._data = items;
            self._updateBadge();
            self._renderList();
        }).fail(function () {
            self._data = [];
            self._updateBadge();
            self._renderList();
        });
    },

    _updateBadge: function () {
        var $badge = $('#notif-badge');
        var $icon = $('#notif-bell .theme-icon');
        var count = this._data.length;

        if (count > 0) {
            $badge.text(count > 9 ? '9+' : count).show();
            $icon.addClass('bell-shake');
        } else {
            $badge.hide();
            $icon.removeClass('bell-shake');
        }
    },

    _renderList: function () {
        var $list = $('#notif-list');
        var $empty = $('#notif-empty');
        if (!$list.length) return;

        $list.find('.notif-card').remove();

        if (this._data.length === 0) {
            $empty.show();
            return;
        }
        $empty.hide();

        var self = this;
        this._data.forEach(function (n) {
            var typeLabel = n.type === 'warning' ? 'Ostrzeżenie' : n.type === 'error' ? 'Pilne' : 'Info';
            var sourceLabel = n.source === 'announcement' ? 'Ogłoszenie' : 'Powiadomienie';
            var timeStr = n.created_at ? self._timeAgo(n.created_at) : '';

            var $card = $('<div class="notif-card" data-key="' + self._escAttr(n._key) + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:center">' +
                '<span class="notif-type ' + self._escAttr(n.type || 'info') + '">' + self._esc(typeLabel) + ' · ' + self._esc(sourceLabel) + '</span>' +
                '<button class="notif-dismiss" style="background:none;border:none;font-size:18px;cursor:pointer;opacity:.5;padding:0 4px;line-height:1" title="Odrzuć">&times;</button>' +
                '</div>' +
                '<div class="notif-title">' + self._esc(n.title) + '</div>' +
                '<div class="notif-msg">' + self._esc(n.message) + '</div>' +
                '<div class="notif-time">' + self._esc(timeStr) + '</div>' +
                '</div>');

            $card.find('.notif-dismiss').on('click', function () {
                self._dismiss(n);
                $card.slideUp(200, function () { $card.remove(); });
            });

            $list.append($card);
        });
    },

    _dismiss: function (n) {
        this._data = this._data.filter(function (item) {
            return item._key !== n._key;
        });

        if (n.source === 'announcement') {
            this._dismissed.push(n._key);
            localStorage.setItem('dismissed_notifs', JSON.stringify(this._dismissed));
        } else if (n.source === 'notification' && n._notifId) {
            $.ajax({
                url: '/api/notifications/read',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ id: n._notifId })
            });
        }

        this._updateBadge();
        if (this._data.length === 0) {
            $('#notif-empty').show();
        }
    },

    openPanel: function () {
        var $standalone = $('[data-standalone]');
        var $wrapper = $('[data-wrapper]');
        if (window.chatFeed && typeof window.chatFeed.closePanel === 'function') {
            window.chatFeed.closePanel();
        }
        $wrapper.addClass('scale[0.9]');
        $standalone.addClass('overflow[x-hidden] overflow[y-auto]').removeClass('overflow[hidden]');
        $('[data-group="navigation"]').addClass('display-none');
        $('#notif-panel').css('transform', '');
        $('#notif-bell .theme-icon').removeClass('bell-shake');

        // Ensure empty state is visible when no items
        if (this._data.length === 0) {
            $('#notif-empty').show();
        }
    },

    closePanel: function () {
        var $standalone = $('[data-standalone]');
        var $wrapper = $('[data-wrapper]');
        $('#notif-panel').css('transform', 'translateX(100%)');
        $wrapper.removeClass('scale[0.9]');
        $standalone.removeClass('overflow[x-hidden] overflow[y-auto]').addClass('overflow[hidden]');
        $('[data-group="navigation"]').removeClass('display-none');
    },

    _timeAgo: function (isoStr) {
        var diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
        if (diff < 60) return 'Przed chwilą';
        if (diff < 3600) return Math.floor(diff / 60) + ' min temu';
        if (diff < 86400) return Math.floor(diff / 3600) + ' godz. temu';
        return Math.floor(diff / 86400) + ' dni temu';
    },

    _esc: function (str) {
        var d = document.createElement('div');
        d.appendChild(document.createTextNode(str || ''));
        return d.innerHTML;
    },

    _escAttr: function (str) {
        return (str || '').replace(/[^a-z0-9_-]/gi, '');
    }
};

$(function () { notifBell.init(); });
