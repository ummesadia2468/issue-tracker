import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n';

const MAX_SECONDS = 60;
const PREFERRED = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/** Records a voice note in the browser. onChange(File | null) */
export default function VoiceRecorder({ onChange }) {
  const { t } = useI18n();
  const [state, setState] = useState('idle'); // idle | recording | done
  const [secs, setSecs] = useState(0);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const rec = useRef(null); const chunks = useRef([]); const timer = useRef(null); const stream = useRef(null);

  const supported = typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  const stopTracks = () => stream.current?.getTracks().forEach((tr) => tr.stop());
  useEffect(() => () => { clearInterval(timer.current); stopTracks(); if (url) URL.revokeObjectURL(url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setError('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow the microphone in your browser and try again.' : 'No microphone was found on this device.');
      return;
    }
    const mime = PREFERRED.find((m) => MediaRecorder.isTypeSupported?.(m));
    const r = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      clearInterval(timer.current); stopTracks();
      const type = (r.mimeType || mime || 'audio/webm').split(';')[0];
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File(chunks.current, `voice-note.${ext}`, { type });
      if (!file.size) { setState('idle'); setError('Nothing was recorded. Please try again.'); return; }
      const u = URL.createObjectURL(file);
      setUrl(u); setState('done'); onChange(file);
    };
    rec.current = r; r.start(); setSecs(0); setState('recording');
    timer.current = setInterval(() => setSecs((s) => { if (s + 1 >= MAX_SECONDS) { r.state === 'recording' && r.stop(); } return s + 1; }), 1000);
  };

  const stop = () => { if (rec.current?.state === 'recording') rec.current.stop(); };
  const reset = () => { if (url) URL.revokeObjectURL(url); setUrl(null); setState('idle'); setSecs(0); onChange(null); };
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (!supported) return <p className="rounded-md bg-line/40 px-3 py-2 text-sm text-muted">{t('Voice notes need a modern browser and a secure (https) connection.')}</p>;

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      {state === 'idle' && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={start} className="btn-ghost"><Mic className="h-4 w-4 text-accent" />{t('Record a voice note')}</button>
          <span className="text-sm text-muted">{t('Up to {n} seconds. Easier than typing.', { n: MAX_SECONDS })}</span>
        </div>
      )}
      {state === 'recording' && (
        <div className="flex items-center gap-3" role="status">
          <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-danger" /></span>
          <span className="font-mono text-lg tabular-nums" dir="ltr">{mmss(secs)} / {mmss(MAX_SECONDS)}</span>
          <button type="button" onClick={stop} className="btn-danger ms-auto"><Square className="h-4 w-4 fill-current" />{t('Stop')}</button>
        </div>
      )}
      {state === 'done' && (
        <div className="space-y-3">
          <audio controls src={url} className="w-full" />
          <div className="flex gap-2">
            <button type="button" onClick={() => { reset(); start(); }} className="btn-ghost"><RotateCcw className="h-4 w-4" />{t('Record again')}</button>
            <button type="button" onClick={reset} className="btn-ghost text-danger"><Trash2 className="h-4 w-4" />{t('Remove')}</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger" role="alert">{t(error)}</p>}
    </div>
  );
}
