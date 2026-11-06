import { describe, expect, it } from 'vitest';
import { nearPdCompute, profileCompute, wrapCompute } from './ParamsAssistant';

describe('assistant des paramètres', () => {
  it('profil : verre vertical à 12 mm de la cornée, panto nul', () => {
    // B = 30 mm sur 300 px → 0,1 mm/px ; cornée à 120 px du verre → 12 mm.
    const r = profileCompute([{ x: 100, y: 100 }, { x: 100, y: 400 }, { x: 220, y: 250 }], 30);
    expect(r).toEqual({ panto: 0, vertex: 12 });
  });

  it('profil : bas du verre vers la joue = pantoscopique positif', () => {
    const t = Math.tan((10 * Math.PI) / 180) * 300;
    const r = profileCompute([{ x: 100, y: 100 }, { x: 100 + t, y: 400 }, { x: 260, y: 250 }], 30)!;
    expect(r.panto).toBeCloseTo(10, 0);
    // Visage tourné vers la gauche : même géométrie en miroir.
    const m = profileCompute([{ x: 500, y: 100 }, { x: 500 - t, y: 400 }, { x: 340, y: 250 }], 30)!;
    expect(m.panto).toBeCloseTo(10, 0);
  });

  it('galbe : verres alignés = 0°, verres inclinés de 10° = 10°', () => {
    expect(wrapCompute([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 60, y: 0 }, { x: 100, y: 0 }])).toBe(0);
    const dy = Math.tan((10 * Math.PI) / 180) * 40;
    expect(wrapCompute([{ x: 0, y: dy }, { x: 40, y: 0 }, { x: 60, y: 0 }, { x: 100, y: dy }])).toBeCloseTo(10, 0);
  });

  it('EP de près : 64 mm à 40 cm donne environ 60 mm', () => {
    expect(nearPdCompute(64, 12, 40)).toBeCloseTo(60.2, 1);
  });
});
