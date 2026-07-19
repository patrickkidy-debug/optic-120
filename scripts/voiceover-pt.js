/**
 * Voix off portugaise de présentation d'OculoSaaS.
 *
 * Portugais européen : c'est la variante du Cap-Vert, de la Guinée-Bissau,
 * d'Angola et du Mozambique — « utilizador », « stock », « ecrã », pas la
 * variante brésilienne.
 *
 * ⚠️ Les affirmations ci-dessous ont été vérifiées dans le code (PLAN_CATALOG,
 * SUPPORTED_COUNTRIES). Ne pas y réintroduire :
 *   - un « essai gratuit » : trialDays vaut 0, toutes les offres sont payantes
 *     dès l'inscription ;
 *   - un prix d'appel inférieur à 7 500 FCFA (offre Starter) ;
 *   - Wave / Orange Money comme moyens de paiement des marchés lusophones :
 *     là-bas ce sont M-Pesa, Multicaixa Express, Unitel Money et Vinti4.
 *
 * Utilisation :
 *   $env:OPENAI_API_KEY="..." ; node scripts/voiceover-pt.js
 *   $env:ELEVENLABS_API_KEY="..." ; node scripts/voiceover-pt.js
 *
 * Sortie : apps/web/public/audio/pt/scene_N.mp3
 */
const fs = require('fs');
const path = require('path');

const SCENES = [
  {
    num: 1,
    text: 'Bem-vindo ao OculoSaaS, a plataforma tudo-em-um criada para simplificar a gestão diária das suas óticas e clínicas de oftalmologia em África.',
  },
  {
    num: 2,
    text: 'Acompanhe toda a sua atividade em tempo real com um painel claro e intuitivo: receitas, vendas e alertas de stock num só olhar.',
  },
  {
    num: 3,
    text: 'Registe as suas vendas e cobre aos seus clientes em segundos. O ponto de venda gera automaticamente os orçamentos e as faturas, com o logótipo do seu estabelecimento.',
  },
  {
    num: 4,
    text: 'Mantenha o controlo total do seu stock. Sejam armações, lentes ou acessórios, o OculoSaaS avisa-o automaticamente antes da rutura.',
  },
  {
    num: 5,
    text: 'Faça a gestão do percurso dos seus pacientes de ponta a ponta. Marque consultas, exames e cirurgias, sempre ligados ao processo clínico.',
  },
  {
    num: 6,
    text: 'Facilite os pagamentos com os serviços do seu país: M-Pesa, Multicaixa Express, Unitel Money ou Vinti4. Aceite também pagamentos faseados, com o saldo atualizado automaticamente.',
  },
  {
    num: 7,
    text: 'Gere várias lojas a partir de uma única conta, com os dados de cada estabelecimento devidamente separados.',
  },
  {
    num: 8,
    text: 'Atribua a cada colaborador apenas os acessos de que precisa. Caixa, ótico ou contabilista: cada função vê exatamente o que lhe compete.',
  },
  {
    num: 9,
    text: 'Analise o seu desempenho financeiro num instante. Receitas, despesas e resultado líquido, calculados automaticamente na moeda do seu país.',
  },
  {
    num: 10,
    text: 'Preços simples e transparentes, sem custos escondidos, adaptados ao tamanho do seu negócio. Ativação imediata após o pagamento, sem fidelização.',
  },
  {
    num: 11,
    text: 'Não espere mais para modernizar a sua atividade. Visite oculosaas.com e comece hoje mesmo.',
  },
];

/**
 * Spot 30 secondes — texte fourni par le fondateur.
 * Note : ce texte est en portugais BRESILIEN (« gerenciar », « estoque »,
 * « em um só lugar »). Le reste de l'application est en portugais EUROPEEN,
 * la variante du Cap-Vert, de Guinée-Bissau, d'Angola et du Mozambique.
 * Conservé tel quel car fourni explicitement.
 */
const SPOT_30S = {
  num: 'spot30',
  text:
    'Imagine uma plataforma que reúne tudo o que sua ótica ou clínica oftalmológica precisa em um só lugar. ' +
    'Conheça o OculoSaaS, a solução completa para gerenciar pacientes, consultas, estoque, vendas, finanças e muito mais, ' +
    'com rapidez, segurança e praticidade. Simplifique sua rotina, aumente sua produtividade e ofereça uma experiência ' +
    'ainda melhor aos seus clientes. Junte-se aos profissionais que já estão transformando a gestão de seus estabelecimentos. ' +
    'Conheça o OculoSaaS e acesse oculosaas.com.',
};

const OUTPUT_DIR = path.join(__dirname, '..', 'apps', 'web', 'public', 'audio', 'pt');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function run() {
  const openAiKey = process.env.OPENAI_API_KEY;
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (!openAiKey && !elevenLabsKey) {
    console.error("❌ Définissez OPENAI_API_KEY ou ELEVENLABS_API_KEY avant de lancer le script.");
    console.log('\n  $env:OPENAI_API_KEY="votre-cle" ; node scripts/voiceover-pt.js\n');
    process.exit(1);
  }

  const mode = openAiKey ? 'openai' : 'elevenlabs';
  const onlySpot = process.argv[2] === 'spot';
  const queue = onlySpot ? [SPOT_30S] : SCENES;
  console.log(`🎙️  Mode : ${mode.toUpperCase()} — ${onlySpot ? 'spot 30 s' : `voix off portugaise (${SCENES.length} scènes)`}`);

  for (const scene of queue) {
    const outputPath = path.join(OUTPUT_DIR, `scene_${scene.num}.mp3`);
    console.log(`⏳ ${scene.num}…`);

    try {
      let response;
      if (mode === 'openai') {
        response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || 'tts-1-hd',
            input: scene.text,
            voice: process.env.OPENAI_VOICE || 'onyx',
            response_format: 'mp3',
            speed: 1.0,
          }),
        });
      } else {
        // eleven_multilingual_v2 gère le portugais ; toute voix multilingue convient.
        const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgdq5TudQT8x';
        response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: { 'xi-api-key': elevenLabsKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: scene.text,
            model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        });
      }

      if (!response.ok) {
        throw new Error(`${response.status} — ${await response.text()}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      console.log(`✅ audio/pt/scene_${scene.num}.mp3 (${buffer.length} octets)`);
    } catch (error) {
      console.error(`❌ Scène ${scene.num} échouée :`, error.message);
      process.exit(1);
    }
  }

  console.log('\n🎉 Terminé. Fichiers dans apps/web/public/audio/pt/');
}

run();
