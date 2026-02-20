/**
 * Shared utility functions for profile pages (staff, postdocs, students)
 * This module provides common functionality for loading and rendering profiles
 */

const ProfileUtils = (function() {
    'use strict';

    // Default image path
    const DEFAULT_IMG = '/staff/images/cta-default.jpg';

    /**
     * Creates an anchor element with target="_blank" and proper accessibility
     * @param {string} href - The URL
     * @param {string} text - Link text
     * @returns {HTMLAnchorElement}
     */
    function createExternalLink(href, text) {
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = text;
        anchor.setAttribute('aria-label', `${text} (opens in new tab)`);
        return anchor;
    }

    /**
     * Fetches and parses a YAML file
     * @param {string} path - Path to YAML file
     * @returns {Promise<Object|Array>}
     */
    async function fetchYAML(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
            }
            const text = await response.text();
            return jsyaml.load(text) || {};
        } catch (error) {
            console.error('Error fetching YAML:', error);
            return {};
        }
    }

    /**
     * Formats a slug into a display name (e.g., "john-doe" -> "John Doe")
     * @param {string} str - The slug string
     * @returns {string}
     */
    function formatNameFromSlug(str) {
        if (!str) return '';
        return String(str)
            .split('-')
            .map(word => {
                if (!word) return '';
                const lower = word.toLowerCase();
                return lower.charAt(0).toUpperCase() + lower.slice(1);
            })
            .join(' ');
    }

    /**
     * Generates an array of candidate image URLs to try
     * @param {string} slug - Person's slug identifier
     * @param {Object} person - Person object from roster
     * @param {Array<string>} years - Array of years to check (optional)
     * @param {string} imgRoster - Path to roster images folder
     * @param {string} imgYears - Path to year images folder (optional)
     * @param {string} defaultImg - Default image path
     * @returns {Array<string>}
     */
    function imageCandidates(slug, person, years = [], imgRoster, imgYears = null, defaultImg = DEFAULT_IMG) {
        const exts = ['.jpg', '.png', '.jpeg'];
        const candidates = [];

        // 1) Explicit photo from roster
        if (person && person.photo) {
            candidates.push(person.photo);
        }

        // 2) Canonical roster folder
        for (const ext of exts) {
            candidates.push(`${imgRoster}/${slug}${ext}`);
        }

        // 3) Year folders (if provided)
        if (imgYears && years.length > 0) {
            for (const year of years) {
                for (const ext of exts) {
                    candidates.push(`${imgYears}/${year}/${slug}${ext}`);
                }
            }
        }

        // 4) Default image
        candidates.push(defaultImg);

        // Remove duplicates
        return Array.from(new Set(candidates.filter(Boolean)));
    }

    /**
     * Tries to load images in sequence and returns the first one that loads successfully
     * @param {Array<string>} urls - Array of image URLs to try
     * @returns {Promise<string>}
     */
    function firstReachableImage(urls) {
        return new Promise(resolve => {
            let index = 0;
            const img = new Image();

            const tryNext = () => {
                if (index >= urls.length) {
                    return resolve(urls[urls.length - 1] || DEFAULT_IMG);
                }
                const url = urls[index++];
                img.onload = () => resolve(url);
                img.onerror = tryNext;
                img.src = url;
            };

            tryNext();
        });
    }

    /**
     * Parses interests/focus field into array of unique items
     * @param {string|Array} value - The interests value (string, array, or null)
     * @returns {Array<string>}
     */
    function parseInterests(value) {
        if (!value) return [];

        let items;
        if (Array.isArray(value)) {
            items = value.map(s => String(s).trim()).filter(Boolean);
        } else {
            items = String(value)
                .split(/[,;|\n]/)
                .map(s => s.trim())
                .filter(Boolean);
        }

        // Remove duplicates (case-insensitive)
        const seen = new Set();
        return items.filter(item => {
            const key = item.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Renders contact information
     * @param {Object} person - Person object with contact fields
     * @param {HTMLElement} listElement - The UL element to populate
     */
    function renderContactInfo(person, listElement) {
        listElement.innerHTML = '';

        if (person.email) {
            const li = document.createElement('li');
            li.appendChild(createExternalLink(`mailto:${person.email}`, person.email));
            listElement.appendChild(li);
        }

        if (person.phone) {
            const li = document.createElement('li');
            li.textContent = person.phone;
            listElement.appendChild(li);
        }

        // Check both 'lanl' and 'lanl_profile' for compatibility
        const lanlUrl = person.lanl || person.lanl_profile;
        if (lanlUrl) {
            const li = document.createElement('li');
            li.appendChild(createExternalLink(lanlUrl, 'LANL Profile'));
            listElement.appendChild(li);
        }

        if (person.scholar) {
            const li = document.createElement('li');
            li.appendChild(createExternalLink(person.scholar, 'Google Scholar'));
            listElement.appendChild(li);
        }

        if (person.ads) {
            const li = document.createElement('li');
            li.appendChild(createExternalLink(person.ads, 'NASA ADS'));
            listElement.appendChild(li);
        }
    }

    /**
     * Loads HTML content from a URL into a DOM element
     * @param {string} selector - CSS selector for target element
     * @param {string} url - URL of the HTML partial to load
     */
    async function loadPartial(selector, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load ${url}: ${response.statusText}`);
            }
            const html = await response.text();
            const element = document.querySelector(selector);
            if (element) {
                element.innerHTML = html;
            }
        } catch (error) {
            console.error('Error loading partial:', error);
        }
    }

    /**
     * Synchronizes strap background height with top bar
     */
    function syncStrapHeight() {
        const topBar = document.querySelector('.page-strap .top-bar');
        const strapBg = document.querySelector('.page-strap .strap-bg');
        if (topBar && strapBg) {
            strapBg.style.height = topBar.offsetHeight + 'px';
        }
    }

    /**
     * Initializes strap height syncing on load and resize
     */
    function initStrapSync() {
        window.addEventListener('load', syncStrapHeight);
        window.addEventListener('resize', syncStrapHeight);
    }

    /**
     * Shows an error message when a profile is not found
     * @param {string} backUrl - URL to navigate back to
     * @param {string} backText - Text for the back link
     */
    function showProfileNotFound(backUrl, backText = 'Go Back') {
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <h2>Profile Not Found</h2>
                <p>The requested profile could not be found.</p>
                <p><a href="${backUrl}">&larr; ${backText}</a></p>
            `;
        }
    }

    // Public API
    return {
        createExternalLink,
        fetchYAML,
        formatNameFromSlug,
        imageCandidates,
        firstReachableImage,
        parseInterests,
        renderContactInfo,
        loadPartial,
        syncStrapHeight,
        initStrapSync,
        showProfileNotFound
    };
})();
