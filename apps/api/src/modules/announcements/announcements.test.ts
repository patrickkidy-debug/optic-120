import { describe, it, expect } from 'vitest';
import {
  ANNOUNCEMENT_KIND_LABELS,
  announcementUpsertSchema,
  defaultAnnouncementLinkedin,
  defaultAnnouncementWhatsapp,
} from '@oculo/shared-types';

describe('announcementUpsertSchema', () => {
  const valid = {
    kind: 'FEATURE' as const,
    title: 'Rapports repensés',
    body: 'Les rapports distinguent désormais le CA des encaissements.',
    images: [],
  };

  it('accepte une annonce complète', () => {
    expect(announcementUpsertSchema.safeParse(valid).success).toBe(true);
  });

  it('refuse un titre trop court', () => {
    expect(announcementUpsertSchema.safeParse({ ...valid, title: 'ab' }).success).toBe(false);
  });

  it('refuse une description vide ou trop courte', () => {
    expect(announcementUpsertSchema.safeParse({ ...valid, body: 'trop' }).success).toBe(false);
  });

  it('plafonne le nombre de visuels', () => {
    const tooMany = { ...valid, images: Array.from({ length: 7 }, (_, i) => `https://x/${i}.jpg`) };
    expect(announcementUpsertSchema.safeParse(tooMany).success).toBe(false);
  });

  it('applique FEATURE par défaut', () => {
    const parsed = announcementUpsertSchema.parse({ title: valid.title, body: valid.body });
    expect(parsed.kind).toBe('FEATURE');
    expect(parsed.images).toEqual([]);
  });

  it('nettoie les espaces autour du titre', () => {
    expect(announcementUpsertSchema.parse({ ...valid, title: '  Titre net  ' }).title).toBe('Titre net');
  });
});

describe('defaultAnnouncementWhatsapp', () => {
  it('reprend le libellé du type et le titre', () => {
    const text = defaultAnnouncementWhatsapp('IMPROVEMENT', 'Recherche plus rapide', 'Détails.');
    expect(text).toContain(ANNOUNCEMENT_KIND_LABELS.IMPROVEMENT);
    expect(text).toContain('*Amélioration OculoSaaS — Recherche plus rapide*');
    expect(text).toContain('Détails.');
  });

  /**
   * Un lien wa.me ne transporte que du texte : l'image ne peut pas être jointe.
   * Elle doit donc apparaître en lien, sinon elle serait purement et simplement
   * perdue à la diffusion.
   */
  it('ajoute le visuel en lien quand il existe', () => {
    const text = defaultAnnouncementWhatsapp('FEATURE', 'T', 'Corps.', 'https://cdn/x.jpg');
    expect(text).toContain('Aperçu : https://cdn/x.jpg');
  });

  it('n’ajoute pas de ligne vide quand il n’y a pas de visuel', () => {
    expect(defaultAnnouncementWhatsapp('FEATURE', 'T', 'Corps.')).not.toContain('Aperçu');
  });
});

describe('defaultAnnouncementLinkedin', () => {
  it('compose un post sans balisage', () => {
    const post = defaultAnnouncementLinkedin('FIX', 'Numérotation corrigée', 'Détail du correctif.');
    expect(post).toContain('Correctif OculoSaaS : Numérotation corrigée');
    expect(post).toContain('#OculoSaaS');
    // LinkedIn n'interprète pas le gras WhatsApp : aucun astérisque de balisage.
    expect(post).not.toContain('*');
  });
});
