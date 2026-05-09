/* GitHub repo feed — live with static fallback.
   Reads username from data-gh-user on container. Static cards live in HTML;
   if the API call succeeds, replaces them with live data. */
(function () {
  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (!then) return '';
    const diff = Date.now() - then;
    const d = Math.floor(diff / 86400000);
    if (d < 1) return 'today';
    if (d < 2) return 'yesterday';
    if (d < 30) return d + 'd ago';
    if (d < 365) return Math.floor(d / 30) + 'mo ago';
    return Math.floor(d / 365) + 'y ago';
  }
  function langClass(l) {
    if (!l) return '';
    return ({
      'Python': 'py', 'TypeScript': 'ts', 'JavaScript': 'js',
      'HTML': 'html', 'Go': 'go', 'Rust': 'rust', 'Shell': 'shell',
      'Markdown': 'markdown'
    })[l] || '';
  }
  function repoIcon() {
    return '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>';
  }
  function render(grid, repos, status) {
    grid.innerHTML = repos.map(function (r) {
      const lc = langClass(r.language);
      return '<a class="gh-card" href="' + r.html_url + '" target="_blank" rel="noreferrer">'
        + '<div class="gh-card__top">' + repoIcon()
        + '<span class="repo-name">' + r.name + '</span></div>'
        + '<p class="gh-card__desc">' + (r.description || 'No description.') + '</p>'
        + '<div class="gh-card__meta">'
        + (r.language ? '<span class="lang ' + lc + '">' + r.language + '</span>' : '')
        + '<span class="stars">★ ' + (r.stargazers_count || 0) + '</span>'
        + '<span class="updated">↻ ' + timeAgo(r.pushed_at || r.updated_at) + '</span>'
        + '</div></a>';
    }).join('');
    if (status) status.dataset.state = 'live';
  }

  document.addEventListener('DOMContentLoaded', function () {
    const grid = document.querySelector('[data-gh-grid]');
    const status = document.querySelector('[data-gh-status]');
    if (!grid) return;
    const user = grid.dataset.ghUser;
    if (!user) return;
    if (status) status.dataset.state = 'loading';

    fetch('https://api.github.com/users/' + user + '/repos?per_page=30&sort=updated')
      .then(function (r) { if (!r.ok) throw new Error('api'); return r.json(); })
      .then(function (repos) {
        const filtered = repos
          .filter(function (r) { return !r.fork; })
          .sort(function (a, b) {
            return (b.stargazers_count || 0) - (a.stargazers_count || 0)
              || new Date(b.pushed_at) - new Date(a.pushed_at);
          })
          .slice(0, 6);
        if (!filtered.length) throw new Error('empty');
        render(grid, filtered, status);
      })
      .catch(function () {
        if (status) {
          status.dataset.state = 'stale';
          const t = status.querySelector('.gh-status__text');
          if (t) t.textContent = 'cached snapshot · live API unavailable';
        }
      });
  });
})();
