const fs = require('fs');
const path = require('path');

// Textes voix off pour chacune des 11 scènes en français
const SCENES = [
  {
    num: 1,
    text: "Bienvenue sur OculoSaaS, la plateforme tout-en-un conçue pour simplifier la gestion quotidienne de vos magasins d'optique et cliniques d'ophtalmologie en Afrique de l'Ouest."
  },
  {
    num: 2,
    text: "Pilotez toute votre activité en temps réel grâce à notre tableau de bord intuitif. Suivez vos recettes, vos ventes et vos alertes de stock d'un seul coup d'œil."
  },
  {
    num: 3,
    text: "Enregistrez vos ventes et encaissez vos clients en quelques secondes. Le point de vente génère automatiquement vos devis et factures."
  },
  {
    num: 4,
    text: "Gardez un contrôle total sur vos stocks. Qu'il s'agisse de montures, de verres ou d'accessoires, OculoSaaS vous alerte automatiquement avant la rupture."
  },
  {
    num: 5,
    text: "Gérez le parcours de vos patients de A à Z. Planifiez les consultations, les contrôles et les chirurgies directement connectés à leur dossier médical."
  },
  {
    num: 6,
    text: "Facilitez les paiements de vos clients en encaissant directement par Mobile Money : Wave, Orange Money, Free Money et Wizall, de manière cent pour cent sécurisée."
  },
  {
    num: 7,
    text: "Vous gérez plusieurs agences ? Pilotez jusqu'à dix magasins d'optique sur un seul compte, tout en gardant les données parfaitement cloisonnées."
  },
  {
    num: 8,
    text: "Attribuez les bons accès à vos équipes selon leur rôle. Qu'ils soient caissiers, opticiens ou comptables, chacun accède uniquement à ce dont il a besoin."
  },
  {
    num: 9,
    text: "Analysez vos performances financières en un instant. Visualisez vos recettes, vos dépenses et votre résultat net pour prendre des décisions rapides et éclairées."
  },
  {
    num: 10,
    text: "Profitez de tarifs transparents et adaptés à votre taille, à partir de seulement deux mille cinq cents francs CFA par mois."
  },
  {
    num: 11,
    text: "N'attendez plus pour moderniser votre activité. Rendez-vous sur oculosaas.com et commencez votre essai gratuit de quatorze jours dès aujourd'hui !"
  }
];

const OUTPUT_DIR = path.join(__dirname, '..', 'apps', 'web', 'public', 'audio');

// S'assurer que le dossier de sortie existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function run() {
  const openAiKey = process.env.OPENAI_API_KEY;
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (!openAiKey && !elevenLabsKey) {
    console.error('❌ Erreur : Vous devez définir la variable d\'environnement OPENAI_API_KEY ou ELEVENLABS_API_KEY.');
    console.log('\nExemple d\'utilisation avec OpenAI :');
    console.log('  $env:OPENAI_API_KEY="votre-cle-api" ; node scripts/generate-voiceover.js\n');
    process.exit(1);
  }

  const mode = openAiKey ? 'openai' : 'elevenlabs';
  console.log(`🎙️ Mode sélectionné : ${mode.toUpperCase()}`);

  for (const scene of SCENES) {
    const filename = `scene_${scene.num}.mp3`;
    const outputPath = path.join(OUTPUT_DIR, filename);
    console.log(`⏳ Génération de la scène ${scene.num} / ${SCENES.length}...`);

    try {
      let response;
      if (mode === 'openai') {
        const voice = process.env.OPENAI_VOICE || 'onyx'; // voix masculines pro : onyx / alloy
        const model = process.env.OPENAI_MODEL || 'tts-1';

        response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            input: scene.text,
            voice: voice,
            response_format: 'mp3',
            speed: 1.0
          })
        });
      } else {
        // ElevenLabs
        const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgdq5TudQT8x'; // voix masculine "Josh" (par défaut) ou "Antoni" (ErXwobaYiN019PkySvjV)
        const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

        response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: scene.text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API a renvoyé une erreur (${response.status}) : ${errText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      console.log(`✅ Fichier écrit : apps/web/public/audio/${filename} (${buffer.length} octets)`);

    } catch (error) {
      console.error(`❌ Échec de la génération pour la scène ${scene.num} :`, error.message);
      process.exit(1);
    }
  }

  console.log('\n🎉 Génération terminée avec succès !');
  console.log('Les fichiers audios ont été stockés dans : apps/web/public/audio/');
  console.log('Ouvrez maintenant http://localhost:5173/promo-complete.html pour écouter et enregistrer.');
}

run();
