# Carrousel marketing OculoSaaS

## 🖥️ Démo défilante — TOUTES les fonctionnalités (mode clair)
**`app-showcase.html`** — ouvre ce fichier dans un navigateur : c'est un **carrousel interactif** qui fait défiler les 27 écrans de l'app (mode clair), avec la vraie barre latérale (PRINCIPAL / OPTIQUE / CLINIQUE / GESTION / PARAMÈTRES).

Navigation : **flèches ← →** du clavier, **boutons** latéraux, **points** en bas (cliquables), **glisser** (swipe tactile / trackpad).

Écrans couverts : Tableau de bord + IA prédictive · Abonnement · Produits · Stock · Clients · Caisse/Vente · Ventes · Devis · Commandes de verres · SAV & réparations · Renouvellements · Étiquettes · Patients · Consultations · Rendez-vous · Chirurgies · Personnel · Finance · Fournisseurs · Assurances · Rôles & accès · Magasins & paiements · Journal d'audit · Console fondateur · Support intégré · + couverture & CTA.

> Pour enregistrer une capture d'un écran : ouvre `app-showcase.html`, va sur l'écran voulu, puis capture d'écran du navigateur.

---



Carrousel réseaux sociaux (Instagram / LinkedIn / Facebook) — **format 1200×1500 (4:5)**, exporté en **2400×3000 px (retina 2×)**, thème **clair**, données démo.

## Fichiers
- `carousel.html` — source éditable (toutes les slides, un seul fichier autonome).
- `out/slide-01.png` … `out/slide-10.png` — images prêtes à publier (dans l'ordre du carrousel).

## Ordre des slides
1. **Couverture** — accroche de marque + mockup produit.
2. **Tableau de bord & IA prédictive** — graphe Réalisé + Prévision IA, CA projeté, tendance, rupture anticipée. ⭐
3. **Caisse & Mobile Money** — point de vente, Wave / Orange / Free.
4. **Clients & fidélité** — fichier patient, points de fidélité.
5. **Ordonnances optiques** — OD/OG, sphère, cylindre, axe, PD.
6. **Stock & alertes** — inventaire temps réel, ruptures.
7. **Commandes de verres & réparations** — suivi atelier/labo.
8. **Clinique & rendez-vous** — agenda ophtalmologie.
9. **Rapports & finances** — CA, marges, top ventes.
10. **Appel à l'action** — « Utiliser le logiciel » + oculosaas.com.

## Légende prête à publier
> 👓 Opticiens & ophtalmologues d'Afrique de l'Ouest : gérez toute votre activité depuis un seul logiciel.
>
> OculoSaaS réunit caisse, stocks, clients, ordonnances, clinique et rapports — avec une **IA prédictive** qui anticipe votre chiffre d'affaires et vos ruptures de stock. 📈
>
> ✅ Paiement Mobile Money (Wave, Orange, Free…)
> ✅ Multi-magasins & multi-cliniques
> ✅ Activation immédiate, 100 % en ligne
>
> 👉 Essayez sur oculosaas.com
>
> #optique #ophtalmologie #opticien #Senegal #AfriqueDelOuest #MobileMoney #SaaS #gestion #IA #cliniqueoculaire

## Régénérer les images
1. Ouvrir `carousel.html` pour ajuster textes/chiffres.
2. Relancer le script de capture CDP (Chrome headless, port de débogage) qui screenshote chaque `.slide` en 2×.
