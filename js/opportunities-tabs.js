/* Toggleable horizontal tabs (filing-cabinet style) for /opportunities/.
 *
 * Default: no tab selected, all panels hidden.
 * Click an inactive tab → activates it, deactivates any other open tab.
 * Click the currently-active tab → deactivates it (back to all-closed).
 *
 * Markup contract:
 *   .opps-tab buttons carry data-tab="<key>" and aria-controls="<panel-id>"
 *   each .opps-tab-panel has matching id="panel-<key>"
 */
(function () {
    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    ready(function () {
        var tabs = Array.prototype.slice.call(document.querySelectorAll('.opps-tab'));
        if (!tabs.length) return;

        function setActive(key) {
            tabs.forEach(function (t) {
                var on = t.getAttribute('data-tab') === key;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.setAttribute('tabindex', on ? '0' : '-1');
                var panelId = t.getAttribute('aria-controls');
                var panel = panelId ? document.getElementById(panelId) : null;
                if (panel) {
                    if (on) {
                        panel.removeAttribute('hidden');
                    } else {
                        panel.setAttribute('hidden', '');
                    }
                }
            });
        }

        function clearActive() {
            tabs.forEach(function (t) {
                t.classList.remove('is-active');
                t.setAttribute('aria-selected', 'false');
                t.setAttribute('tabindex', '0');
                var panelId = t.getAttribute('aria-controls');
                var panel = panelId ? document.getElementById(panelId) : null;
                if (panel) panel.setAttribute('hidden', '');
            });
        }

        tabs.forEach(function (t) {
            t.setAttribute('tabindex', '0');
            t.addEventListener('click', function () {
                var isActive = t.classList.contains('is-active');
                if (isActive) {
                    clearActive();
                } else {
                    setActive(t.getAttribute('data-tab'));
                }
            });
        });

        // Optional deep-link: /opportunities/opportunities.html#tab=postdoc opens postdoc.
        var hash = window.location.hash || '';
        var m = hash.match(/^#tab=([a-z\-]+)$/i);
        if (m) {
            var key = m[1].toLowerCase();
            var hit = tabs.some(function (t) { return t.getAttribute('data-tab') === key; });
            if (hit) setActive(key);
        }
    });
})();
