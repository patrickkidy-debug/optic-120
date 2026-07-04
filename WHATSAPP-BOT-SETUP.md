# 🤖 Chatbot WhatsApp OculoSaaS — Guide de configuration

Assistant commercial IA (Claude) branché sur WhatsApp via la **Meta WhatsApp Cloud API**.
Le code est déjà en place dans l'API (`apps/api/src/modules/whatsapp/`). Il ne reste qu'à
**connecter ton compte Meta et renseigner les clés** sur Render.

- **URL du webhook** : `https://api.oculosaas.com/webhooks/whatsapp`
- **Numéro visé** : +225 05 96 60 90 36

> ⚠️ **Point crucial sur le numéro.** Un numéro branché sur la Cloud API est **dédié à
> l'API** : il ne peut plus être utilisé dans l'application WhatsApp / WhatsApp Business
> normale sur un téléphone. Si tu veux garder +225 05 96 60 90 36 comme WhatsApp perso,
> utilise **un autre numéro** (une puce dédiée) pour le bot. C'est réversible mais pas
> simultané.

---

## Étape 1 — Clé IA (Anthropic / Claude)

1. Va sur https://console.anthropic.com → **API Keys** → *Create Key*.
2. Ajoute des crédits (facturation à l'usage ; un bot commercial coûte quelques centimes
   par conversation avec le modèle Haiku configuré par défaut).
3. Note la clé (commence par `sk-ant-...`).

## Étape 2 — Application Meta + WhatsApp

1. Va sur https://developers.facebook.com → **My Apps** → *Create App* → type **Business**.
2. Dans l'app, ajoute le produit **WhatsApp** (*Set up*).
3. Onglet **API Setup** :
   - Un **numéro de test** t'est fourni (utilisable tout de suite pour essayer).
   - Pour la production : **Add phone number** → enregistre ton numéro dédié
     (+225 05 96 60 90 36 ou une autre puce) et vérifie-le par SMS/appel.
   - Récupère le **Phone number ID** (identifiant du numéro expéditeur).
   - Génère un **Access token** : au début un token temporaire (24 h) pour tester ;
     pour la prod, crée un **token permanent** via un *System User* (Business Settings →
     Users → System Users → Generate token, permissions `whatsapp_business_messaging` +
     `whatsapp_business_management`).
4. Onglet **App Settings → Basic** : copie l'**App Secret** (bouton *Show*).

## Étape 3 — Variables d'environnement sur Render

Service **oculosaas-api** → *Environment* → ajoute :

| Variable | Valeur |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (étape 1) |
| `WHATSAPP_ACCESS_TOKEN` | le token Meta (étape 2.3) |
| `WHATSAPP_PHONE_NUMBER_ID` | le Phone number ID (étape 2.3) |
| `WHATSAPP_APP_SECRET` | l'App Secret (étape 2.4) |
| `WHATSAPP_VERIFY_TOKEN` | une phrase secrète de ton choix (ex. `oculo-wa-2026`) — à recopier à l'identique en étape 4 |

Optionnel (déjà des valeurs par défaut) :
- `ANTHROPIC_MODEL` (défaut `claude-haiku-4-5-20251001` — économique. Passe à
  `claude-sonnet-5` pour des réponses plus fines si besoin).
- `WHATSAPP_GRAPH_VERSION` (défaut `v21.0`).

> Tant que `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` **et** `ANTHROPIC_API_KEY`
> ne sont pas tous renseignés, le bot reste **inactif** (le webhook accepte les messages
> mais n'auto-répond pas). L'API démarre normalement dans tous les cas.

Après avoir enregistré les variables, laisse Render **redéployer** (ou *Manual Deploy*).
La migration `20260704120000_whatsapp_chatbot` crée les tables au déploiement (`migrate:deploy`).

## Étape 4 — Abonner le webhook

1. Dans l'app Meta → **WhatsApp → Configuration → Webhook** → *Edit*.
2. **Callback URL** : `https://api.oculosaas.com/webhooks/whatsapp`
3. **Verify token** : **exactement** la valeur mise dans `WHATSAPP_VERIFY_TOKEN`.
4. Clique *Verify and save* (Meta appelle le GET du webhook ; ça doit passer au vert).
5. **Subscribe** au champ **`messages`** (indispensable pour recevoir les messages).

## Étape 5 — Tester

- Envoie « Bonjour » au numéro du bot depuis un autre téléphone WhatsApp.
- Le bot doit accueillir puis poser **une question à la fois** (type d'établissement →
  collaborateurs → magasins → besoins), présenter les fonctionnalités et les prix
  (Starter 7 500 / Standard 12 000 / Growth 23 000 FCFA/mois), puis inviter à réserver
  une démo ou s'abonner sur https://oculosaas.com.

> En mode test Meta (avant vérification business), tu ne peux écrire qu'aux **numéros
> ajoutés comme testeurs** dans l'app. Pour ouvrir à tout le monde, passe l'app en **Live**
> et complète la **vérification de l'entreprise** (Business Verification).

---

## Exploitation

- **Prospects & conversations** : stockés dans les tables `WhatsappContact` et
  `WhatsappMessage` (base Render). Chaque prospect = un lead à recontacter.
- **Reprendre une conversation à la main** : passe `botPaused = true` sur le
  `WhatsappContact` concerné → le bot cesse d'auto-répondre à ce numéro (tu peux répondre
  toi-même depuis Meta / un outil). Repasse à `false` pour réactiver le bot.
- **Modifier le discours du bot** : édite le prompt dans
  `apps/api/src/modules/whatsapp/whatsapp.prompt.ts` puis redéploie.
- **Sécurité** : les webhooks sont vérifiés par signature `X-Hub-Signature-256` (App
  Secret). Ne partage jamais `WHATSAPP_ACCESS_TOKEN` ni `ANTHROPIC_API_KEY`.

## Coûts (ordre de grandeur)

- **Meta** : ~1000 conversations/mois gratuites, puis facturation par conversation
  (tarif Côte d'Ivoire).
- **Claude (Haiku)** : quelques centimes de dollar pour des dizaines de messages.
