import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PlayCircle,
  CheckCircle2,
  MessageCircle,
  ArrowRight,
  Clock,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { DEMO_VIDEOS, DEMO_VIDEO_COUNT } from '../../features/demo/videos';
import {
  getVideoProgress,
  saveVideoProgress,
  saveVideoFeedback,
  type DemoVideoProgress,
} from '../../features/demo/api';
import { demoWhatsappLink } from '../../lib/whatsapp';
import { PageLoader, Button, Badge } from '../../components/ui';

/** Fréquence d'envoi de la position : `timeupdate` tire ~4x/s, on ne garde qu'un envoi/15 s. */
const SAVE_INTERVAL_MS = 15_000;

export function DemoVideosPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaveRef = useRef(0);
  const resumedForRef = useRef<string | null>(null);

  const [activeKey, setActiveKey] = useState(DEMO_VIDEOS[0].key);
  const [feedbackSent, setFeedbackSent] = useState<Record<string, boolean>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [justFinishedAll, setJustFinishedAll] = useState(false);

  const { data: progress, isLoading } = useQuery({
    queryKey: ['demo-video-progress'],
    queryFn: getVideoProgress,
  });

  const byKey = useMemo(() => {
    const m = new Map<string, DemoVideoProgress>();
    (progress ?? []).forEach((p) => m.set(p.videoKey, p));
    return m;
  }, [progress]);

  const active = DEMO_VIDEOS.find((v) => v.key === activeKey)!;
  const activeProgress = byKey.get(activeKey);
  const completedCount = (progress ?? []).filter((p) => p.completedAt).length;
  const globalPercent = progress?.length
    ? Math.round(progress.reduce((s, p) => s + p.maxPercent, 0) / DEMO_VIDEO_COUNT)
    : 0;
  const allDone = completedCount >= DEMO_VIDEO_COUNT;

  // À l'ouverture, reprendre sur la première vidéo non terminée.
  useEffect(() => {
    if (!progress || resumedForRef.current) return;
    const next = DEMO_VIDEOS.find((v) => !byKey.get(v.key)?.completedAt);
    setActiveKey(next?.key ?? DEMO_VIDEOS[0].key);
    resumedForRef.current = 'done';
  }, [progress, byKey]);

  function flush(isNewView = false) {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.currentTime)) return;
    saveVideoProgress(activeKey, {
      positionSeconds: el.currentTime,
      durationSeconds: Number.isFinite(el.duration) ? el.duration : undefined,
      isNewView,
    });
  }

  // Sauvegarde aussi quand l'onglet passe en arrière-plan / se ferme : sans ça,
  // fermer la page juste après avoir regardé perdrait la position.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  function onLoadedMetadata() {
    const el = videoRef.current;
    const saved = byKey.get(activeKey);
    // Reprise à la seconde près — sauf si la vidéo était quasi finie.
    if (el && saved && saved.lastPositionSeconds > 0 && saved.maxPercent < 95) {
      el.currentTime = saved.lastPositionSeconds;
    }
  }

  function onTimeUpdate() {
    const now = Date.now();
    if (now - lastSaveRef.current < SAVE_INTERVAL_MS) return;
    lastSaveRef.current = now;
    flush();
  }

  async function onEnded() {
    flush();
    const wasLast = completedCount + 1 >= DEMO_VIDEO_COUNT && !byKey.get(activeKey)?.completedAt;
    await qc.invalidateQueries({ queryKey: ['demo-video-progress'] });
    if (wasLast) setJustFinishedAll(true);
  }

  async function sendFeedback(understood: 'YES' | 'UNSURE' | 'NO') {
    await saveVideoFeedback(activeKey, understood);
    setFeedbackSent((s) => ({ ...s, [activeKey]: true }));
    // « Pas compris » = signal d'achat chaud : on propose l'aide humaine tout de suite.
    if (understood === 'NO') setShowHelp(true);
    void qc.invalidateQueries({ queryKey: ['demo-video-progress'] });
  }

  const helpLink = demoWhatsappLink(
    `Bonjour, je viens de regarder la vidéo « ${active.title} » d'OculoSaaS et j'aimerais une démonstration personnalisée.`,
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-6xl">
      {/* En-tête vendeur */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Démonstration
        </span>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-content sm:text-3xl">
          Découvrez OculoSaaS en {DEMO_VIDEO_COUNT} vidéos
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-content-muted">
          Tout ce qu'il faut savoir pour gérer votre optique au quotidien. Vous pouvez arrêter et
          reprendre à tout moment : votre progression est enregistrée.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${globalPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-sm font-semibold text-content">
            {completedCount}/{DEMO_VIDEO_COUNT} vidéos — {globalPercent} %
          </span>
        </div>
      </div>

      {/* Bandeau de fin : toutes les vidéos vues */}
      {(allDone || justFinishedAll) && (
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border-2 border-primary bg-gradient-to-br from-primary-soft to-surface p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
            <div>
              <p className="font-display text-lg font-bold text-content">
                Vous avez tout vu — prêt à démarrer ?
              </p>
              <p className="mt-0.5 text-sm text-content-muted">
                Activez votre abonnement et commencez à gérer votre magasin dès aujourd'hui.
              </p>
            </div>
          </div>
          <Button className="shrink-0" onClick={() => navigate('/onboarding/complete')}>
            Activer mon abonnement <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Lecteur */}
        <div>
          <div className="overflow-hidden rounded-2xl border bg-black">
            <video
              key={active.key}
              ref={videoRef}
              className="aspect-video w-full"
              controls
              playsInline
              preload="none"
              poster={active.poster}
              onLoadedMetadata={onLoadedMetadata}
              onPlay={() => flush(true)}
              onTimeUpdate={onTimeUpdate}
              onPause={() => flush()}
              onEnded={() => void onEnded()}
            >
              <source src={active.src} type="video/mp4" />
            </video>
          </div>

          <div className="mt-4">
            <h2 className="font-display text-lg font-bold text-content">{active.title}</h2>
            <p className="mt-1 text-sm text-content-muted">{active.benefit}</p>
          </div>

          {/* Questionnaire — une seule question, jamais bloquant */}
          <div className="mt-5 rounded-2xl border bg-surface p-4">
            {feedbackSent[activeKey] || activeProgress?.understood ? (
              <p className="text-sm text-content-muted">
                Merci pour votre retour. {' '}
                <button onClick={() => setShowHelp(true)} className="font-semibold text-primary hover:underline">
                  Besoin d'aide malgré tout ?
                </button>
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-content">
                  Cette partie est-elle claire pour vous ?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void sendFeedback('YES')}>
                    Oui, c'est clair
                  </Button>
                  <Button variant="outline" onClick={() => void sendFeedback('UNSURE')}>
                    Pas sûr
                  </Button>
                  <Button variant="outline" onClick={() => void sendFeedback('NO')}>
                    Non, j'ai besoin d'aide
                  </Button>
                </div>
              </>
            )}

            {showHelp && (
              <div className="mt-4 rounded-xl bg-primary/5 p-4">
                <p className="text-sm text-content">
                  Un membre de l'équipe vous accompagne gratuitement, en direct, sur votre propre
                  magasin.
                </p>
                <a
                  href={helpLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary mt-3 inline-flex rounded-xl px-5 py-2.5 text-sm"
                >
                  <MessageCircle className="h-4 w-4" /> Demander une démonstration personnalisée
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Chapitres */}
        <div>
          <div className="space-y-2">
            {DEMO_VIDEOS.map((v, i) => {
              const p = byKey.get(v.key);
              const done = Boolean(p?.completedAt);
              const inProgress = !done && (p?.maxPercent ?? 0) > 0;
              const isActive = v.key === activeKey;
              return (
                <button
                  key={v.key}
                  onClick={() => setActiveKey(v.key)}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition',
                    isActive ? 'border-primary bg-primary/5' : 'hover:border-primary/40',
                  )}
                >
                  <span
                    className={clsx(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold',
                      done
                        ? 'bg-[color:var(--success)]/15 text-success'
                        : isActive
                          ? 'bg-primary text-white'
                          : 'bg-surface-2 text-content-muted',
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-content">{v.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-content-faint">
                      <Clock className="h-3 w-3" /> {v.durationLabel}
                      {inProgress && <Badge tone="warning">{p!.maxPercent} %</Badge>}
                      {done && <Badge tone="success">Vue</Badge>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* CTA abonnement toujours accessible : ne jamais bloquer un client prêt à payer. */}
          <div className="mt-4 rounded-2xl border bg-surface p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-content">
              <ShieldCheck className="h-4 w-4 text-primary" /> Déjà convaincu ?
            </p>
            <p className="mt-1 text-xs text-content-muted">
              Pas besoin de finir les vidéos pour démarrer.
            </p>
            <Link
              to="/parametres/abonnement"
              className="btn-primary mt-3 flex w-full justify-center rounded-xl py-2.5 text-sm"
            >
              Activer mon abonnement
            </Link>
            <a
              href={helpLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline mt-2 flex w-full justify-center gap-2 rounded-xl py-2.5 text-sm"
            >
              <MessageCircle className="h-4 w-4" /> Démonstration personnalisée
            </a>
          </div>
        </div>
      </div>

      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-content-faint">
        <PlayCircle className="h-3.5 w-3.5" />
        Votre progression est enregistrée : revenez quand vous voulez.
      </p>
    </div>
  );
}

export default DemoVideosPage;
