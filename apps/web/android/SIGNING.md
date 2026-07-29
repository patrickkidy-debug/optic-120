# Signer l'application Android OculoSaaS (APK / AAB)

Un APK **signé avec une vraie clé de release** est bien mieux accepté par Android
qu'un APK debug ou non signé. La configuration est déjà en place dans
`app/build.gradle` : elle lit les identifiants depuis `android/keystore.properties`
(fichier **local**, ignoré par git — ne jamais le committer).

## 1. Créer la clé de signature (une seule fois)

Dans un terminal, à la racine `apps/web/android` :

```bash
keytool -genkey -v -keystore oculosaas-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias oculosaas
```

Réponds aux questions (nom, organisation…) et **note bien le mot de passe**.
⚠️ Garde ce fichier `.jks` et le mot de passe en lieu sûr : sans lui, tu ne
pourras plus publier de mise à jour de l'app sur le Play Store.

## 2. Créer `android/keystore.properties`

À côté du `.jks`, crée `apps/web/android/keystore.properties` :

```properties
storeFile=oculosaas-release.jks
storePassword=TON_MOT_DE_PASSE
keyAlias=oculosaas
keyPassword=TON_MOT_DE_PASSE
```

(Déjà dans `.gitignore` — il ne partira jamais sur GitHub.)

## 3. Générer le fichier signé

- **Android Studio** : `Build > Generate Signed Bundle / APK` → choisis
  l'existant, ou lance simplement une build *release* (elle sera signée
  automatiquement grâce à `keystore.properties`).
- **Ligne de commande** :
  ```bash
  ./gradlew assembleRelease   # APK  → app/build/outputs/apk/release/
  ./gradlew bundleRelease     # AAB  → app/build/outputs/bundle/release/
  ```

## 4. « Fichier dangereux » — comment l'éliminer vraiment

Le message « Ce type de fichier peut endommager votre appareil » au
téléchargement, et « Application dangereuse bloquée » (Play Protect), viennent du
fait que l'app est **installée hors du Play Store** (sideload). La signature
release réduit la méfiance mais **ne supprime pas totalement** cet avertissement.

Pour le retirer complètement, publie l'app sur le **Google Play Console** :

1. Compte développeur Google Play (25 $ une fois) : https://play.google.com/console
2. Téléverse l'**AAB** (`bundleRelease`).
3. Utilise un canal **test interne / fermé** : tes testeurs installent depuis le
   Play Store → **aucun avertissement**.
4. Passe en production quand tu es prêt.

C'est la seule façon 100 % fiable de ne plus voir d'alerte « dangereux ».
