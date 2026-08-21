import { useCallback, useEffect, useRef, useState } from 'react';

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
  const lastTextRef = useRef<string>('');

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

  const speak = useCallback(
    (text: string, lang: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      lastTextRef.current = text;
      if (muted || !text) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [supported, muted],
  );

  const replay = useCallback(
    (lang: string) => {
      if (lastTextRef.current) speak(lastTextRef.current, lang);
    },
    [speak],
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

  return { supported, muted, speaking, speak, stop, replay, toggleMute };
}
