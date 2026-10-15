// Apply saved theme + language before first paint (no flash of the wrong theme)
try {
  var t = localStorage.getItem('theme') || 'system';
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
  var l = localStorage.getItem('lang');
  if (l === 'ur') { document.documentElement.lang = 'ur'; document.documentElement.dir = 'rtl'; }
} catch (e) {}
