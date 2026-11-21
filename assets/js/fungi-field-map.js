/* Street adapter for the Japan fungi dashboard (/kinokomon/): Leaflet 1.9.4 (vendored
 * same-origin under /assets/vendor/leaflet/) over GSI Pale raster tiles, with the mesh
 * squares redrawn as exact JIS rectangles on a canvas renderer.
 *
 * This file is injected by assets/js/fungi-dashboard.js only when Street map is pressed,
 * so nothing here — and no tile — is requested before that. Pure helpers are exported for
 * tests/fungi_field_map.test.js. Rectangle edges are rebuilt from integer keys via the
 * dashboard's exported cellEdges, never from rounded published centres.
 */
(function (root) {
  'use strict';

  var TILE_URL = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
  // GSI's listing requires the 地理院タイル credit (linked) plus 出典：国土地理院 on the map.
  var ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a> · 出典：国土地理院 · GSI淡色地図';
  var ENTRY_MAX_ZOOM = 9;     // street mode is entered no higher than z9 (map-improvement-plan §8)
  var TILE_TIMEOUT = 12000;   // no tile at all within this: back to the SVG
  var TILE_MIN_ZOOM = 5;      // GSI Pale zoom bands (native tiles)
  var TILE_MIN_DISPLAY = 3;   // display floor: national fits land at z3-4, z5 tiles upscale
  var TILE_MAX_ZOOM = 18;

  function parseKey(key) {
    var m = /^(\d+):(\d+)$/.exec(String(key == null ? '' : key));
    return m ? { row: +m[1], col: +m[2] } : null;
  }
  // Exact WGS84 ring (SW, SE, NE, NW) for a mesh key, edges from the shared cellEdges.
  function cellRing(key, cellEdges) {
    var c = parseKey(key);
    if (!c || typeof cellEdges !== 'function') return null;
    var e = cellEdges(c.row, c.col); // [latMin, latMax, lonMin, lonMax]
    return [[e[0], e[2]], [e[0], e[3]], [e[1], e[3]], [e[1], e[2]]];
  }
  function clampZoom(z) { return Math.max(0, Math.min(ENTRY_MAX_ZOOM, z)); }
  function mercY(lat) { return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)); }
  // Largest whole web-mercator zoom that fits the box in both axes, never above the cap.
  function fitZoom(box, wPx, hPx) {
    if (!box || wPx <= 0 || hPx <= 0 || box.lonMax - box.lonMin <= 0) return clampZoom(0);
    var zx = Math.log2((wPx * 360) / (256 * (box.lonMax - box.lonMin)));
    var zy = Math.log2((hPx * 2 * Math.PI) / (256 * Math.abs(mercY(box.latMax) - mercY(box.latMin))));
    return clampZoom(Math.floor(Math.min(zx, zy)));
  }
  // Entry/exit state machine. Tile URLs may only be constructed while mode === 'street',
  // which is the budget guard: no tile request can precede the Street map press.
  function streetMachine() {
    var mode = 'svg', fallback = false;
    return {
      enter: function () { if (mode !== 'svg') return false; mode = 'loading'; fallback = false; return true; },
      ready: function () { if (mode !== 'loading') return false; mode = 'street'; return true; },
      exit: function () { if (mode === 'svg') return false; mode = 'svg'; return true; },
      fail: function () { if (mode === 'svg') return false; mode = 'svg'; fallback = true; return true; },
      state: function () { return { mode: mode, fallback: fallback }; },
      tileUrl: function (z, x, y) {
        return mode === 'street'
          ? TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y)
          : null;
      }
    };
  }
  // Blocked/failed provider: give up only when tiles fail before anything loaded; a map
  // that already shows tiles stays up through later errors.
  function fallbackDecision(loaded, errored) {
    return loaded === 0 && errored >= 3 ? 'fallback' : 'wait';
  }

  var api = {
    TILE_URL: TILE_URL, ATTRIBUTION: ATTRIBUTION,
    ENTRY_MAX_ZOOM: ENTRY_MAX_ZOOM, TILE_TIMEOUT: TILE_TIMEOUT,
    TILE_MIN_DISPLAY: TILE_MIN_DISPLAY, TILE_MIN_ZOOM: TILE_MIN_ZOOM,
    parseKey: parseKey, cellRing: cellRing, clampZoom: clampZoom, fitZoom: fitZoom,
    streetMachine: streetMachine, fallbackDecision: fallbackDecision
  };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  /* ------------------------------------------------------- browser rendering */
  var doc = root.document;
  var active = null; // the open street session, if any

  function palette(el) {
    var cs = root.getComputedStyle(el.closest('.fd') || doc.documentElement);
    var v = function (n) { var x = cs.getPropertyValue(n).trim(); return x || '#888'; };
    return {
      b: [v('--fd-b0'), v('--fd-b1'), v('--fd-b2'), v('--fd-b3'), v('--fd-b4')],
      halo: v('--fd-sel-halo'), core: v('--fd-sel-core'), loc: v('--amber'), nx: v('--muted')
    };
  }

  // ctx: { container, shared (dashboard api), latestOnly, box(), mesh(), tapAt(lat,lon),
  //        selectedKeys(), locCell(), researchView(), onEvent(kind) } with kind
  // 'ready'|'fail'|'exit'. researchView(), when present, recolours the mesh by the
  // research slice band instead of all-time counts (absent squares outline only).
  api.enter = function (ctx) {
    if (active) return false;
    var L = root.L, shared = ctx.shared;
    if (!L || !shared || !ctx.container) { ctx.onEvent('fail'); return false; }
    var m = streetMachine();
    m.enter();
    var req = ctx.latestOnly();
    var token = req.start();
    var el = ctx.container;
    el.hidden = false;
    var box = ctx.box();
    var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var view = L.map(el, { trackResize: true, fadeAnimation: !reduced, zoomAnimation: !reduced });
    view.setView([(box.latMin + box.latMax) / 2, (box.lonMin + box.lonMax) / 2],
      fitZoom(box, el.clientWidth || 320, el.clientHeight || 320));
    var renderer = L.canvas();
    var pal = palette(el), palKey = pal.b.join() + pal.core;
    var mesh = ctx.mesh();
    var fillLayers = [];

    function multipoly(rings, opts) {
      // one single-ring polygon per cell: wrapped so later cells are polygons, not holes
      return L.polygon(rings.map(function (r) { return [r]; }), Object.assign({ renderer: renderer, interactive: false }, opts));
    }
    function buildFills() {
      fillLayers.forEach(function (l) { view.removeLayer(l); });
      fillLayers = [];
      var rv = ctx.researchView ? ctx.researchView() : null;
      var buckets = [[], [], [], [], []], nx = [];
      mesh.forEach(function (mc) {
        var key = shared.meshKey(mc[0], mc[1]);
        var ring = cellRing(key, shared.cellEdges);
        if (!ring) return;
        var bi = shared.bucket(mc[2]);
        if (rv) {
          var row = rv.cells ? rv.cells[key] : null;
          bi = row ? row[0] : -1; // absent from the slice → no public estimate, outline only
        }
        if (bi < 0) nx.push(ring); else buckets[bi].push(ring);
      });
      buckets.forEach(function (rings, i) {
        if (rings.length)
          // Semi-transparent over the pale tiles: street labels and terrain stay
          // legible under the mesh (David, PR #46 review).
          fillLayers.push(multipoly(rings, { stroke: false, fill: true, fillColor: pal.b[i], fillOpacity: 0.62 }).addTo(view));
      });
      if (nx.length)
        fillLayers.push(multipoly(nx, { stroke: true, color: pal.nx, weight: 1, opacity: .35, fill: false }).addTo(view));
    }
    var selLayer = null, locLayer = null;
    function drawOverlays() {
      if (selLayer) { view.removeLayer(selLayer); selLayer = null; }
      if (locLayer) { view.removeLayer(locLayer); locLayer = null; }
      var keys = ctx.selectedKeys();
      if (keys.length) {
        var rings = keys.map(function (k) { return cellRing(k, shared.cellEdges); }).filter(Boolean);
        selLayer = L.layerGroup([
          multipoly(rings, { stroke: true, color: pal.halo, weight: 3, fill: false }),
          multipoly(rings, { stroke: true, color: pal.core, weight: 2, fill: false })
        ]).addTo(view);
      }
      var lc = ctx.locCell();
      if (lc) {
        var ring = cellRing(lc.key, shared.cellEdges);
        if (ring) locLayer = multipoly([ring], { stroke: true, color: pal.loc, weight: 2.5, fill: false }).addTo(view);
      }
    }

    buildFills();
    drawOverlays();

    m.ready(); // from here (and only here) tile URLs may be constructed
    var tiles = L.tileLayer(TILE_URL, {
      minZoom: TILE_MIN_DISPLAY, minNativeZoom: TILE_MIN_ZOOM, maxZoom: TILE_MAX_ZOOM, attribution: ATTRIBUTION,
      detectRetina: false, keepBuffer: 0, updateWhenIdle: true, updateWhenZooming: false
    });
    var loaded = 0, errored = 0, watchdog = null, settled = false;
    var themeObs = null;
    function close(kind) {
      if (!req.isCurrent(token)) return;
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      req.start(null); // later tile callbacks belong to a dead session
      if (themeObs) themeObs.disconnect();
      view.remove();
      el.hidden = true;
      active = null;
      if (kind === 'fail') m.fail(); else m.exit();
      ctx.onEvent(kind);
    }
    tiles.on('tileload', function () {
      if (!req.isCurrent(token)) return;
      loaded++;
      if (!settled) {
        settled = true;
        if (watchdog) { clearTimeout(watchdog); watchdog = null; }
        ctx.onEvent('ready');
      }
    });
    tiles.on('tileerror', function () {
      if (!req.isCurrent(token)) return;
      errored++;
      if (fallbackDecision(loaded, errored) === 'fallback') close('fail');
    });
    tiles.addTo(view);
    watchdog = setTimeout(function () {
      if (req.isCurrent(token) && loaded === 0) close('fail');
    }, TILE_TIMEOUT);
    view.on('click', function (e) { ctx.tapAt(e.latlng.lat, e.latlng.lng); });

    if (root.MutationObserver) { // theme swap re-tints the canvas fills
      themeObs = new root.MutationObserver(function () { if (active) active.redraw(true); });
      themeObs.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    var fitted = box;
    active = {
      redraw: function (force) {
        if (!active) return;
        var fresh = palette(el);
        if (force || fresh.b.join() + fresh.core !== palKey) { pal = fresh; palKey = fresh.b.join() + fresh.core; buildFills(); }
        var b = ctx.box();
        if (b !== fitted) {
          fitted = b;
          view.setView([(b.latMin + b.latMax) / 2, (b.lonMin + b.lonMax) / 2],
            fitZoom(b, el.clientWidth || 320, el.clientHeight || 320));
        }
        drawOverlays();
      },
      close: close
    };
    return true;
  };
  api.exit = function () { if (active) { active.close('exit'); return true; } return false; };
  api.redraw = function () { if (active) active.redraw(false); };
  api.isActive = function () { return !!active; };

  root.FungiFieldMap = api;
})(typeof window !== 'undefined' ? window : this);
