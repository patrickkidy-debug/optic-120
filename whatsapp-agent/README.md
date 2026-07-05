# Agent IA WhatsApp — OculoSaaS

Agent commercial qui se connecte à un compte WhatsApp **par QR code** (méthode
non-officielle) et répond automatiquement aux prospects avec Claude, en suivant
le script commercial d'OculoSaaS. Inclut une **page web** pour scanner le QR
(utile sur un serveur sans écran).

> ⚠️ Méthode non-officielle (contraire aux CGU WhatsApp) → risque de blocage du
> numéro. À utiliser avec modération.

---

## A. Lancer en local (test / PC allumé)

```bash
cd whatsapp-agent
npm install
```
Créer `.env` (copie de `.env.example`) avec `ANTHROPIC_API_KEY=sk-ant-...`, puis :
```bash
npm start
```
- QR affiché dans le terminal **et** sur `http://localhost:3000/?key=oculo`.
- Scanne (WhatsApp → Réglages → Appareils connectés → Connecter un appareil).
- « ✅ CONNECTED » = l'agent répond. Laisse le terminal ouvert.

---

## B. Déployer 24/7 sur Railway (recommandé)

Prérequis : compte **railway.app** (connexion via GitHub), une carte bancaire.

1. **Nouveau projet** → *Deploy from GitHub repo* → choisir le dépôt → **branche `whatsapp-agent-deploy`**.
2. Dans les **Settings** du service :
   - **Root Directory** : `whatsapp-agent`
   - Railway détecte le `Dockerfile` automatiquement.
3. **Variables** (onglet *Variables*) :
   - `ANTHROPIC_API_KEY` = ta clé `sk-ant-...`
   - `DASHBOARD_KEY` = un mot de passe de ton choix (protège la page QR)
   - `AUTH_DIR` = `/data/auth`
4. **Volume** (onglet *Volumes* / *Data*) : ajouter un volume monté sur **`/data`**
   (indispensable : garde la session WhatsApp entre les redémarrages).
5. **Deploy**. Une fois « CONNECTED » absent, ouvrir l'URL publique du service :
   `https://<ton-service>.up.railway.app/?key=<DASHBOARD_KEY>` → **scanner le QR**.
6. La page affiche « ✅ Agent connecté » → c'est fini, ça tourne 24/7.

### Variables d'environnement
| Nom | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Clé Claude (obligatoire) |
| `DASHBOARD_KEY` | Clé d'accès à la page de scan QR |
| `AUTH_DIR` | Dossier de session (sur volume, ex. `/data/auth`) |
| `ANTHROPIC_MODEL` | (optionnel) modèle Claude |
| `PORT` | injecté par l'hébergeur |

---

## Notes
- L'agent répond **uniquement en privé** (ignore groupes, statuts).
- Mémoire de conversation par prospect ; réponses « humaines » (présence + délai).
- Reconnexion automatique ; si la session expire → rescanne via la page web.
- Sécurité : ne jamais committer `.env` ni `auth/` (déjà dans `.gitignore`).
