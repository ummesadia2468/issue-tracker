import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, Volume2, VolumeX } from 'lucide-react';
import { api, fmtDateTime } from '../api';
import { urlBase64ToUint8Array } from '../pwa';
import { useI18n } from '../i18n';

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      o.start(t0); o.stop(t0 + 0.22);
    });
    setTimeout(() => ctx.close(), 600);
  } catch { /* browsers block sound until the user has interacted with the page */ }
}

export default function NotificationBell() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [pushOn, setPushOn] = useState(false);
  const [sound, setSound] = useState(store.get('sound', 'on') === 'on');
  const [shake, setShake] = useState(false);
  const lastId = useRef(null); const pushRef = useRef(false); const soundRef = useRef(sound); const box = useRef(null);
  pushRef.current = pushOn; soundRef.current = sound;

  const load = useCallback(async () => {
    try {
      const d = await api('/notifications');
      setData(d);
      const maxId = d.notifications.reduce((m, n) => Math.max(m, n.id), 0);
      if (lastId.current !== null && maxId > lastId.current) {
        const fresh = d.notifications.filter((n) => n.id > lastId.current && !n.is_read);
        if (fresh.length) {
          if (soundRef.current) beep();
          setShake(true); setTimeout(() => setShake(false), 2500);
          // Page-level popup only when real push is not active (otherwise the service worker shows it)
          if (!pushRef.current && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
            try { new Notification('Issue Reporter', { body: fresh[0].message, icon: '/icons/icon-192.png' }); } catch { /* ignore */ }
          }
        }
      }
      lastId.current = Math.max(lastId.current ?? 0, maxId);
    } catch { /* offline or signed out: try again next tick */ }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [load]);

  useEffect(() => { document.title = data.unread > 0 ? `(${data.unread}) Issue Reporter` : 'Issue Reporter'; }, [data.unread]);

  useEffect(() => { // is this device already subscribed to push?
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((r) => r?.pushManager.getSubscription()).then((s) => setPushOn(!!s)).catch(() => {});
  }, []);

  useEffect(() => { // close on outside click / Escape
    if (!open) return;
    const click = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, [open]);

  const enableAlerts = async () => {
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const { key } = await api('/push/key');
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
      setPushOn(true);
    } catch { setPushOn(false); /* falls back to alerts while the page is open */ }
  };

  const disableAlerts = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
    } catch { /* ignore */ }
    setPushOn(false);
  };

  const click = async (n) => {
    await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    setOpen(false); load();
    if (n.complaint_id) nav(`/complaints/${n.complaint_id}`);
  };
  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }).catch(() => {}); load(); };
  const toggleSound = () => { const n = !sound; setSound(n); store.set('sound', n ? 'on' : 'off'); if (n) beep(); };

  const alertsOn = perm === 'granted';
  return (
    <div className="relative" ref={box}>
      <button onClick={() => { setOpen(!open); if (!open) load(); }} className="btn-ghost relative !p-2" aria-label={t('Notifications') + `: ${data.unread}`} aria-expanded={open}>
        {data.unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {data.unread > 0 && <span className={`absolute -end-1 -top-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[11px] font-bold leading-[18px] text-white ${shake ? 'animate-ring' : ''}`}>{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="card absolute end-0 z-30 mt-2 w-[min(23rem,calc(100vw-2rem))] animate-pop shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-semibold">{t('Notifications')}</span>
            <div className="flex items-center gap-3">
              <button onClick={toggleSound} className="text-muted hover:text-ink" aria-label={sound ? t('Mute sound') : t('Turn sound on')} title={sound ? t('Mute sound') : t('Turn sound on')}>{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
              {data.unread > 0 && <button onClick={readAll} className="text-sm text-accent hover:underline">{t('Mark all read')}</button>}
            </div>
          </div>
          {perm !== 'unsupported' && (!alertsOn || !pushOn) && perm !== 'denied' && (
            <button onClick={enableAlerts} className="flex w-full items-center gap-3 border-b border-line bg-accent/10 px-4 py-3 text-start text-sm font-medium text-accent hover:bg-accent/15">
              <BellRing className="h-4 w-4 shrink-0" />{t('Get alerts on this device, even when the app is closed')}
            </button>
          )}
          {perm === 'denied' && <p className="border-b border-line bg-line/30 px-4 py-2.5 text-xs text-muted">{t('Alerts are blocked in your browser settings for this site.')}</p>}
          {alertsOn && pushOn && <button onClick={disableAlerts} className="w-full border-b border-line px-4 py-2 text-start text-xs text-muted hover:text-ink">{t('Alerts are on for this device. Turn off')}</button>}
          <ul className="max-h-80 overflow-y-auto">
            {data.notifications.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">{t('Nothing yet. Updates on your complaints will show up here.')}</li>}
            {data.notifications.map((n) => (
              <li key={n.id}>
                <button onClick={() => click(n)} className={`flex w-full gap-3 border-b border-line/60 px-4 py-3 text-start text-sm hover:bg-line/30 ${n.is_read ? 'text-muted' : ''}`}>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                  <span><span className={n.is_read ? '' : 'font-medium'}>{n.message}</span><span className="mt-0.5 block text-xs text-muted">{fmtDateTime(n.created_at)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
