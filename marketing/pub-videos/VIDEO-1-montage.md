# Vidéo 1 — « Votre cabinet ressemble-t-il à ça ? » · Plan de montage (CapCut / Premiere)

**Format :** 9:16 · 1080×1920 · ~20 s. Tous les rushes sont dans `clips/` et `frames/`.

## Rushes générés (Higgsfield)
| # | Fichier | Rôle | Durée source |
|---|---------|------|--------------|
| 1 | `clips/v1-clip1-douleur.mp4` | Opticienne noyée sous les dossiers (push-in) | 5 s |
| 2 | `clips/v1-clip2-attente.mp4` | Salle d'attente, patients agacés, horloge | 5 s |
| 3 | `clips/v1-clip3-mains.mp4` | Mains, ordonnance qui glisse et tombe | 5 s |
| 4 | `clips/v1-clip4-ui.mp4` | Révélation UI glassmorphism (bleu médical) | 5 s |
| 5 | `clips/v1-clip5-solution.mp4` | Opticienne sereine, tablette, clinique moderne | 5 s |
| VO | `clips/v1-voix-off.wav` | Voix off FR (voix « Maya »), 15,5 s | — |

## Timeline (montage)
| Temps | Clip (trim) | Voix off | Texte à l'écran | Transition |
|-------|-------------|----------|-----------------|------------|
| 0,0–3,0 s | Clip 1 (0→3 s) | « Chaque jour, des dossiers qui s'accumulent. » | **Votre cabinet ressemble-t-il à ça ?** | cut |
| 3,0–6,0 s | Clip 2 (0→3 s) | « Des patients qui attendent. » | Dossiers perdus. Temps perdu. | cut |
| 6,0–9,0 s | Clip 3 (0→3 s) | « Une information qui disparaît au mauvais moment… » | …Argent perdu. | cut sec |
| 9,0–9,6 s | **NOIR** | (silence) | **Il existe une autre façon.** | flash blanc court |
| 9,6–13,0 s | Clip 4 (0→3,4 s) | « Et si tout devenait simple ? » | Tout-en-un. Sans papier. | light-sweep |
| 13,0–17,0 s | Clip 5 (0→4 s) | « OculoSaaS réunit patients, ordonnances, stocks et caisse — en un seul endroit. Clair. Rapide. Sans papier. » | — | doux |
| 17,0–20,0 s | **Carte de fin** (fond noir) | (fin VO + shimmer) | **OculoSaaS** · oculosaas.com · *Digitalisez votre cabinet* | fondu |

> Astuce : place le fichier `v1-voix-off.wav` comme piste audio dès 0,0 s — les phrases tombent naturellement sur les plans.

## Habillage
- **Texte :** blanc pur, police géométrique (Inter / SF Pro / Söhne), tiers inférieur, apparition fondu + léger blur→net.
- **Étalonnage :** clips 1–3 = chaud/désaturé (douleur) ; clips 4–5 = froid, bleu médical, propre (solution). CapCut → Ajuster → Température.
- **Transitions clés :** cut secs sur la douleur ; **flash blanc** au passage noir→UI (9,6 s) ; light-sweep doux ensuite.
- **Carte de fin :** logo OculoSaaS (dégradé violet→rose→orange) sur noir + « oculosaas.com » + CTA. (Réutilise le logo du carrousel `marketing/carousel/`.)

## Musique & SFX (à ajouter dans CapCut — bibliothèque libre de droits)
- **Musique :** tension minimale montante 0–9 s (recherche CapCut : *« cinematic tension »* / *« emotional build »*) → **break au noir** → thème premium lumineux 9,6–20 s (*« inspiring tech »* / *« uplifting piano »*).
- **SFX :** froissement/chute de papiers (clip 1 & 3), brouhaha léger + tic-tac (clip 2), **whoosh lumineux** au flash (9,6 s), clics UI cristallins (clip 4), **shimmer** sur le logo (fin).
- *Note : Higgsfield génère la voix (TTS) mais pas la musique — utilise la bibliothèque CapCut ou Epidemic/Artlist.*

## Voix off
Générée via Higgsfield (seed_audio, voix « Maya », FR, 15,5 s). Pour changer de voix/ton, on peut régénérer avec une autre voix (ex. masculine « Caspian » / « Orion », ou féminine « Elena » / « Isabella »).

## Après montage
Exporte en 1080×1920 H.264 → on peut passer la vidéo finale dans le **Virality Predictor Higgsfield** pour un score + recommandations avant diffusion.
