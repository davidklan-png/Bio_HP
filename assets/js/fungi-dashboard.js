/* Japan fungi dashboard for /kinokomon/ and /ja/kinokomon/.
 * Renders /assets/data/shroomhunt/dashboard.json, which the ShroomHunt repo regenerates and
 * delivers to this site as a pull request. Pure helpers are exported for tests/fungi_dashboard.test.js.
 */
(function (root) {
  'use strict';

  var JAPAN_BOX = { lonMin: 122, lonMax: 154, latMin: 24, latMax: 46, refLat: 35 };
  var MESH_DLAT = 5 / 60;      // JIS 2nd mesh: 5 minutes of latitude
  var MESH_DLON = 7.5 / 60;    // and 7.5 minutes of longitude (about 10 km square)

  var LABELS = {
    PRESERVED_SPECIMEN: ['Preserved specimen', '標本'],
    MATERIAL_SAMPLE: ['DNA / sample', '試料・DNA'],
    HUMAN_OBSERVATION: ['Field observation', '観察記録'],
    LIVING_SPECIMEN: ['Living culture', '生体・培養株'],
    OCCURRENCE: ['Other occurrence', 'その他の記録'],
    MATERIAL_CITATION: ['Literature citation', '文献記録'],
    OBSERVATION: ['Observation', '観察'],
    MACHINE_OBSERVATION: ['Machine observation', '機械観測'],
    FOSSIL_SPECIMEN: ['Fossil', '化石'],
    species: ['To species', '種まで同定'],
    genus: ['To genus only', '属まで'],
    higher: ['Family or above', '科以上'],
    Unknown: ['Unknown', '不明']
  };
  var TRIAGE = {
    'Japanese genus-only records exist: check them': ['Check Japanese genus-only records', '国内の属止まり記録を確認'],
    'genus unrecorded in Japan': ['Genus also unrecorded in Japan', '属も国内未記録'],
    'genus known in Japan': ['Genus known in Japan', '属は国内記録あり']
  };

  function fmtInt(n) {
    return Number(n || 0).toLocaleString('en-US');
  }
  function pct(a, b) {
    if (!b) return '–';
    return Math.round((100 * a) / b) + '%';
  }
  function humanize(key) {
    var s = String(key).toLowerCase().replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function label(key, lang) {
    var pair = LABELS[key];
    if (!pair) return humanize(key);
    return lang === 'ja' ? pair[1] : pair[0];
  }
  function triage(hint, lang) {
    var pair = TRIAGE[hint];
    if (!pair) return hint;
    return lang === 'ja' ? pair[1] : pair[0];
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function lonScale() {
    return Math.cos((JAPAN_BOX.refLat * Math.PI) / 180);
  }
  function mapSize(width) {
    var s = width / ((JAPAN_BOX.lonMax - JAPAN_BOX.lonMin) * lonScale());
    return { width: width, height: Math.round((JAPAN_BOX.latMax - JAPAN_BOX.latMin) * s), scale: s };
  }
  function project(lat, lon, width, height) {
    var sx = width / ((JAPAN_BOX.lonMax - JAPAN_BOX.lonMin) * lonScale());
    var sy = height / (JAPAN_BOX.latMax - JAPAN_BOX.latMin);
    return { x: (lon - JAPAN_BOX.lonMin) * lonScale() * sx, y: (JAPAN_BOX.latMax - lat) * sy };
  }
  function bucket(n) {
    if (n < 10) return 0;
    if (n < 100) return 1;
    if (n < 1000) return 2;
    if (n < 10000) return 3;
    return 4;
  }
  // A square's key is its JIS 2nd-mesh row and column: floor(lat / 5') and floor(lon / 7.5').
  // The same function keys both the published square centres and the pointer position.
  function meshKey(lat, lon) {
    return Math.floor(lat / MESH_DLAT + 1e-9) + ':' + Math.floor(lon / MESH_DLON + 1e-9);
  }
  function isValid(d) {
    return !!(d && d.totals && typeof d.totals.records === 'number' &&
      Array.isArray(d.mesh) && Array.isArray(d.leads) && Array.isArray(d.sources));
  }

  var api = {
    JAPAN_BOX: JAPAN_BOX, fmtInt: fmtInt, pct: pct, label: label, triage: triage, esc: esc,
    mapSize: mapSize, project: project, bucket: bucket, meshKey: meshKey, isValid: isValid
  };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  /* ---------------------------------------------------------------- browser rendering */
  var doc = root.document;
  var lang = (doc.documentElement.getAttribute('lang') || 'en').indexOf('ja') === 0 ? 'ja' : 'en';
  var T = {
    records: ['records', '件'],
    species: ['species', '種'],
    square: ['~10 km square', '約10km四方'],
    loadError: ['The dashboard data could not be loaded.', 'ダッシュボードのデータを読み込めませんでした。'],
    gbifSearch: ['GBIF', 'GBIF'],
    downloaded: ['downloaded', '取得日']
  };
  function t(k) { return lang === 'ja' ? T[k][1] : T[k][0]; }
  function $(id) { return doc.getElementById(id); }

  function barRows(rows, total, fmt) {
    var max = rows.reduce(function (m, r) { return Math.max(m, r[1]); }, 0) || 1;
    return rows.map(function (r) {
      return '<div class="fd-bar"><span class="fd-bar__label">' + esc(fmt ? fmt(r[0]) : r[0]) + '</span>' +
        '<span class="fd-bar__track"><span class="fd-bar__fill" style="width:' + ((100 * r[1]) / max).toFixed(1) + '%"></span></span>' +
        '<span class="fd-bar__value">' + fmtInt(r[1]) + (total ? ' <small>' + pct(r[1], total) + '</small>' : '') + '</span></div>';
    }).join('');
  }

  function renderKpis(d) {
    var tot = d.totals;
    var k = [
      [fmtInt(tot.records), lang === 'ja' ? '国内の菌類記録' : 'fungus records from Japan'],
      [fmtInt(tot.species), lang === 'ja' ? '記録された種' : 'species recorded'],
      [pct(tot.to_species, tot.records), lang === 'ja' ? '種まで同定済み' : 'identified to species'],
      [pct(tot.georeferenced, tot.records), lang === 'ja' ? '座標付き' : 'have map coordinates'],
      [fmtInt(d.lead_totals.with_mo), lang === 'ja' ? '近隣国のみで記録（要調査）' : 'leads: recorded next door, not in Japan']
    ];
    $('fd-kpis').innerHTML = k.map(function (x) {
      return '<div class="fd-kpi"><div class="fd-kpi__value">' + esc(x[0]) + '</div><div class="fd-kpi__label">' + esc(x[1]) + '</div></div>';
    }).join('');
  }

  function renderMap(d) {
    var fig = $('fd-map');
    var svg = fig.querySelector('svg');
    var tip = fig.querySelector('.fd-map__tip');
    var cells = {};
    d.mesh.forEach(function (m) { cells[meshKey(m[0], m[1])] = m; });
    function draw() {
      // Fit the whole Japan box inside the figure, centred, whatever the card's shape.
      var W = Math.max(280, fig.clientWidth), H = Math.max(280, fig.clientHeight);
      var size = mapSize(W);
      if (size.height > H) size = { width: Math.round(W * H / size.height), height: H };
      var ox = (W - size.width) / 2, oy = (H - size.height) / 2;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      var paths = ['', '', '', '', ''];
      d.mesh.forEach(function (m) {
        var a = project(m[0] + MESH_DLAT / 2, m[1] - MESH_DLON / 2, size.width, size.height);
        var b = project(m[0] - MESH_DLAT / 2, m[1] + MESH_DLON / 2, size.width, size.height);
        var w = Math.max(2.2, b.x - a.x), h = Math.max(2.2, b.y - a.y);
        paths[bucket(m[2])] += 'M' + (a.x + ox).toFixed(1) + ' ' + (a.y + oy).toFixed(1) + 'h' + w.toFixed(1) + 'v' + h.toFixed(1) + 'h' + (-w).toFixed(1) + 'z';
      });
      svg.innerHTML = paths.map(function (p, i) { return '<path class="fd-map__b' + i + '" d="' + p + '"/>'; }).join('');
      svg.onmousemove = function (e) {
        var r = svg.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        var lat = JAPAN_BOX.latMax - (y - oy) / (size.height / (JAPAN_BOX.latMax - JAPAN_BOX.latMin));
        var lon = JAPAN_BOX.lonMin + (x - ox) / (size.width / (JAPAN_BOX.lonMax - JAPAN_BOX.lonMin));
        var m = cells[meshKey(lat, lon)];
        if (!m) { tip.hidden = true; return; }
        tip.hidden = false;
        tip.textContent = t('square') + ' · ' + fmtInt(m[2]) + ' ' + t('records') + ' · ' + fmtInt(m[3]) + ' ' + t('species');
        tip.style.left = Math.max(0, Math.min(x + 12, r.width - 230)) + 'px';
        tip.style.top = Math.max(0, y - 34) + 'px';
      };
      svg.onmouseleave = function () { tip.hidden = true; };
    }
    draw();
    if (root.ResizeObserver) { var ro = new root.ResizeObserver(draw); ro.observe(fig); }
    $('fd-map-cells').textContent = fmtInt(d.mesh.length);
    $('fd-masked').textContent = fmtInt(d.totals.sensitive_species);
  }

  function renderLeads(d) {
    var head = lang === 'ja'
      ? ['種', '科', '近隣国の記録', 'MOの記録', '次の確認']
      : ['Species', 'Family', 'Records next door', 'Mushroom Observer', 'What to check'];
    var body = d.leads.map(function (l) {
      var url = 'https://www.gbif.org/species/search?q=' + encodeURIComponent(l[0]);
      return '<tr><td><a href="' + url + '" target="_blank" rel="noopener"><i>' + esc(l[0]) + '</i></a></td><td>' + esc(l[1] || '') +
        '</td><td class="num">' + fmtInt(l[2]) + '</td><td class="num">' + fmtInt(l[3]) + '</td><td>' + esc(triage(l[4], lang)) + '</td></tr>';
    }).join('');
    $('fd-leads').innerHTML = '<thead><tr>' + head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + body + '</tbody>';
    $('fd-lead-total').textContent = fmtInt(d.lead_totals.neighbour_only);
    $('fd-lead-mo').textContent = fmtInt(d.lead_totals.with_mo);
    $('fd-lead-unres').textContent = fmtInt(d.lead_totals.with_unresolved_jp_genus);
  }

  function renderSources(d) {
    $('fd-sources').innerHTML = d.sources.map(function (s) {
      return '<li><a href="https://doi.org/' + esc(s.doi) + '" target="_blank" rel="noopener">doi.org/' + esc(s.doi) + '</a> · ' +
        fmtInt(s.records) + ' ' + t('records') + ' · ' + t('downloaded') + ' ' + esc(String(s.created || '').slice(0, 10)) + '</li>';
    }).join('');
    $('fd-generated').textContent = d.generated;
  }

  function render(d) {
    renderKpis(d);
    renderMap(d);
    $('fd-evidence').innerHTML = barRows(d.evidence.slice(0, 5), d.totals.records, function (k) { return label(k, lang); });
    $('fd-depth').innerHTML = barRows(d.id_depth, d.totals.records, function (k) { return label(k, lang); });
    $('fd-decades').innerHTML = barRows(d.decades.filter(function (r) { return r[0] >= 1950; }).reverse(), 0,
      function (y) { return lang === 'ja' ? y + '年代' : y + 's'; });
    $('fd-unresolved').innerHTML = barRows(d.unresolved_genera.slice(0, 10).map(function (g) { return [g[0], g[2]]; }), 0,
      function (g) { return g; });
    $('fd-unresolved').querySelectorAll('.fd-bar__label').forEach(function (el) { el.style.fontStyle = 'italic'; });
    renderLeads(d);
    renderSources(d);
    doc.querySelector('.fd').classList.add('is-ready');
  }

  function start() {
    var el = doc.querySelector('.fd');
    if (!el) return;
    root.fetch(el.getAttribute('data-src'), { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { if (!isValid(d)) throw new Error('invalid data'); render(d); })
      .catch(function () { $('fd-status').hidden = false; $('fd-status').textContent = t('loadError'); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : this);
