/* Applies the APPLY-button href across every page that loads this script.
 *
 * Default href = the LANL CTA postdoc apply portal.
 * If today falls inside any entry in ACTIVE_CALLS, that call's URL wins.
 *
 * To advertise an open named-fellowship call, push a row onto ACTIVE_CALLS
 * with { url, start, end } in YYYY-MM-DD form. When end < today, remove it.
 *
 * This script also lazy-loads the shared compact strap header into any
 * <div id="cta-header"></div> placeholder on the page, then keeps the
 * gradient background sized to the top-bar (resize-aware).
 */
(function () {
    var DEFAULT_APPLY_URL = 'https://jobszp1.lanl.gov/OA_HTML/RF.jsp?function_id=14330&resp_id=51616&resp_appl_id=800&security_group_id=0%3C_code%3DUS&params=btOoWGkj963I..Q2L5dcEkwPdY2X8RgGyIGQIgmPvx1ATLhV1EKKfMP8X3LGjq5S&oas=LEh_BAM3qoSLDf-lxE5pKg';

    var ACTIVE_CALLS = [
        // { url: 'https://...', start: '2026-09-01', end: '2026-11-30' },
    ];

    function activeCallUrl() {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        for (var i = 0; i < ACTIVE_CALLS.length; i++) {
            var c = ACTIVE_CALLS[i];
            var s = new Date(c.start);
            var e = new Date(c.end);
            if (s <= today && today <= e) return c.url;
        }
        return DEFAULT_APPLY_URL;
    }

    function wireApplyButtons() {
        var url = activeCallUrl();
        var nodes = document.querySelectorAll('.js-apply');
        for (var i = 0; i < nodes.length; i++) nodes[i].setAttribute('href', url);
    }

    function syncStrap() {
        var tb = document.querySelector('.page-strap .top-bar');
        var bg = document.querySelector('.page-strap .strap-bg');
        if (tb && bg) bg.style.height = tb.offsetHeight + 'px';
    }

    function loadHeaderStrap() {
        var slot = document.getElementById('cta-header');
        if (!slot) {
            wireApplyButtons();
            return;
        }
        fetch('/partials/header-strap.html')
            .then(function (r) { return r.text(); })
            .then(function (html) {
                slot.innerHTML = html;
                wireApplyButtons();
                syncStrap();
            })
            .catch(function (err) { console.error('Header load failed:', err); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadHeaderStrap);
    } else {
        loadHeaderStrap();
    }
    window.addEventListener('load', syncStrap);
    window.addEventListener('resize', syncStrap);
})();
