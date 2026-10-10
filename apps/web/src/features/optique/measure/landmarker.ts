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
const cache: Partial<Record<Mode, Promise<FaceLandmarker>>> = {};

async function create(mode: Mode): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: MODEL, delegate },
    runningMode: mode,
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
    outputFaceBlendshapes: false,
  });
  try {
    return await FaceLandmarker.createFromOptions(fileset, options('GPU'));
  } catch {
    // GPU indisponible (navigateur, appareil ancien) : repli sur le processeur.
    return FaceLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

export function getLandmarker(mode: Mode): Promise<FaceLandmarker> {
  if (!cache[mode]) {
    cache[mode] = create(mode).catch((e) => {
      delete cache[mode]; // nouvel essai possible (réseau revenu)
      throw e;
    });
  }
  return cache[mode]!;
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

/** Analyse d'une image fixe (photo capturée ou importée). */
export async function detectImage(source: HTMLCanvasElement | HTMLImageElement): Promise<FacePoints | null> {
  const lm = await getLandmarker('IMAGE');
  const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  return toFacePoints(lm.detect(source), w, h);
}
