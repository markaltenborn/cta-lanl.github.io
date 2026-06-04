/* Opportunities photo gallery + lightbox.
 *
 * Fetches /data/opportunities/photos.yml&mdash;a list of { src, caption, thumb? }.
 * Renders one tile per entry into #opps-gallery-grid.
 * Click a tile to open the lightbox; close via the X button, the backdrop,
 * or the Escape key.
 *
 * To add a new photo: drop the file under /opportunities/images/ and append
 * an entry to data/opportunities/photos.yml. No HTML changes needed.
 */
(function () {
    var YAML_URL = '/data/opportunities/photos.yml';

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    ready(function () {
        var grid = document.getElementById('opps-gallery-grid');
        var emptyMsg = document.getElementById('opps-gallery-empty');
        var lightbox = document.getElementById('opps-lightbox');
        var lightboxImg = document.getElementById('opps-lightbox-img');
        var lightboxCaption = document.getElementById('opps-lightbox-caption');
        var lightboxClose = lightbox && lightbox.querySelector('.opps-lightbox-close');
        if (!grid || !lightbox) return;

        function render(photos) {
            if (!Array.isArray(photos) || photos.length === 0) {
                if (emptyMsg) emptyMsg.style.display = 'block';
                return;
            }
            var frag = document.createDocumentFragment();
            photos.forEach(function (p) {
                if (!p || !p.src) return;
                var tile = document.createElement('button');
                tile.type = 'button';
                tile.className = 'opps-gallery-tile';
                tile.setAttribute('aria-label', p.caption || 'Open photo');

                var img = document.createElement('img');
                img.src = p.thumb || p.src;
                img.alt = p.caption || '';
                img.loading = 'lazy';
                tile.appendChild(img);

                if (p.caption) {
                    var cap = document.createElement('div');
                    cap.className = 'opps-gallery-tile-caption';
                    cap.textContent = p.caption;
                    tile.appendChild(cap);
                }

                tile.addEventListener('click', function () {
                    openLightbox(p.src, p.caption || '');
                });
                frag.appendChild(tile);
            });
            grid.appendChild(frag);
        }

        function openLightbox(src, caption) {
            lightboxImg.src = src;
            lightboxImg.alt = caption;
            lightboxCaption.textContent = caption;
            lightbox.classList.add('is-open');
            lightbox.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            if (lightboxClose) lightboxClose.focus();
        }

        function closeLightbox() {
            lightbox.classList.remove('is-open');
            lightbox.setAttribute('aria-hidden', 'true');
            lightboxImg.src = '';
            lightboxImg.alt = '';
            lightboxCaption.textContent = '';
            document.body.style.overflow = '';
        }

        if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox) closeLightbox();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && lightbox.classList.contains('is-open')) {
                closeLightbox();
            }
        });

        fetch(YAML_URL, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.text() : ''; })
            .then(function (txt) {
                if (!txt) {
                    if (emptyMsg) emptyMsg.style.display = 'block';
                    return;
                }
                try {
                    var data = jsyaml.load(txt);
                    var photos = Array.isArray(data) ? data : (data && data.photos) || [];
                    render(photos);
                } catch (err) {
                    console.error('Photo YAML parse error:', err);
                    if (emptyMsg) emptyMsg.style.display = 'block';
                }
            })
            .catch(function (err) {
                console.error('Photo gallery fetch failed:', err);
                if (emptyMsg) emptyMsg.style.display = 'block';
            });
    });
})();
