/**
 * Global live chat module for the documents page.
 * Uses polling and no-store API responses to avoid stale chat state.
 */
(function () {
    var css =
        '@keyframes chat-pulse{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(13,110,253,.4)}70%{transform:scale(1.06);box-shadow:0 0 0 10px rgba(13,110,253,0)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(13,110,253,0)}}' +
        '.chat-pulse{animation:chat-pulse 1.2s ease-out infinite;border-radius:12px}' +
        '.chat-row{display:flex;margin:0 0 10px}' +
        '.chat-row.own{justify-content:flex-end}' +
        '.chat-row.other{justify-content:flex-start}' +
        '.chat-card{max-width:86%;border-radius:18px;padding:12px 14px;box-shadow:0 1px 4px rgba(0,0,0,.06)}' +
        '.chat-row.own .chat-card{background:#e8f1ff}' +
        '.chat-row.other .chat-card{background:var(--card-background,#fff)}' +
        '.chat-meta{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:4px;font-size:11px;opacity:.65}' +
        '.chat-user{font-family:Inter,sans-serif;font-weight:700}' +
        '.chat-time{font-family:Inter,sans-serif;white-space:nowrap}' +
        '.chat-message{font-family:Inter,sans-serif;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
})();

var chatFeed = {
    _open: false,
    _sending: false,
    _lastMessageId: 0,
    _pollTimer: null,
    _pendingVisibleReadId: 0,

    init: function () {
        if (!document.getElementById('chat-button')) return;

        var self = this;
        $('#chat-button').on('click', function () { self.openPanel(); });
        $('#chat-back').on('click', function () { self.closePanel(); });
        $('#chat-send').on('click', function () { self.sendMessage(); });
        $('#chat-input').on('input', function () {
            self._clearError();
            self._resizeInput();
        });
        $('#chat-input').on('keydown', function (event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                self.sendMessage();
            }
        });

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && self._open && self._pendingVisibleReadId > 0) {
                self._markRead(self._pendingVisibleReadId);
            }
            self._schedulePoll();
        });

        this.fetchUnread().always(function () {
            self._schedulePoll();
        });
    },

    _request: function (options) {
        return $.ajax($.extend(true, {
            cache: false,
            headers: {
                'Cache-Control': 'no-cache'
            }
        }, options));
    },

    _getPollDelay: function () {
        if (this._open) {
            return document.hidden ? 10000 : 3000;
        }
        return document.hidden ? 15000 : 10000;
    },

    _schedulePoll: function () {
        var self = this;
        if (this._pollTimer) {
            clearTimeout(this._pollTimer);
        }
        this._pollTimer = setTimeout(function () {
            self._poll();
        }, this._getPollDelay());
    },

    _poll: function () {
        var self = this;
        var request = this._open ? this.fetchNewMessages() : this.fetchUnread();
        request.always(function () {
            self._schedulePoll();
        });
    },

    fetchUnread: function () {
        var self = this;
        return this._request({
            url: '/api/chat/unread',
            method: 'GET'
        }).done(function (response) {
            if (!response || response.success !== true) return;
            self._lastMessageId = Math.max(self._lastMessageId, Number(response.last_message_id) || 0);
            if (!self._open) {
                self._applyUnreadState(Number(response.unread_count) || 0);
            }
        }).fail(function () {
            if (!self._open) {
                self._applyUnreadState(0);
            }
        });
    },

    openPanel: function () {
        var $standalone = $('[data-standalone]');
        var $wrapper = $('[data-wrapper]');

        if (window.notifBell && typeof window.notifBell.closePanel === 'function') {
            window.notifBell.closePanel();
        }

        this._open = true;
        this._clearError();
        this._applyUnreadState(0);
        $wrapper.addClass('scale[0.9]');
        $standalone.addClass('overflow[x-hidden] overflow[y-auto]').removeClass('overflow[hidden]');
        $('[data-group="navigation"]').addClass('display-none');
        $('#chat-panel').css('transform', '');
        this.loadHistory();
    },

    closePanel: function () {
        var $standalone = $('[data-standalone]');
        var $wrapper = $('[data-wrapper]');

        this._open = false;
        $('#chat-panel').css('transform', 'translateX(100%)');
        $wrapper.removeClass('scale[0.9]');
        $standalone.removeClass('overflow[x-hidden] overflow[y-auto]').addClass('overflow[hidden]');
        $('[data-group="navigation"]').removeClass('display-none');
        this._schedulePoll();
    },

    loadHistory: function () {
        var self = this;
        if (this._pollTimer) {
            clearTimeout(this._pollTimer);
        }

        this._request({
            url: '/api/chat/messages',
            method: 'GET',
            data: { limit: 150 }
        }).done(function (response) {
            if (!response || response.success !== true) {
                self._setError('Nie udało się pobrać wiadomości.');
                return;
            }

            self._renderMessages(response.items || []);
            self._lastMessageId = Number(response.last_message_id) || 0;
            self._scrollToBottom();

            if (!document.hidden && self._lastMessageId > 0) {
                self._markRead(self._lastMessageId);
            } else {
                self._pendingVisibleReadId = self._lastMessageId;
            }
        }).fail(function () {
            self._setError('Nie udało się pobrać wiadomości.');
        }).always(function () {
            self._schedulePoll();
        });
    },

    fetchNewMessages: function () {
        var self = this;
        return this._request({
            url: '/api/chat/messages',
            method: 'GET',
            data: {
                after_id: this._lastMessageId,
                limit: 150
            }
        }).done(function (response) {
            if (!response || response.success !== true) return;

            var items = Array.isArray(response.items) ? response.items : [];
            if (items.length > 0) {
                self._appendMessages(items);
                self._lastMessageId = Math.max(self._lastMessageId, Number(response.last_message_id) || 0);
                self._scrollToBottom();

                if (!document.hidden && self._lastMessageId > 0) {
                    self._markRead(self._lastMessageId);
                } else {
                    self._pendingVisibleReadId = self._lastMessageId;
                }
            }
        });
    },

    sendMessage: function () {
        var self = this;
        var $input = $('#chat-input');
        var $button = $('#chat-send');
        var message = String($input.val() || '').trim();

        if (this._sending) return;
        if (!message) {
            this._setError('Wiadomość nie może być pusta.');
            return;
        }
        if (message.length > 2000) {
            this._setError('Wiadomość może mieć maksymalnie 2000 znaków.');
            return;
        }

        this._sending = true;
        this._clearError();
        $button.prop('disabled', true).text('Wysyłanie...');

        this._request({
            url: '/api/chat/messages',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ message: message })
        }).done(function (response) {
            if (!response || response.success !== true || !response.item) {
                self._setError((response && response.error) || 'Nie udało się wysłać wiadomości.');
                return;
            }

            self._appendMessages([response.item]);
            self._lastMessageId = Math.max(self._lastMessageId, Number(response.item.id) || 0);
            self._scrollToBottom();
            $input.val('');
            self._resizeInput(true);

            if (!document.hidden && self._lastMessageId > 0) {
                self._markRead(self._lastMessageId);
            }

            self.fetchNewMessages();
        }).fail(function (xhr) {
            var response = xhr && xhr.responseJSON ? xhr.responseJSON : null;
            self._setError((response && response.error) || 'Nie udało się wysłać wiadomości.');
        }).always(function () {
            self._sending = false;
            $button.prop('disabled', false).text('Wyślij');
            self._schedulePoll();
        });
    },

    _markRead: function (lastSeenId) {
        var self = this;
        if (!lastSeenId) return;

        this._pendingVisibleReadId = 0;
        this._request({
            url: '/api/chat/read',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ last_seen_id: lastSeenId })
        }).done(function (response) {
            if (!response || response.success !== true) return;
            self._applyUnreadState(Number(response.unread_count) || 0);
        });
    },

    _renderMessages: function (items) {
        var $list = $('#chat-list');
        $list.find('.chat-row').remove();

        if (!items.length) {
            $('#chat-empty').show();
            return;
        }

        $('#chat-empty').hide();
        this._appendMessages(items);
    },

    _appendMessages: function (items) {
        var $list = $('#chat-list');
        var self = this;

        items.forEach(function (item) {
            var id = Number(item.id) || 0;
            if (!id || $list.find('[data-chat-id="' + id + '"]').length) {
                return;
            }

            $('#chat-empty').hide();
            $list.append(self._buildMessageElement(item));
        });
    },

    _buildMessageElement: function (item) {
        var ownClass = item.is_own ? 'own' : 'other';
        var timeLabel = item.created_at ? this._timeAgo(item.created_at) : '';
        return (
            '<div class="chat-row ' + ownClass + '" data-chat-id="' + this._escAttr(String(item.id || '')) + '">' +
                '<div class="chat-card">' +
                    '<div class="chat-meta">' +
                        '<span class="chat-user">' + this._esc(item.user_id || 'Użytkownik') + '</span>' +
                        '<span class="chat-time">' + this._esc(timeLabel) + '</span>' +
                    '</div>' +
                    '<div class="chat-message">' + this._esc(item.message || '') + '</div>' +
                '</div>' +
            '</div>'
        );
    },

    _applyUnreadState: function (count) {
        var $badge = $('#chat-badge');
        var $icon = $('#chat-button .theme-icon');

        if (count > 0) {
            $badge.text(count > 9 ? '9+' : count).show();
            $icon.addClass('chat-pulse');
        } else {
            $badge.hide();
            $icon.removeClass('chat-pulse');
        }
    },

    _setError: function (message) {
        $('#chat-error').text(message).show();
    },

    _clearError: function () {
        $('#chat-error').hide().text('');
    },

    _resizeInput: function (resetOnly) {
        var $input = $('#chat-input');
        if (!$input.length) return;

        $input.css('height', '52px');
        if (resetOnly) return;
        $input.css('height', Math.min($input[0].scrollHeight, 140) + 'px');
    },

    _scrollToBottom: function () {
        var $list = $('#chat-list');
        if (!$list.length) return;
        $list.scrollTop($list[0].scrollHeight);
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

window.chatFeed = chatFeed;
$(function () { chatFeed.init(); });
