import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Plus, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { Field } from '../components/ui';

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

export default function AdminQR() {
  const { t } = useI18n();
  const [base, setBase] = useState(() => load('qr_base', window.location.origin));
  const [rooms, setRooms] = useState(() => load('qr_rooms', []));
  const [b, setB] = useState(''); const [r, setR] = useState('');
  useEffect(() => { try { localStorage.setItem('qr_base', JSON.stringify(base)); localStorage.setItem('qr_rooms', JSON.stringify(rooms)); } catch { /* ignore */ } }, [base, rooms]);

  const url = (x) => `${base.replace(/\/+$/, '')}/report/new?${new URLSearchParams({ building: x.building, room: x.room })}`;
  const add = (e) => { e.preventDefault(); if (!b.trim() || !r.trim()) return; setRooms([...rooms, { building: b.trim(), room: r.trim() }]); setR(''); };
  const local = /localhost|127\.0\.0\.1/.test(base);

  return (
    <div className="animate-rise space-y-6">
      <div className="no-print">
        <h1 className="text-3xl font-bold">{t('Room QR codes')}</h1>
        <p className="mt-1 text-muted">{t('Print a code for each room. Anyone who scans it opens the report form with the room already filled in.')}</p>
      </div>

      <div className="card no-print space-y-4 p-5">
        <Field label={t('Website address used in the codes')} htmlFor="base" hint={local ? t('This points to your own computer, so phones cannot open it. Use your deployed address, or your computer\'s network address like http://192.168.1.20:5173.') : undefined}>
          <input id="base" className="input" value={base} onChange={(e) => setBase(e.target.value)} dir="ltr" />
        </Field>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label={t('Building')} htmlFor="qb"><input id="qb" className="input" placeholder={t('e.g. Block A')} value={b} onChange={(e) => setB(e.target.value)} /></Field>
          <Field label={t('Room or lab')} htmlFor="qr"><input id="qr" className="input" placeholder={t('e.g. Lab 3')} value={r} onChange={(e) => setR(e.target.value)} /></Field>
          <button className="btn-primary"><Plus className="h-4 w-4" />{t('Add room')}</button>
        </form>
        {rooms.length > 0 && <button className="btn-ghost" onClick={() => window.print()}><Printer className="h-4 w-4" />{t('Print all')}</button>}
      </div>

      {rooms.length === 0 ? <p className="no-print text-center text-sm text-muted">{t('Add a room above to generate its QR code.')}</p> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 print:grid-cols-3">
          {rooms.map((x, i) => (
            <div key={`${x.building}-${x.room}-${i}`} className="card relative break-inside-avoid p-5 text-center print:shadow-none">
              <button className="no-print absolute end-2 top-2 rounded-full p-1 text-muted hover:text-danger" onClick={() => setRooms(rooms.filter((_, j) => j !== i))} aria-label={t('Remove')}><X className="h-4 w-4" /></button>
              <div className="mx-auto w-fit rounded-lg bg-white p-3"><QRCodeSVG value={url(x)} size={150} level="M" /></div>
              <p className="mt-3 font-display text-lg font-bold">{x.building}, {x.room}</p>
              <p className="text-sm text-muted">{t('Scan to report a problem in this room')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
