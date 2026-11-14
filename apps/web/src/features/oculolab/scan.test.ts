import { describe, expect, it } from 'vitest';
import { shapeStats } from '@oculo/shared-types';
import { boxBlur, pixelsToRadiiMm, pullContour, traceContour, type GrayImage } from './scan';

/**
 * Photo synthétique : feuille blanche, cercle de monture ovale foncé
 * (intérieur 2a × 2b px, épaisseur 10 px), et une croix imprimée au centre du
 * verre de démo, comme sur les vrais verres de présentation.
 */
function syntheticFrame(a: number, b: number, opts: { noise?: number } = {}): GrayImage {
  const w = 400, h = 300, cx = 200, cy = 150;
  const data = new Float32Array(w * h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * (opts.noise ?? 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inner = ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2;
      const outer = ((x - cx) / (a + 10)) ** 2 + ((y - cy) / (b + 10)) ** 2;
      let v = 235;
      if (inner > 1 && outer <= 1) v = 40; // cercle de la monture
      if ((Math.abs(x - cx) < 2 && Math.abs(y - cy) < 25) || (Math.abs(y - cy) < 2 && Math.abs(x - cx) < 25)) v = 90; // croix
      data[y * w + x] = v + rnd();
    }
  }
  return { w, h, data: boxBlur(boxBlur(data, w, h), w, h), factor: 1 };
}

describe('détection de contour', () => {
  it('retrouve le bord intérieur du cercle, pas le bord extérieur ni la croix', () => {
    const g = syntheticFrame(120, 80, { noise: 20 });
    const res = traceContour(g, { x: 200, y: 150 }, { minR: 10, maxR: 145 });
    // Angle 0 : rayon ≈ a ; angle 90° : rayon ≈ b (bord intérieur, à ±3 px).
    expect(res.radii[0]).toBeGreaterThan(116);
    expect(res.radii[0]).toBeLessThan(124);
    expect(res.radii[90]).toBeGreaterThan(76);
    expect(res.radii[90]).toBeLessThan(84);
    expect(res.confidence).toBeGreaterThan(80);
  });

  it('convertit en mm avec la bonne échelle (4 px/mm → 60 × 40 mm)', () => {
    const g = syntheticFrame(120, 80);
    const res = traceContour(g, { x: 200, y: 150 }, { minR: 10, maxR: 145 });
    const st = shapeStats(pixelsToRadiiMm(res.radii, 4, false));
    expect(st.a).toBeGreaterThan(59);
    expect(st.a).toBeLessThan(61.5);
    expect(st.b).toBeGreaterThan(39);
    expect(st.b).toBeLessThan(41.5);
  });

  it('point de départ décentré : la forme reste la même', () => {
    const g = syntheticFrame(120, 80);
    const res = traceContour(g, { x: 230, y: 160 }, { minR: 10, maxR: 160 });
    const st = shapeStats(pixelsToRadiiMm(res.radii, 4, false));
    expect(st.a).toBeCloseTo(60, 0);
    expect(st.b).toBeCloseTo(40, 0);
  });
});

describe('retouche', () => {
  it('tire le contour localement sans toucher le côté opposé', () => {
    const r = new Array(360).fill(100);
    const out = pullContour(r, 0, 120);
    expect(out[0]).toBeCloseTo(120);
    expect(out[180]).toBeCloseTo(100);
  });
});
