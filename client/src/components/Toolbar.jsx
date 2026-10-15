import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme';
import { useI18n } from '../i18n';

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const { t } = useI18n();
  const items = [['light', Sun, 'Light'], ['system', Monitor, 'System'], ['dark', Moon, 'Dark']];
  return (
    <div className="seg" role="group" aria-label={t('Theme')}>
      {items.map(([m, Icon, label]) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} aria-label={t(label)} title={t(label)}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="seg" role="group" aria-label="Language">
      <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')} className="!px-3 text-xs font-semibold" aria-label="English">EN</button>
      <button type="button" aria-pressed={lang === 'ur'} onClick={() => setLang('ur')} className="!px-3 text-sm font-semibold" aria-label="اردو" lang="ur">اردو</button>
    </div>
  );
}

export const Toolbar = () => (
  <div className="flex items-center gap-2"><LangSwitch /><ThemeToggle /></div>
);

