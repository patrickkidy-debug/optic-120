/**
 * Voix du conseiller, côté navigateur.
 *
 * - Reconnaissance : Web Speech API (Chrome, Edge, Android). Continue, avec
 *   résultats intermédiaires pour détecter qu'on interrompt l'assistant.
 * - Synthèse : speechSynthesis, une phrase après l'autre pendant que la réponse
 *   s'écrit (le premier mot part sans attendre la fin).
 * Le micro ne s'ouvre que sur action explicite ; aucun enregistrement audio.
 */

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
};

const Ctor = (): (new () => Rec) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const canRecognize = () => typeof window !== 'undefined' && Ctor() !== null;
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

const LOCALE: Record<string, string> = { fr: 'fr-FR', en: 'en-US', pt: 'pt-PT' };

/** Meilleure voix disponible pour la langue (voix « naturelles » en priorité). */
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  const rank = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 3 : 0) + (/denise|vivienne|henri|amelie|thomas/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
  return voices.sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

/** Texte prononçable : sans markdown, emoji, ni URL. */
export function speakable(s: string): string {
  return s
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>|~]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) ?? [];

export interface VoiceHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  /** Le visiteur parle pendant que l'assistant parle : on lui cède la parole. */
  onBargeIn: () => void;
  onSpeakingChange: (speaking: boolean) => void;
  onError: (code: 'not-allowed' | 'no-device' | 'network' | 'unsupported' | 'other') => void;
}

export class VoiceEngine {
  private rec: Rec | null = null;
  private listening = false;
  private queue: string[] = [];
  private pending = '';
  private speakingNow = false;
  private recentSpoken = '';
  private voice: SpeechSynthesisVoice | null = null;
  ttsEnabled = true;

  constructor(private lang: string, private h: VoiceHandlers) {
    if (canSpeak()) {
      const load = () => (this.voice = pickVoice(lang));
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  get isSpeaking() {
    return this.speakingNow || this.queue.length > 0;
  }

  /* ---------- Écoute ---------- */

  startListening(): void {
    const C = Ctor();
    if (!C) return this.h.onError('unsupported');
    this.listening = true;
    if (this.rec) return;
    const rec = new C();
    rec.lang = LOCALE[this.lang] ?? 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript.trim();
        if (!t) continue;
        if (this.isEcho(t)) continue;
        if (r.isFinal) {
          this.h.onInterim('');
          this.h.onFinal(t);
        } else interim += `${t} `;
      }
      interim = interim.trim();
      if (interim) {
        this.h.onInterim(interim);
        // Interruption : quelques mots du visiteur pendant que l'assistant parle.
        if (this.isSpeaking && words(interim).length >= 2) {
          this.stopSpeaking();
          this.h.onBargeIn();
        }
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.listening = false;
        this.h.onError('not-allowed');
      } else if (e.error === 'audio-capture') {
        this.listening = false;
        this.h.onError('no-device');
      } else if (e.error === 'network') this.h.onError('network');
      else this.h.onError('other');
    };
    // Chrome coupe la reconnaissance après un silence : on relance tant qu'on écoute.
    rec.onend = () => {
      this.rec = null;
      if (this.listening) setTimeout(() => this.listening && this.startListening(), 250);
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      /* déjà démarrée */
    }
  }

  stopListening(): void {
    this.listening = false;
    this.rec?.abort();
    this.rec = null;
    this.h.onInterim('');
  }

  get isListening() {
    return this.listening;
  }

  /**
   * Écho : le micro capte la voix de l'assistant. Si l'essentiel des mots
   * entendus vient d'être prononcé par l'assistant, on ignore.
   */
  private isEcho(t: string): boolean {
    if (!this.isSpeaking && !this.recentSpoken) return false;
    const heard = words(t);
    if (!heard.length) return true;
    const said = new Set(words(this.recentSpoken));
    const overlap = heard.filter((w) => said.has(w)).length / heard.length;
    return overlap >= 0.6;
  }

  /* ---------- Parole ---------- */

  /** Ajoute du texte en flux ; prononce chaque phrase dès qu'elle est complète. */
  feed(delta: string): void {
    if (!this.ttsEnabled || !canSpeak()) return;
    this.pending += delta;
    const re = /^([\s\S]*?[.!?…:;](?=\s|$)|[\s\S]{140,}?[,](?=\s))\s*/;
    let m;
    while ((m = re.exec(this.pending)) && m[1].trim().length > 1) {
      this.enqueue(m[1]);
      this.pending = this.pending.slice(m[0].length);
    }
  }

  /** Fin du flux : prononce le reste. */
  flush(): void {
    if (this.pending.trim()) this.enqueue(this.pending);
    this.pending = '';
    if (!this.speakingNow && this.queue.length === 0) this.h.onSpeakingChange(false);
  }

  say(text: string): void {
    this.stopSpeaking();
    this.feed(text);
    this.flush();
  }

  private enqueue(sentence: string): void {
    const s = speakable(sentence);
    if (!s) return;
    this.queue.push(s);
    if (!this.speakingNow) this.next();
  }

  private next(): void {
    const s = this.queue.shift();
    if (!s) {
      this.speakingNow = false;
      this.h.onSpeakingChange(false);
      // Garde un court instant la mémoire de ce qui a été dit (anti-écho).
      setTimeout(() => {
        if (!this.isSpeaking) this.recentSpoken = '';
      }, 1500);
      return;
    }
    this.speakingNow = true;
    this.h.onSpeakingChange(true);
    this.recentSpoken = `${this.recentSpoken} ${s}`.slice(-600);
    const u = new SpeechSynthesisUtterance(s);
    u.lang = LOCALE[this.lang] ?? 'fr-FR';
    if (this.voice) u.voice = this.voice;
    u.rate = 1.04;
    u.onend = () => this.next();
    u.onerror = () => this.next();
    window.speechSynthesis.speak(u);
  }

  stopSpeaking(): void {
    this.queue = [];
    this.pending = '';
    this.speakingNow = false;
    if (canSpeak()) window.speechSynthesis.cancel();
    this.h.onSpeakingChange(false);
  }

  destroy(): void {
    this.stopListening();
    this.stopSpeaking();
  }
}
