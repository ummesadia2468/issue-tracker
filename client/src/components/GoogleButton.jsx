import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useTheme } from '../theme';

const GoogleLogo = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
);

/**
 * "Continue with Google". Uses Google's official button when the server has a client ID.
 * Without one it shows a clear, honest placeholder instead of silently disappearing.
 */
export default function GoogleButton({ clientId, onCredential, text = 'continue_with', label = 'Continue with Google' }) {
  const { t, lang } = useI18n();
  const { resolved } = useTheme();
  const ref = useRef(null);
  // Always call the latest handler (the button is rendered once; a stale handler would use old state)
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [failed, setFailed] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const render = () => {
      if (!window.google || !ref.current) return;
      ref.current.innerHTML = '';
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => r?.credential && cb.current(r.credential), ux_mode: 'popup' });
      window.google.accounts.id.renderButton(ref.current, {
        theme: resolved === 'dark' ? 'filled_black' : 'outline', size: 'large', text, shape: 'pill',
        width: Math.min(ref.current.offsetWidth || 320, 400), locale: lang === 'ur' ? 'ur' : 'en',
      });
    };
    if (window.google?.accounts) { render(); return; }
    const existing = document.getElementById('gsi-script');
    if (existing) { existing.addEventListener('load', render); return () => existing.removeEventListener('load', render); }
    const s = document.createElement('script');
    s.id = 'gsi-script'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
    s.onload = render; s.onerror = () => setFailed(true);
    document.head.appendChild(s);
  }, [clientId, resolved, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!clientId) {
    return (
      <div>
        <button type="button" onClick={() => setHint(!hint)} className="btn-ghost w-full !rounded-full !py-3 opacity-80" aria-expanded={hint}>
          <GoogleLogo />{t(label)}
        </button>
        {hint && (
          <p className="mt-2 animate-rise rounded-md bg-line/40 px-3 py-2 text-sm text-muted">
            {t('Google sign-in is not set up yet. The site owner needs to add a Google client ID in server/.env. Use email and password for now.')}
          </p>
        )}
      </div>
    );
  }
  if (failed) return <p className="text-center text-sm text-muted">{t('Google sign-in could not load. Use email and password instead.')}</p>;
  return <div ref={ref} className="flex min-h-[44px] w-full justify-center" />;
}
