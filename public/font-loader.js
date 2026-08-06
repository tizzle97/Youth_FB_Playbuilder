// Flips the preload-style stylesheet links (Inter, Anton/JetBrains Mono) from
// media="print" — which fetches without blocking first paint — to media="all"
// once each has actually loaded, so the fonts apply without being render
// blocking. This must be a separate file, not an inline onload="" attribute:
// CSP's script-src has no 'unsafe-inline', so an inline handler is silently
// blocked by the browser. That was the actual bug — both stylesheets stayed
// stuck at media="print" forever, so every visitor got system fonts instead
// of Anton/Inter/JetBrains Mono. See CLAUDE.md.
(function () {
  function applyStylesheet(link) {
    if (link.media !== 'all') link.media = 'all';
  }

  document.querySelectorAll('link[rel="stylesheet"][media="print"]').forEach(function (link) {
    // A cached stylesheet may have already finished loading (link.sheet is
    // set) before this script runs, in which case the 'load' event already
    // fired and a new listener would never see it.
    if (link.sheet) {
      applyStylesheet(link);
    } else {
      link.addEventListener('load', function () { applyStylesheet(link); }, { once: true });
    }
  });
})();
