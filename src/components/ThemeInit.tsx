export default function ThemeInit() {
  const script = `
(function(){
  try {
    var t = localStorage.getItem('ems-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    } else {
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  } catch(e) {}
})();
  `.trim();
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
