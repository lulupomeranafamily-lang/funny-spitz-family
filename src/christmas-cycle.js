import fs from "node:fs";
import path from "node:path";
import { CHARACTERS } from "./characters.js";
import { produceEpisodeForLanguage } from "./produce-episode.js";
import { uploadVideoToYouTube } from "./youtube-upload.js";
import { ensureChristmasMusicMp3 } from "./christmas-music.js";

const CHRISTMAS_HISTORY_PATH = path.resolve("config/christmas_history.json");

function resolveGeminiApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const secretsFile = path.resolve("config/SECRETS_PARA_COPIAR_NO_GITHUB.txt");
  if (fs.existsSync(secretsFile)) {
    const lines = fs.readFileSync(secretsFile, "utf-8").split(/\r?\n/);
    const keyLine = lines.find((l) => l.trim().startsWith("AQ.") || l.trim().startsWith("AIza"));
    if (keyLine) return keyLine.trim();
  }
  throw new Error("Variável GEMINI_API_KEY não definida!");
}

async function generateChristmasScriptWithGemini({
  christmasDayNumber,
  cycleDate,
  suggestedChapter,
  pastEpisodes,
  isChristmasFinale
}) {
  const apiKey = resolveGeminiApiKey();
  const totalScenes = isChristmasFinale ? 12 : 9;
  const lastSceneIdx = String(totalScenes - 1).padStart(2, "0");

  const prompt = `
Você é o roteirista oficial da série especial "Especial de Natal da Funny Spitz Family" (@FunnySpitzFamily).
A família considera o Natal o evento mais importante, mágico e aguardado do ano inteiro! Cada dia esta série mostra um capítulo diferente da família se preparando junta para a Grande Noite de Natal.

Crie o roteiro completo e metadados de SEO para o Episódio Especial de Natal #${christmasDayNumber} (data: ${cycleDate}), em formato JSON puro (sem blocos markdown), bilíngue (Português e Inglês).

CAPÍTULO DO DIA (TEMA CENTRAL DE HOJE):
"${suggestedChapter}"
${isChristmasFinale ? "ATENÇÃO: Este é o Grande Episódio Especial de Natal (mais longo e emocionante, com 12 cenas completas celebrando o grande dia da família!)." : ""}

CAPÍTULOS DE NATAL JÁ PUBLICADOS (NÃO REPETIR):
${pastEpisodes.map((t) => `- ${t}`).join("\n") || "- Nenhum ainda (este é o grande episódio de estreia da série de Natal!)"}

PERSONAGENS FIXOS (mantenha 100% da aparência nas descrições em inglês de imagePrompt, adicionando o clima natalino ao cenário):
- RAVEN (Mamãe): ${CHARACTERS.RAVEN.visual}
- VLAD (Papai, voz grave e suave, carinhoso e engraçado): ${CHARACTERS.VLAD.visual}
- LUNA (15 anos, adolescente fofa): ${CHARACTERS.LUNA.visual}
- THEO (10 anos, curioso e criativo): ${CHARACTERS.THEO.visual}
- JONNY (8 anos, caçula esperto): ${CHARACTERS.JONNY.visual}

ESTRUTURA OBRIGATÓRIA DE ${totalScenes} CENAS (00 a ${lastSceneIdx}) E REGRAS DE DIÁLOGO NATURAL:
- Cena "00" (NARRADOR): Abertura na casa azul decorada para o Natal (imageFile: "00_Abertura_Casa_Natal_9x16.png", fallbackAsset: "00_Abertura_Casa_Azul_9x16.webp").
- Cenas "01" a "${String(totalScenes - 2).padStart(2, "0")}": Desenvolva a história divertida, acolhedora e emocionante dos preparativos de Natal do dia com todos os membros da família participando. Cada fala deve ter entre 10 e 16 palavras.
- REGRAS DE NATURALIDADE DAS FALAS (MUITO IMPORTANTE PARA O TTS):
  1. Escreva diálogos 100% naturais, coloquiais, calorosos e fluidos, como uma família real animada preparando o Natal.
  2. PROIBIDO escrever onomatopeias literais que soam robóticas no TTS (NUNCA escreva "Ronc...", "Haha!", "Ho ho ho", "Hã?!", "Snore..."). Use frases reais e naturais.
  3. PROIBIDO usar expressões artificiais traduzidas como "Pelos meus bigodes!".
- Para cada cena intermediária, inclua um campo "imagePrompt" em inglês descrevendo a cena vertical 9:16 fotorrealista estilo Pixar 3D com decoração natalina aconchegante (luzes pisca-pisca douradas, guirlandas, enfeites de Natal) e a descrição exata da roupa e óculos do personagem daquela cena!
- Cena "${lastSceneIdx}" (FAMILIA, isFinale: true): Encerramento natalino com todos felizes no sofá (imageFile: "${lastSceneIdx}_Final_Familia_Natal_9x16.png", fallbackAsset: "09_Final_Familia_CORRIGIDA_5_dogs_9x16.webp").

Retorne APENAS um JSON válido seguindo exatamente este schema:
{
  "episodeNumber": ${christmasDayNumber},
  "series": "Especial_de_Natal",
  "cycleDate": "${cycleDate}",
  "theme": { "pt": "...", "en": "..." },
  "seo": {
    "pt": {
      "titleOptions": ["...", "...", "..."],
      "selectedTitle": "🎄 ... | Especial de Natal #${christmasDayNumber} #Shorts",
      "description": "...",
      "tags": ["Funny Spitz Family", "Especial de Natal", "Natal em Família", "Spitz Alemão", "Lulu da Pomerânia", "Shorts de Natal"],
      "hashtags": ["#FunnySpitzFamily", "#EspecialDeNatal", "#Shorts"],
      "thumbnailText": "NATAL SPITZ #${christmasDayNumber}",
      "scheduledTime": "12:00"
    },
    "en": {
      "titleOptions": ["...", "...", "..."],
      "selectedTitle": "🎄 ... | Christmas Special #${christmasDayNumber} #Shorts",
      "description": "...",
      "tags": ["Funny Spitz Family", "Christmas Special", "Pomeranian Christmas", "Cute Dogs", "Holiday Shorts"],
      "hashtags": ["#FunnySpitzFamily", "#ChristmasShorts", "#Shorts"],
      "thumbnailText": "SPITZ XMAS #${christmasDayNumber}",
      "scheduledTime": "20:00"
    }
  },
  "scenes": [
    {
      "id": "00",
      "character": "NARRADOR",
      "imageFile": "00_Abertura_Casa_Natal_9x16.png",
      "fallbackAsset": "00_Abertura_Casa_Azul_9x16.webp",
      "zoomDirection": "in",
      "text": { "pt": "...", "en": "..." }
    }
  ]
}
`;

  const candidateModels = [
    "gemini-3.0-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash"
  ];

  const endpoints = [];
  for (const model of candidateModels) {
    endpoints.push(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent?key=${apiKey}`
    );
  }

  let lastErr = "";
  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.8
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawJson) {
        const cleaned = rawJson
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        return JSON.parse(cleaned);
      }
    } else {
      lastErr = `(${res.status}) ${await res.text()}`;
    }
  }

  throw new Error(`Erro na Gemini API (Especial de Natal): ${lastErr}`);
}

const CHRISTMAS_SCENE_BANK = {
  NARRADOR: ["assets/christmas_scenes/00_house_christmas_exterior.jpg"],
  RAVEN: [
    "assets/christmas_scenes/raven_kitchen_gingerbread.jpg",
    "assets/christmas_scenes/raven_dining_table_christmas.jpg"
  ],
  VLAD: [
    "assets/christmas_scenes/vlad_living_room_tree.jpg",
    "assets/christmas_scenes/vlad_santa_armchair.jpg"
  ],
  LUNA: [
    "assets/christmas_scenes/luna_hallway_wreath.jpg",
    "assets/christmas_scenes/luna_christmas_tree_star.jpg"
  ],
  THEO: [
    "assets/christmas_scenes/theo_attic_boxes.jpg",
    "assets/christmas_scenes/theo_window_village.jpg"
  ],
  JONNY: [
    "assets/christmas_scenes/jonny_fireplace_stockings.jpg",
    "assets/christmas_scenes/jonny_gift_wrapping_room.jpg"
  ],
  FAMILIA: ["assets/christmas_scenes/99_family_christmas_finale.jpg"]
};

function assignVariedChristmasScene({ character, charUsageCount, episodeNumber, outPath }) {
  const pool = CHRISTMAS_SCENE_BANK[character] || CHRISTMAS_SCENE_BANK.FAMILIA;
  const pickIdx = (episodeNumber + charUsageCount) % pool.length;
  const chosenAbs = path.resolve(pool[pickIdx]);
  if (fs.existsSync(chosenAbs)) {
    fs.copyFileSync(chosenAbs, outPath);
    return;
  }
  throw new Error(`Cena natalina não encontrada: ${chosenAbs}`);
}

export async function runChristmasSpecialCycle({ publishNow = false } = {}) {
  const history = JSON.parse(fs.readFileSync(CHRISTMAS_HISTORY_PATH, "utf-8"));
  const nextNum = history.lastChristmasEpisode + 1;
  const cycleDate = new Date().toISOString().slice(0, 10);

  const isChristmasFinale =
    cycleDate.endsWith("-12-24") ||
    cycleDate.endsWith("-12-25") ||
    nextNum >= 44;

  const suggestedChapter =
    history.plannedStoryArc[nextNum - 1] ||
    `Dia ${nextNum}: Preparativos Mágicos para a Grande Noite de Natal da Família Spitz`;

  const epFolder = path.resolve(
    `episodes/natal_ep${String(nextNum).padStart(2, "0")}`
  );
  const imagesDir = path.join(epFolder, "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  // Garante a trilha sonora natalina 100% livre de direitos autorais
  const assetsDir = path.resolve("assets");
  ensureChristmasMusicMp3(assetsDir);

  console.log(
    `🎄 Iniciando Especial de Natal #${nextNum} (${cycleDate}) — Tema: ${suggestedChapter}`
  );

  const episodeData = await generateChristmasScriptWithGemini({
    christmasDayNumber: nextNum,
    cycleDate,
    suggestedChapter,
    pastEpisodes: history.publishedEpisodes,
    isChristmasFinale
  });

  episodeData.series = "Especial_de_Natal";
  const charCounter = {};
  episodeData.scenes.forEach((s, idx) => {
    s.id = String(idx).padStart(2, "0");
    s.imageFile = `${s.id}_${s.character}_Natal_9x16.jpg`;
    const isLast = idx === episodeData.scenes.length - 1;
    const roleKey = idx === 0 ? "NARRADOR" : isLast ? "FAMILIA" : s.character;
    const usage = charCounter[roleKey] || 0;
    charCounter[roleKey] = usage + 1;

    const imgOut = path.join(imagesDir, s.imageFile);
    assignVariedChristmasScene({
      character: roleKey,
      charUsageCount: usage,
      episodeNumber: nextNum,
      outPath: imgOut
    });
  });

  const lastScene = episodeData.scenes[episodeData.scenes.length - 1];
  lastScene.isFinale = true;
  lastScene.banner = {
    pt: ["🎄 Especial de Natal Spitz!", "Todo dia um novo preparativo!"],
    en: ["🎄 Spitz Christmas Special!", "A new holiday story every day!"]
  };

  const epJsonPath = path.join(
    epFolder,
    `natal_ep${String(nextNum).padStart(2, "0")}.json`
  );
  fs.writeFileSync(epJsonPath, JSON.stringify(episodeData, null, 2), "utf-8");

  const ptResult = await produceEpisodeForLanguage({
    episodeData,
    episodeDir: epFolder,
    assetsDir,
    lang: "pt"
  });
  const enResult = await produceEpisodeForLanguage({
    episodeData,
    episodeDir: epFolder,
    assetsDir,
    lang: "en"
  });

  // Salva cópia no Google Drive se disponível localmente
  const driveDir = "G:/Meu Drive/Funny Spitz Family";
  if (fs.existsSync(driveDir)) {
    fs.copyFileSync(
      ptResult.videoPath,
      path.join(driveDir, path.basename(ptResult.videoPath))
    );
    fs.copyFileSync(
      enResult.videoPath,
      path.join(driveDir, path.basename(enResult.videoPath))
    );
  }

  const ptUpload = await uploadVideoToYouTube({
    videoPath: ptResult.videoPath,
    thumbnailPath: ptResult.thumbnailPath,
    title: episodeData.seo.pt.selectedTitle,
    description: episodeData.seo.pt.description,
    tags: episodeData.seo.pt.tags,
    defaultLanguage: "pt-BR",
    publishAtIso: publishNow ? null : `${cycleDate}T12:00:00-03:00`,
    madeForKids: true
  });

  const enUpload = await uploadVideoToYouTube({
    videoPath: enResult.videoPath,
    thumbnailPath: enResult.thumbnailPath,
    title: episodeData.seo.en.selectedTitle,
    description: episodeData.seo.en.description,
    tags: episodeData.seo.en.tags,
    defaultLanguage: "en-US",
    publishAtIso: publishNow ? null : `${cycleDate}T20:00:00-03:00`,
    madeForKids: true
  });

  history.lastChristmasEpisode = nextNum;
  history.publishedEpisodes.push(
    `Especial de Natal #${nextNum}: ${episodeData.theme.pt}`
  );
  fs.writeFileSync(CHRISTMAS_HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");

  console.log("🎅🎄 Especial de Natal finalizado com sucesso!", {
    ptUpload,
    enUpload
  });
  return { ptUpload, enUpload, ptResult, enResult };
}

if (process.argv[1] && process.argv[1].endsWith("christmas-cycle.js")) {
  const publishNow = process.argv.includes("--publish-now");
  runChristmasSpecialCycle({ publishNow }).catch((err) => {
    console.error("❌ Erro no ciclo Especial de Natal:", err);
    process.exit(1);
  });
}
