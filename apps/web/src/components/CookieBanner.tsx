import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { getConsent, onConsentChange, setConsent } from '../lib/consent';
import { tr } from '../lib/tr';

/** Pas de bannière dans l'application Android : aucun traceur n'y est chargé. */
const IS_WEBVIEW = /; wv\)/.test(navigator.userAgent);

/**
 * Bannière de consentement cookies (RGPD / CNIL) : « Accepter » et « Refuser »
 * au même niveau, détail des finalités via « Personnaliser ».
 */
export function CookieBanner() {
  const [open, setOpen] = useState(() => !IS_WEBVIEW && !getConsent());
  const [custom, setCustom] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => onConsentChange(() => setOpen(!IS_WEBVIEW && !getConsent())), []);

  if (!open) return null;

  const choose = (value: boolean) => {
    setConsent(value);
    setOpen(false);
    setCustom(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={tr('ui.CookieBanner.titre')}
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl border border-line bg-surface p-4 shadow-2xl sm:bottom-5"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-content">{tr('ui.CookieBanner.titre')}</p>
          <p className="mt-1 text-content-muted">
            {tr('ui.CookieBanner.texte')}{' '}
            <Link to="/confidentialite" className="underline">
              {tr('ui.CookieBanner.enSavoirPlus')}
            </Link>
          </p>
        </div>
      </div>

      {custom && (
        <div className="mt-3 space-y-2 rounded-xl bg-surface-2 p-3 text-sm">
          <label className="flex items-center justify-between gap-3">
            <span>
              <b>{tr('ui.CookieBanner.necessaires')}</b>
              <span className="block text-xs text-content-muted">{tr('ui.CookieBanner.necessairesDesc')}</span>
            </span>
            <input type="checkbox" checked disabled className="h-4 w-4" />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <b>{tr('ui.CookieBanner.publicite')}</b>
              <span className="block text-xs text-content-muted">{tr('ui.CookieBanner.publiciteDesc')}</span>
            </span>
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="h-4 w-4" />
          </label>
        </div>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {custom ? (
          <button type="button" className="btn-primary" onClick={() => choose(marketing)}>
            {tr('ui.CookieBanner.enregistrer')}
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost text-sm" onClick={() => setCustom(true)}>
              {tr('ui.CookieBanner.personnaliser')}
            </button>
            <button type="button" className="btn-outline" onClick={() => choose(false)}>
              {tr('ui.CookieBanner.refuser')}
            </button>
            <button type="button" className="btn-primary" onClick={() => choose(true)}>
              {tr('ui.CookieBanner.accepter')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
