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

  // color-mix() computes to "color(srgb r g b)". A canvas fillStyle is only guaranteed to take
  // rgb(); an engine that rejects the string keeps its previous colour without a word, so
  // normalise rather than trust every engine with Color 4 syntax on the default map.
  function cssColor(c) {
    var m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?:\s*\/\s*[\d.]+)?\)$/.exec(String(c == null ? '' : c).trim());
    return m ? 'rgb(' + m.slice(1, 4).map(function (x) { return Math.round(255 * +x); }).join(', ') + ')' : c;
  }

  var api = {
    TILE_URL: TILE_URL, ATTRIBUTION: ATTRIBUTION,
    ENTRY_MAX_ZOOM: ENTRY_MAX_ZOOM, TILE_TIMEOUT: TILE_TIMEOUT,
    TILE_MIN_DISPLAY: TILE_MIN_DISPLAY, TILE_MIN_ZOOM: TILE_MIN_ZOOM,
    parseKey: parseKey, cellRing: cellRing, clampZoom: clampZoom, fitZoom: fitZoom,
    streetMachine: streetMachine, fallbackDecision: fallbackDecision, cssColor: cssColor
  };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  /* ------------------------------------------------------- browser rendering */
  var doc = root.document;
  var active = null; // the open street session, if any

  function palette(el) {
    var cs = root.getComputedStyle(el.closest('.fd') || doc.documentElement);
    var v = function (n) { var x = cs.getPropertyValue(n).trim(); return x || '#888'; };
    // The estimate ramp is mixed from tokens (color-mix), which a custom property keeps as an
    // unresolved string no canvas can paint. The legend swatches are real elements the CSS
    // engine has resolved: read it back off them, so the canvas shows what the legend shows.
    var e = Array.prototype.map.call(doc.querySelectorAll('#fd-legend-estimate i[class*="fd-map__e"]'), function (s) {
      return cssColor(root.getComputedStyle(s).backgroundColor);
    });
    return {
      b: [v('--fd-b0'), v('--fd-b1'), v('--fd-b2'), v('--fd-b3'), v('--fd-b4')],
      e: e,
      halo: v('--fd-sel-halo'), core: v('--fd-sel-core'), loc: v('--amber'), nx: v('--muted')
    };
  }
  // A 4×4 tile of 45° lines in one colour: the canvas twin of the SVG's #fd-hatch pattern
  // (TASK-013). Built per redraw, so a theme swap re-tints it with the rest.
  function hatchPattern(color) {
    var tile = doc.createElement('canvas');
    tile.width = tile.height = 4;
    var x = tile.getContext('2d');
    x.strokeStyle = color;
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(-1, 5); x.lineTo(5, -1); // the tile's diagonal…
    x.moveTo(-1, 1); x.lineTo(1, -1); // …and the two corners that join it to its neighbours
    x.moveTo(3, 5); x.lineTo(5, 3);
    x.stroke();
    return x.createPattern(tile, 'repeat');
  }

  // ctx: { container, shared (dashboard api), latestOnly, box(), mesh(), tapAt(lat,lon),
  //        selectedKeys(), locCell(), nameOutlines(), researchView(), onEvent(kind) } with kind
  // 'ready'|'fail'|'exit'. researchView(), when non-null, is the estimate view: the mesh
  // takes the estimate ramp by slice band, and squares with no estimate are hatched.
  //        nameOutlines() → { solid, dashed } of { islands, keys }, or null (TASK-014).
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
    // Zoom by wheel and pinch as well as the buttons: the street map is the primary
    // map now, so it takes standard map gestures inside its own container.
    var view = L.map(el, { trackResize: true, fadeAnimation: !reduced, zoomAnimation: !reduced,
      scrollWheelZoom: true, zoomControl: false });
    L.control.zoom({ position: 'topright' }).addTo(view); // the on-map legend owns the bottom edge at every width
    view.setView([(box.latMin + box.latMax) / 2, (box.lonMin + box.lonMax) / 2],
      fitZoom(box, el.clientWidth || 320, el.clientHeight || 320));
    var renderer = L.canvas();
    var pal = palette(el), palKey = pal.b.join() + pal.core, lastRvKey = null;
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
      var ramp = rv ? pal.e : pal.b; // the estimate view never borrows the all-time colours
      // While a 種／属 panel outlines (TASK-016), the squares fade so the filled areas are the
      // signal; the redraw is forced on every panel change, so this tracks the panel.
      var named = ctx.nameOutlines ? ctx.nameOutlines() : null;
      var buckets = [[], [], [], [], []], nx = [];
      var unpub = {}; // base squares with no cell in the active slice → hatched, never empty
      if (rv) shared.unpublishedCells(mesh, rv).forEach(function (k) { unpub[k] = true; });
      mesh.forEach(function (mc) {
        var key = shared.meshKey(mc[0], mc[1]);
        var ring = cellRing(key, shared.cellEdges);
        if (!ring) return;
        var bi;
        if (rv) bi = !rv.cells || unpub[key] ? -1 : rv.cells[key][0]; // no public estimate
        else bi = shared.bucket(mc[2]);
        if (bi < 0) nx.push(ring); else buckets[bi].push(ring);
      });
      buckets.forEach(function (rings, i) {
        if (rings.length)
          // Semi-transparent over the pale tiles: street labels and terrain stay
          // legible under the mesh (David, PR #46 review).
          // At all-Japan zoom a cell is a few pixels wide, so its stroke covers most of it: the
          // stroke fades with the fill (planner check, TASK-016).
          fillLayers.push(multipoly(rings, { stroke: true, color: ramp[i], weight: 0.75, opacity: named ? 0.14 : .9,
            fill: true, fillColor: ramp[i], fillOpacity: named ? 0.14 : 0.7 }).addTo(view));
      });
      if (nx.length)
        fillLayers.push(multipoly(nx, { stroke: true, color: pal.nx, weight: 1, opacity: .6,
          fill: true, fillColor: hatchPattern(pal.nx), fillOpacity: named ? 0.25 : .8 }).addTo(view));
    }
    var selLayer = null, locLayer = null, nameLayer = null;
    // A 種／属 outline (TASK-014): islands as their index bbox, tile cells dissolved through
    // the shared boundaryRings — the same sets the simple map draws. With fill (TASK-016) the
    // recorded areas take the flat translucent fill instead of the stroke.
    function outlineLayers(o, color, weight, dash, fill) {
      var opts = fill
        ? { renderer: renderer, interactive: false, fill: true, fillColor: color, fillOpacity: 0.28, stroke: false }
        : { renderer: renderer, interactive: false, fill: false, stroke: true, color: color, weight: weight, dashArray: dash || null };
      return o.islands.map(function (a) { return L.rectangle([[a.bbox[0], a.bbox[2]], [a.bbox[1], a.bbox[3]]], opts); })
        .concat([multipoly(shared.boundaryRings(o.keys, shared.cellEdges), opts)]);
    }
    function drawOverlays() {
      if (selLayer) { view.removeLayer(selLayer); selLayer = null; }
      if (locLayer) { view.removeLayer(locLayer); locLayer = null; }
      if (nameLayer) { view.removeLayer(nameLayer); nameLayer = null; }
      var keys = ctx.selectedKeys();
      if (keys.length) {
        // One dissolved region outline per boundary loop (interior cell edges cancel),
        // not a stroked square per cell — same silhouette as the SVG view.
        var rings = shared.boundaryRings(keys, shared.cellEdges);
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
      // The selection's two-tone stroke; the could-be-found set dashes. The recorded areas
      // carry the flat fill under the strokes (TASK-016).
      var nm = ctx.nameOutlines ? ctx.nameOutlines() : null;
      if (nm) nameLayer = L.layerGroup([].concat(
        outlineLayers(nm.solid, pal.core, 0, null, true),
        outlineLayers(nm.solid, pal.halo, 4), outlineLayers(nm.solid, pal.core, 2),
        outlineLayers(nm.dashed, pal.halo, 4, '8 4'), outlineLayers(nm.dashed, pal.core, 2, '8 4'))).addTo(view);
    }

    buildFills();
    drawOverlays();

    m.ready(); // from here (and only here) tile URLs may be constructed
    var tiles = L.tileLayer(TILE_URL, {
      minZoom: TILE_MIN_DISPLAY, minNativeZoom: TILE_MIN_ZOOM, maxZoom: TILE_MAX_ZOOM, attribution: ATTRIBUTION,
      detectRetina: false, keepBuffer: 0, updateWhenIdle: true, updateWhenZooming: false
    });
    var loaded = 0, errored = 0, watchdog = null, settled = false;
    var themeObs = null, sizeObs = null;
    // Container resizes that are not window resizes (the workspace grid reflows across
    // 1024 px): Leaflet's trackResize only watches the window, so feed it invalidateSize.
    if (root.ResizeObserver) {
      sizeObs = new root.ResizeObserver(function () { view.invalidateSize(); });
      sizeObs.observe(el);
    }
    function close(kind) {
      if (!req.isCurrent(token)) return;
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      req.start(null); // later tile callbacks belong to a dead session
      if (themeObs) themeObs.disconnect();
      if (sizeObs) sizeObs.disconnect();
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
        var rv = ctx.researchView ? ctx.researchView() : null;
        var rvKey = rv ? rv.month + ':' + rv.kind : '';
        if (force || fresh.b.join() + fresh.core !== palKey || rvKey !== lastRvKey) {
          pal = fresh; palKey = fresh.b.join() + fresh.core; lastRvKey = rvKey;
          buildFills(); // re-bands cells for the active research slice
        }
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
  // The force flag must pass through: the dashboard forces a redraw on every filter change,
  // and estimate → estimate changes (another month, another kind, withheld) look alike to the
  // palette/slice-key comparison below. Dropping it left the previous slice on the canvas.
  api.redraw = function (force) { if (active) active.redraw(!!force); };
  api.isActive = function () { return !!active; };

  root.FungiFieldMap = api;
})(typeof window !== 'undefined' ? window : this);
