import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';

/**
 * Détection du visage (478 points dont les iris) par MediaPipe Face Landmarker,
 * exécutée DANS le navigateur : aucune image n'est envoyée à un serveur.
 *
 * Le moteur (~10 Mo de WebAssembly + modèle de 3,7 Mo) n'est chargé qu'à
 * l'ouverture de l'assistant de centrage, puis mis en cache par le navigateur.
 * Sans réseau ni WebAssembly, l'assistant reste utilisable en pose manuelle.
 */
const VERSION = '1.1.0';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type Mode = 'VIDEO' | 'IMAGE';
type Delegate = 'GPU' | 'CPU';
const cache: Partial<Record<string, Promise<FaceLandmarker>>> = {};

async function create(mode: Mode, prefer: Delegate): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: mode,
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
    outputFaceBlendshapes: false,
  });
  if (prefer === 'CPU') return FaceLandmarker.createFromOptions(fileset, options('CPU'));
  try {
    return await FaceLandmarker.createFromOptions(fileset, options('GPU'));
  } catch {
    // GPU indisponible (navigateur, appareil ancien) : repli sur le processeur.
    return FaceLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

/**
 * Photo : toujours sur le processeur. Sur certaines tablettes / téléphones
 * Android, l'accélération GPU de MediaPipe renvoie des points décalés et
 * agrandis (repères à côté des yeux) ; l'analyse d'une photo est ponctuelle,
 * la fiabilité prime sur la vitesse. Vidéo : GPU, contrôlé par
 * `videoAgreesWithCpu` et remplacé par le processeur s'il dérive.
 */
export function getLandmarker(mode: Mode, delegate: Delegate = mode === 'IMAGE' ? 'CPU' : 'GPU'): Promise<FaceLandmarker> {
  const key = `${mode}:${delegate}`;
  if (!cache[key]) {
    cache[key] = create(mode, delegate).catch((e) => {
      delete cache[key]; // nouvel essai possible (réseau revenu)
      throw e;
    });
  }
  return cache[key]!;
}

export interface FacePoints {
  /** Points en PIXELS de l'image analysée (x, y) et profondeur relative z. */
  pts: { x: number; y: number; z: number }[];
  /** Matrice de transformation du visage (rotation de la tête), colonne par colonne. */
  matrix: number[] | null;
}

export function toFacePoints(res: FaceLandmarkerResult, w: number, h: number): FacePoints | null {
  const lm = res.faceLandmarks?.[0];
  if (!lm || lm.length < 478) return null; // les iris (468-477) sont indispensables
  return {
    pts: lm.map((p) => ({ x: p.x * w, y: p.y * h, z: p.z * w })),
    matrix: res.facialTransformationMatrixes?.[0]?.data ? Array.from(res.facialTransformationMatrixes[0].data) : null,
  };
}

/**
 * Analyse d'une image fixe (photo capturée ou importée). L'image est posée au
 * centre d'un carré avant détection (pas de déformation possible selon le
 * format portrait / paysage de l'appareil), puis les points sont ramenés dans
 * le repère de la photo.
 */
export async function detectImage(
  source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement,
  delegate: Delegate = 'CPU',
): Promise<FacePoints | null> {
  const lm = await getLandmarker('IMAGE', delegate);
  const w = source instanceof HTMLImageElement ? source.naturalWidth : source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight : source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  const side = Math.max(w, h);
  const k = Math.min(1, 1600 / side);
  const S = Math.round(side * k);
  const dx = (S - w * k) / 2;
  const dy = (S - h * k) / 2;
  const sq = document.createElement('canvas');
  sq.width = S;
  sq.height = S;
  const ctx = sq.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);
  ctx.drawImage(source, dx, dy, w * k, h * k);
  const fp = toFacePoints(lm.detect(sq), S, S);
  if (!fp) return null;
  return {
    pts: fp.pts.map((p) => ({ x: (p.x - dx) / k, y: (p.y - dy) / k, z: p.z / k })),
    matrix: fp.matrix,
  };
}

/**
 * Contrôle du suivi vidéo : compare les pupilles trouvées en direct (GPU) à
 * une analyse de la même image sur le processeur. Faux si elles divergent de
 * plus de 6 % de l'écart pupillaire : il faut alors suivre sur le processeur.
 */
export async function videoAgreesWithCpu(video: HTMLVideoElement, live: FacePoints): Promise<boolean> {
  const ref = await detectImage(video, 'CPU');
  if (!ref) return true; // rien à comparer : on ne change rien
  const pick = (f: FacePoints) => {
    const a = f.pts[468]!;
    const b = f.pts[473]!;
    return a.x <= b.x ? [a, b] : [b, a];
  };
  const [r1, l1] = pick(live);
  const [r2, l2] = pick(ref);
  const pd = Math.hypot(l2!.x - r2!.x, l2!.y - r2!.y) || 1;
  const err = Math.max(Math.hypot(r1!.x - r2!.x, r1!.y - r2!.y), Math.hypot(l1!.x - l2!.x, l1!.y - l2!.y));
  return err / pd < 0.06;
}
