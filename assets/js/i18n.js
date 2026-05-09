/* EN/JA i18n applier.
   - EN is canonical (lives in the HTML). On first JA application, the
     original EN content is cached on the element so toggling back is exact.
   - JSON shape: { _global: {...}, "page.<name>": {...} }. Lookups try the
     page namespace first, then _global.
   - Keys ending in `.html` are injected via innerHTML; otherwise textContent.
   - Attribute translation via `data-i18n-attr="attr:key,attr2:key2"`.
   Exposes window.kkI18n = { setLang, getLang, t, init }. */
(function () {
  var STORAGE_KEY = 'kk_lang';
  var DEFAULT_LANG = 'en';
  var SUPPORTED = ['en', 'ja'];

  function getLang() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (SUPPORTED.indexOf(stored) === -1) stored = null;
    return stored || DEFAULT_LANG;
  }

  function persistLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function pageNamespace() {
    var ns = document.documentElement.getAttribute('data-i18n-page');
    return ns || '';
  }

  function lookup(strings, ns, key) {
    if (!strings) return undefined;
    if (ns && strings[ns] && strings[ns][key] !== undefined) return strings[ns][key];
    if (strings._global && strings._global[key] !== undefined) return strings._global[key];
    return undefined;
  }

  function isHtmlKey(key) {
    return /\.html$/.test(key);
  }

  function cacheOriginalText(el) {
    if (el.dataset.i18nOrig === undefined) {
      el.dataset.i18nOrig = el.innerHTML;
    }
  }

  function restoreOriginalText(el) {
    if (el.dataset.i18nOrig !== undefined) {
      el.innerHTML = el.dataset.i18nOrig;
    }
  }

  function applyTextNode(el, key, strings, ns) {
    cacheOriginalText(el);
    var value = lookup(strings, ns, key);
    if (value === undefined) {
      console.warn('[i18n] missing key:', ns + '.' + key);
      restoreOriginalText(el);
      return;
    }
    if (isHtmlKey(key)) {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  }

  function parseAttrSpec(spec) {
    return spec.split(',').map(function (pair) {
      var parts = pair.split(':');
      return { attr: (parts[0] || '').trim(), key: (parts[1] || '').trim() };
    }).filter(function (p) { return p.attr && p.key; });
  }

  function applyAttrs(el, spec, strings, ns) {
    var pairs = parseAttrSpec(spec);
    pairs.forEach(function (p) {
      var cacheName = 'i18nOrigAttr' + p.attr.replace(/[^a-zA-Z0-9]/g, '');
      if (el.dataset[cacheName] === undefined) {
        el.dataset[cacheName] = el.getAttribute(p.attr) || '';
      }
      var value = lookup(strings, ns, p.key);
      if (value === undefined) {
        console.warn('[i18n] missing attr key:', ns + '.' + p.key);
        el.setAttribute(p.attr, el.dataset[cacheName]);
        return;
      }
      el.setAttribute(p.attr, value);
    });
  }

  function restoreAttrs(el, spec) {
    parseAttrSpec(spec).forEach(function (p) {
      var cacheName = 'i18nOrigAttr' + p.attr.replace(/[^a-zA-Z0-9]/g, '');
      if (el.dataset[cacheName] !== undefined) {
        el.setAttribute(p.attr, el.dataset[cacheName]);
      }
    });
  }

  function applyAll(lang, strings) {
    var ns = pageNamespace();
    var textNodes = document.querySelectorAll('[data-i18n]');
    var attrNodes = document.querySelectorAll('[data-i18n-attr]');

    if (lang === 'en') {
      textNodes.forEach(restoreOriginalText);
      attrNodes.forEach(function (el) {
        restoreAttrs(el, el.getAttribute('data-i18n-attr'));
      });
    } else {
      textNodes.forEach(function (el) {
        applyTextNode(el, el.getAttribute('data-i18n'), strings, ns);
      });
      attrNodes.forEach(function (el) {
        applyAttrs(el, el.getAttribute('data-i18n-attr'), strings, ns);
      });
    }

    document.documentElement.setAttribute('lang', lang);
    document.documentElement.classList.toggle('lang-ja', lang === 'ja');
    syncToggle(lang);
  }

  function syncToggle(lang) {
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      var active = btn.getAttribute('data-lang') === lang;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    persistLang(lang);
    var strings = window.__i18n;
    if (lang === 'ja' && !strings) {
      // Lazy-load on first JA request
      fetchStrings().then(function (s) {
        window.__i18n = s;
        applyAll(lang, s);
      });
      return;
    }
    applyAll(lang, strings);
  }

  function fetchStrings() {
    var url = resolveStringsUrl();
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('i18n fetch failed: ' + r.status);
      return r.json();
    });
  }

  function resolveStringsUrl() {
    // The site is flat-static (root + projects/). Resolve relative to depth.
    var path = window.location.pathname.replace(/\/[^/]*$/, '/');
    var depth = (path.match(/\//g) || []).length - 1; // segments below root
    var prefix = depth > 0 ? new Array(depth + 1).join('../') : '';
    return prefix + 'i18n/strings.ja.json';
  }

  function bindToggle() {
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var l = this.getAttribute('data-lang');
        setLang(l);
      });
    });
  }

  function t(key) {
    var ns = pageNamespace();
    var lang = getLang();
    if (lang === 'en' || !window.__i18n) return null;
    return lookup(window.__i18n, ns, key);
  }

  function init() {
    bindToggle();
    var lang = getLang();
    syncToggle(lang);
    if (lang === 'ja') {
      fetchStrings().then(function (s) {
        window.__i18n = s;
        applyAll('ja', s);
      }).catch(function (err) {
        console.warn('[i18n] failed to load JA strings:', err);
      });
    }
  }

  window.kkI18n = {
    setLang: setLang,
    getLang: getLang,
    t: t,
    init: init,
    // exported for tests
    _internal: {
      lookup: lookup,
      isHtmlKey: isHtmlKey,
      parseAttrSpec: parseAttrSpec,
      resolveStringsUrl: resolveStringsUrl,
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
