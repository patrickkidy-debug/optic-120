import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, Globe, Loader2, Mail, MapPin, Phone, Search } from 'lucide-react';
import clsx from 'clsx';
import { getFinderCountries, importFinderCandidates, searchOpticians, type FinderCandidate } from './api';
import { apiErrorMessage } from '../../lib/api';
import { Badge, Button, EmptyState, Field } from '../../components/ui';

/**
 * Agent de prospection : cherche les magasins d'optique d'une ville
 * (OpenStreetMap, et Google Maps si la clé est posée sur le serveur), lit
 * l'e-mail sur leur site, puis le fondateur choisit lesquels ajouter au CRM.
 * Le contact se fait ensuite depuis l'onglet Prospects, en un clic.
 */
export function FinderTab({ onImported }: { onImported: () => void }) {
  const qc = useQueryClient();
  const { data: meta } = useQuery({ queryKey: ['crm-finder-countries'], queryFn: getFinderCountries });
  const [country, setCountry] = useState('CI');
  const [city, setCity] = useState('');
  const [limit, setLimit] = useState(40);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof searchOpticians>> | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ created: number } | null>(null);

  const reachable = (c: FinderCandidate) => Boolean(c.phoneNormalized || c.email);
  const selectable = useMemo(() => (result?.candidates ?? []).filter((c) => !c.alreadyInCrm && reachable(c)), [result]);

  async function run() {
    setBusy(true);
    setError('');
    setDone(null);
    try {
      const r = await searchOpticians({ country, city, limit });
      setResult(r);
      setPicked(new Set(r.candidates.filter((c) => !c.alreadyInCrm && reachable(c)).map((c) => c.externalId)));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function importPicked() {
    if (!result) return;
    setImporting(true);
    try {
      const r = await importFinderCandidates(result.candidates.filter((c) => picked.has(c.externalId)));
      setDone(r);
      setResult({
        ...result,
        candidates: result.candidates.map((c) => (picked.has(c.externalId) ? { ...c, alreadyInCrm: true } : c)),
      });
      setPicked(new Set());
      void qc.invalidateQueries({ queryKey: ['crm-prospects'] });
      void qc.invalidateQueries({ queryKey: ['crm-stats'] });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setImporting(false);
    }
  }

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold text-content">Agent de prospection</h3>
            <p className="text-sm text-content-muted">
              Trouve les magasins d&apos;optique d&apos;une ville, avec téléphone, site et e-mail quand ils sont publics.
              Rien n&apos;est envoyé automatiquement : vous choisissez qui ajouter, puis vous contactez en un clic.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <Field label="Pays">
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
              {meta?.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ville (vide = tout le pays)">
            <input
              className="input"
              value={city}
              placeholder="Abidjan, Dakar, Praia…"
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && void run()}
            />
          </Field>
          <Field label="Nombre">
            <select className="input" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[20, 40, 60].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Button onClick={() => void run()} loading={busy} className="sm:mb-0.5">
            <Search className="h-4 w-4" /> Lancer la recherche
          </Button>
        </div>

        <p className="mt-3 text-xs text-content-faint">
          Sources : OpenStreetMap{meta?.google ? ' + Google Maps' : ''}.
          {!meta?.google && ' Ajoutez GOOGLE_PLACES_API_KEY sur le serveur pour beaucoup plus de numéros.'}
        </p>
      </div>

      {busy && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-content-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Recherche des magasins et lecture de leurs sites… (jusqu&apos;à 1 minute)
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {result?.errors.map((e) => (
        <p key={e} className="text-xs text-warning">{e}</p>
      ))}

      {done && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-success/10 p-3 text-sm text-content">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> {done.created} prospect(s) ajouté(s) au CRM.
          </span>
          <Button variant="outline" onClick={onImported}>Voir les prospects</Button>
        </div>
      )}

      {result && !busy && (
        result.candidates.length === 0 ? (
          <EmptyState icon={Search} title="Aucun magasin trouvé" hint="Essayez une autre ville ou laissez la ville vide." />
        ) : (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
              <label className="flex items-center gap-2 text-sm text-content">
                <input
                  type="checkbox"
                  checked={picked.size > 0 && picked.size === selectable.length}
                  onChange={(e) => setPicked(e.target.checked ? new Set(selectable.map((c) => c.externalId)) : new Set())}
                />
                {result.candidates.length} magasins trouvés · {selectable.length} nouveaux et joignables
              </label>
              <Button disabled={picked.size === 0} loading={importing} onClick={() => void importPicked()}>
                Ajouter {picked.size} au CRM
              </Button>
            </div>
            <ul className="divide-y">
              {result.candidates.map((c) => {
                const disabled = c.alreadyInCrm || !reachable(c);
                return (
                  <li key={c.externalId} className={clsx('flex items-start gap-3 p-3', disabled && 'opacity-55')}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={disabled}
                      checked={picked.has(c.externalId)}
                      onChange={() => toggle(c.externalId)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-content">{c.establishmentName}</span>
                        <Badge tone={c.origin === 'google' ? 'info' : 'neutral'}>{c.origin === 'google' ? 'Google' : 'OSM'}</Badge>
                        {c.alreadyInCrm && <Badge tone="success">Déjà dans le CRM</Badge>}
                        {!c.alreadyInCrm && !reachable(c) && <Badge tone="neutral">Ni téléphone ni e-mail</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-muted">
                        {c.phoneNormalized && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phoneNormalized}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                        {c.website && (
                          <a href={c.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                            <Globe className="h-3 w-3" />{c.website.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
                          </a>
                        )}
                        {(c.address || c.city) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.address || c.city}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
