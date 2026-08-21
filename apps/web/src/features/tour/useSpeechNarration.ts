import { useCallback, useEffect, useRef, useState } from 'react';

/** `i18n.language` ('fr'/'en'/'pt') → code BCP-47 complet, mieux reconnu par les moteurs vocaux mobiles (surtout Safari iOS) que le code court seul. */
const FULL_LANG: Record<string, string> = { fr: 'fr-FR', en: 'en-US', pt: 'pt-PT' };

/** Indices de nom repérant une voix de meilleure qualité (réseau/premium) plutôt que la voix compacte embarquée par défaut. */
const QUALITY_HINTS = ['google', 'natural', 'enhanced', 'premium', 'neural'];

function fullLang(lang: string): string {
  return FULL_LANG[lang] ?? lang;
}

/**
 * Meilleure voix disponible pour la langue demandée : correspondance exacte
 * du code > simple préfixe (ex. voix "fr-CA" pour une demande "fr-FR"), puis
 * priorité aux voix dont le nom laisse deviner une meilleure qualité. `null`
 * si aucune voix ne correspond (le moteur utilisera alors sa voix par défaut).
 */
function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const short = lang.split('-')[0].toLowerCase();
  const score = (v: SpeechSynthesisVoice): number => {
    const vLang = v.lang.toLowerCase();
    let s = 0;
    if (vLang === lang.toLowerCase()) s += 10;
    else if (vLang.startsWith(short)) s += 5;
    else return -1;
    if (QUALITY_HINTS.some((hint) => v.name.toLowerCase().includes(hint))) s += 3;
    if (v.default) s += 1;
    return s;
  };
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = score(v);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return bestScore >= 0 ? best : null;
}

/**
 * Narration voix du navigateur (Web Speech API `speechSynthesis`) : gratuite,
 * sans fichier audio à héberger, fonctionne dans les langues déjà proposées
 * par OculoSaaS. Si l'API est absente (navigateur non supporté) ou l'utilisateur
 * coupe le son, l'appelant doit continuer d'afficher le texte en sous-titre —
 * cette API n'échoue jamais silencieusement, elle expose juste `supported`.
 */
export function useSpeechNarration() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('oculo_tour_muted') === '1';
    } catch {
      return false;
    }
  });
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // La liste des voix se peuple de façon asynchrone sur mobile (Android/iOS) :
  // un premier speak() avant qu'elle soit prête tombe souvent sur la voix par
  // défaut (compacte, robotique) voire échoue silencieusement. On la préchauffe
  // dès le montage et on la garde à jour.
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  /**
   * Doit être appelé de façon SYNCHRONE depuis un vrai geste utilisateur (clic,
   * touche) — voir ProductTourProvider.narrateStep. C'est aussi ce que le
   * bouton "Réécouter" appelle directement (avec le texte de l'étape
   * courante) : ça fonctionne donc même si aucune lecture n'a encore eu lieu,
   * ex. la toute première étape ouverte automatiquement sans clic préalable.
   */
  const speak = useCallback(
    (text: string, lang: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      if (muted || !text) return;
      const targetLang = fullLang(lang);
      // Re-sonde au cas où voiceschanged ne s'est pas encore déclenché sur cet
      // appareil (Safari iOS notamment) : getVoices() est idempotent et gratuit.
      if (voicesRef.current.length === 0) voicesRef.current = window.speechSynthesis.getVoices();
      const voice = pickVoice(voicesRef.current, targetLang);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voice?.lang ?? targetLang;
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [supported, muted],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem('oculo_tour_muted', next ? '1' : '0');
      } catch {
        /* stockage indisponible : le réglage ne survira pas au rechargement */
      }
      if (next && supported) window.speechSynthesis.cancel();
      return next;
    });
  }, [supported]);

  return { supported, muted, speaking, speak, stop, toggleMute };
}
