// Runs before first paint. The theme preference is a per-browser display
// setting only; no credential or session data is ever kept in storage.
(function () {
  var pref = 'system';
  try { pref = localStorage.getItem('agastya-theme') || 'system'; } catch (e) { /* storage blocked */ }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
