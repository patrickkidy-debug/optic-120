# 📱 Application mobile OculoSaaS (Capacitor)

L'app web est empaquetée en application **native Android/iOS** via **Capacitor**.
L'app native charge `https://oculosaas.com` → elle affiche **toujours la dernière
version** déployée (pas besoin de republier l'app à chaque mise à jour du site).

- `appId` : `com.oculosaas.app`
- `appName` : `OculoSaaS`
- Config : [`capacitor.config.ts`](./capacitor.config.ts)

---

## 🤖 Android (générer l'APK / AAB)

### Prérequis (sur ta machine, une fois)
1. Installer **Android Studio** : https://developer.android.com/studio
2. Il installe le JDK + le SDK Android nécessaires.

### Étapes
```bash
cd apps/web
npm install
npm run build        # build des assets web
npm run cap:sync     # synchronise la config vers le projet android
npm run cap:android  # ouvre le projet dans Android Studio
```
Dans **Android Studio** :
- **Tester** : bouton ▶️ (sur un émulateur ou un téléphone branché en USB, mode développeur activé).
- **Générer l'app** : menu **Build → Generate Signed Bundle / APK**
  - **AAB** (Android App Bundle) → pour publier sur le Play Store.
  - **APK** → pour installer/partager directement le fichier.
  - Crée une **clé de signature** (keystore) la première fois et **garde-la précieusement** (obligatoire pour les mises à jour).

### Publier sur le Play Store
1. Compte **Google Play Console** (frais uniques ~25 $) : https://play.google.com/console
2. Crée une application → téléverse l'**AAB** → remplis la fiche (description, captures — utilise tes visuels `/marketing.html`) → soumets.

---

## 🍎 iOS (nécessite un Mac)
iOS ne peut **pas** être généré sous Windows. Sur un **Mac** :
```bash
cd apps/web
npm install @capacitor/ios
npx cap add ios
npm run build && npx cap sync
npx cap open ios   # ouvre Xcode
```
- Xcode → Product → Archive → distribuer.
- Compte **Apple Developer** (~99 $/an) pour publier sur l'App Store.

---

## 🎨 Icône & splash screen
Pour remplacer l'icône par défaut par le logo OculoSaaS :
```bash
cd apps/web
npm install -D @capacitor/assets
# place une image 1024x1024 dans assets/icon.png puis :
npx capacitor-assets generate --android
npm run cap:sync
```

---

## 🔄 Après chaque mise à jour de la config
```bash
npm run cap:sync
```
(Le contenu de l'app vient du site en ligne, donc une simple mise à jour web
est visible immédiatement dans l'app — sans republier sur le store.)
