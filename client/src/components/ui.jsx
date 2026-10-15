import { Loader2, AlertCircle } from 'lucide-react';
import { STATUS_LABEL, PRIORITY_LABEL } from '../api';
import { useI18n } from '../i18n';

export function StatusBadge({ status }) {
  const { t } = useI18n();
  return (
    <span className={`badge badge-${status}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(STATUS_LABEL[status])}
    </span>
  );
}

export function PriorityTag({ priority }) {
  const { t } = useI18n();
  return (
    <span className={`text-xs font-semibold ${priority === 'urgent' ? 'text-danger' : priority === 'high' ? 'text-ink' : 'text-muted'}`}>
      {t('{p} priority', { p: t(PRIORITY_LABEL[priority]) })}
    </span>
  );
}

export const Spinner = ({ className = '' }) => <Loader2 className={`animate-spin ${className}`} aria-label="Loading" />;

export const PageLoader = () => (
  <div className="space-y-4" aria-busy="true" aria-label="Loading">
    <div className="skeleton h-9 w-1/3" />
    <div className="grid gap-3 sm:grid-cols-3"><div className="skeleton h-24" /><div className="skeleton h-24" /><div className="skeleton h-24" /></div>
    <div className="skeleton h-40" />
  </div>
);

export function ErrorNote({ children }) {
  const { t } = useI18n();
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{t(String(children))}</span>
    </div>
  );
}

export function Field({ label, error, hint, children, htmlFor }) {
  const { t } = useI18n();
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-sm text-danger">{t(error)}</p> : hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export const Empty = ({ title, children }) => (
  <div className="card px-6 py-12 text-center">
    <h3 className="text-lg font-semibold">{title}</h3>
    <div className="mx-auto mt-2 max-w-sm text-sm text-muted">{children}</div>
  </div>
);

const SIZES = { 8: 'h-8 w-8', 20: 'h-20 w-20' }; // full class names so Tailwind can see them
export function Avatar({ user, size = 8 }) {
  const cls = SIZES[size] || SIZES[8];
  return user.photo
    ? <img src={user.photo} alt="" className={`${cls} rounded-full object-cover`} referrerPolicy="no-referrer" />
    : <span className={`${cls} grid place-items-center rounded-full bg-accent/15 text-sm font-semibold text-accent`}>{user.name[0]}</span>;
}
