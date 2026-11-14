import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_SHAPES,
  TRACE_POINTS,
  estimateThickness,
  fitToBox,
  minBlankDiameter,
  mirrorRadii,
  opticalCenterOffset,
  parseOma,
  shapeStats,
  standardBlank,
  suggestIndex,
  templateRadii,
  toOma,
} from '@oculo/shared-types';

describe('gabarits', () => {
  it.each(TEMPLATE_SHAPES.filter((s) => s !== 'ROUND'))('%s respecte les cotes A × B', (shape) => {
    const st = shapeStats(templateRadii(shape, 52, 38));
    expect(st.a).toBeCloseTo(52, 0);
    expect(st.b).toBeCloseTo(38, 0);
    expect(st.ed).toBeGreaterThan(52);
  });

  it('un cercle de 50 mm a un ED de 50 mm et un périmètre de π·50', () => {
    const st = shapeStats(templateRadii('ROUND', 50, 50));
    expect(st.ed).toBeCloseTo(50, 0);
    expect(st.circumference).toBeCloseTo(Math.PI * 50, 0);
  });

  it('fitToBox remet une forme aux cotes gravées', () => {
    const st = shapeStats(fitToBox(templateRadii('OVAL', 48, 30), 54, 41));
    expect(st.a).toBeCloseTo(54, 0);
    expect(st.b).toBeCloseTo(41, 0);
  });
});

describe('miroir', () => {
  it('le miroir du miroir rend la forme droite', () => {
    const r = templateRadii('CAT_EYE', 52, 36);
    expect(mirrorRadii(mirrorRadii(r))).toEqual(r);
  });
  it('échange côté nasal et côté temporal', () => {
    const r = templateRadii('D_FRAME', 52, 36);
    const l = mirrorRadii(r);
    expect(l[0]).toBe(r[180]);
    expect(l[180]).toBe(r[0]);
  });
});

describe('centrage', () => {
  it('décentrement nasal = (A + DBL)/2 − EP mono ; vertical = hauteur − B/2', () => {
    expect(opticalCenterOffset({ a: 52, b: 38 }, 18, { monoPd: 32, height: 22 })).toEqual({ x: 3, y: 3 });
  });

  it('diamètre minimal : un cercle centré donne ED + marge, décentré donne plus', () => {
    const r = templateRadii('ROUND', 50, 50);
    expect(minBlankDiameter(r, { x: 0, y: 0 })).toBeCloseTo(52, 0);
    expect(minBlankDiameter(r, { x: 3, y: 0 })).toBeCloseTo(58, 0);
    expect(standardBlank(58)).toBe(60);
    expect(standardBlank(90)).toBeNull();
  });
});

describe('épaisseurs', () => {
  it('un indice plus élevé amincit le bord d’un verre négatif', () => {
    const a = estimateThickness(-6, 30, 1.5);
    const b = estimateThickness(-6, 30, 1.67);
    expect(b.edge).toBeLessThan(a.edge);
    // −6 D sur 30 mm en 1.5 : flèche 5,4 mm + centre 2 mm.
    expect(a.edge).toBeCloseTo(7.4, 1);
  });
  it('conseille 1.5 pour une faible correction et un indice élevé pour une forte', () => {
    expect(suggestIndex(-1, 28)).toBe(1.5);
    expect(suggestIndex(-8, 30)).toBeGreaterThanOrEqual(1.67);
  });
});

describe('format OMA', () => {
  it('aller-retour : même forme et même pont', () => {
    const r = templateRadii('PANTOS', 50, 42);
    const back = parseOma(toOma({ radii: r, dbl: 19, job: 'PCL-2026-000001' }))!;
    expect(back.dbl).toBe(19);
    expect(back.radii).toHaveLength(TRACE_POINTS);
    const a = shapeStats(r), b = shapeStats(back.radii);
    expect(b.a).toBeCloseTo(a.a, 0);
    expect(b.b).toBeCloseTo(a.b, 0);
  });
  it('écrit 36 lignes de rayons par verre en centièmes de mm', () => {
    const oma = toOma({ radii: templateRadii('ROUND', 50, 50), dbl: 20, job: 'X' });
    expect(oma.match(/^R=/gm)).toHaveLength(72);
    expect(oma).toContain('TRCFMT=1;360;E;R;F');
    expect(oma).toContain('TRCFMT=1;360;E;L;F');
    expect(oma).toMatch(/^R=2500;2500/m);
  });
  it('rejette un fichier sans tracé', () => {
    expect(parseOma('JOB="1"\r\nDBL=18')).toBeNull();
  });
});
