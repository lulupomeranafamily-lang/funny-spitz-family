import fs from "node:fs";
import path from "node:path";
import { CHARACTERS } from "./characters.js";
import { produceEpisodeForLanguage } from "./produce-episode.js";
import { uploadVideoToYouTube } from "./youtube-upload.js";

const CHRISTMAS_HISTORY_PATH = path.resolve("config/christmas_history.json");

async function generateChristmasScriptWithGemini({
  christmasDayNumber,
  cycleDate,
  suggestedChapter,
  pastEpisodes
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Variável GEMINI_API_KEY não definida!");
  }

  const prompt = `
Você é o roteirista oficial da série especial "Especial de Natal da Funny Spitz Family" (@FunnySpitzFamily).
A família considera o Natal o evento mais importante, mágico e aguardado do ano inteiro! Cada dia esta série mostra um capítulo diferente da família se preparando junta para a Grande Noite de Natal.

Crie o roteiro completo e metadados de SEO para o Episódio Especial de Natal #${christmasDayNumber} (data: ${cycleDate}), em formato JSON puro (sem blocos markdown), bilíngue (Português e Inglês).

CAPÍTULO DO DIA (TEMA CENTRAL DE HOJE):
"${suggestedChapter}"

CAPÍTULOS DE NATAL JÁ PUBLICADOS (NÃO REPETIR):
${pastEpisodes.map((t) => `- ${t}`).join("\n") || "- Nenhum ainda (este é o grande episódio de estreia da série de Natal!)"}

PERSONAGENS FIXOS (mantenha 100% da aparência nas descrições em inglês de imagePrompt, adicionando o clima natalino ao cenário):
- RAVEN (Mamãe): ${CHARACTERS.RAVEN.visual}
- VLAD (Papai, voz grave e suave, carinhoso e engraçado): ${CHARACTERS.VLAD.visual}
- LUNA (15 anos, adolescente fofa): ${CHARACTERS.LUNA.visual}
- THEO (10 anos, curioso e criativo): ${CHARACTERS.THEO.visual}
- JONNY (8 anos, caçula esperto): ${CHARACTERS.JONNY.visual}

ESTRUTURA OBRIGATÓRIA DE 8 CENAS (00 a 07) E REGRAS DE DIÁLOGO NATURAL:
- Cena "00" (NARRADOR): Abertura na casa azul decorada para o Natal (imageFile: "00_Abertura_Casa_Natal_9x16.png", fallbackAsset: "00_Abertura_Casa_Azul_9x16.webp").
- Cenas "01" a "06": Desenvolva a história divertida e emocionante dos preparativos de Natal do dia. Cada fala deve ter entre 8 e 15 palavras.
- REGRAS DE NATURALIDADE DAS FALAS (MUITO IMPORTANTE PARA O TTS):
  1. Escreva diálogos 100% naturais, coloquiais, calorosos e fluidos, como uma família real animada preparando o Natal.
  2. PROIBIDO escrever onomatopeias literais que soam robóticas no TTS (NUNCA escreva "Ronc...", "Haha!", "Ho ho ho", "Hã?!", "Snore..."). Use frases reais e naturais.
  3. PROIBIDO usar expressões artificiais traduzidas como "Pelos meus bigodes!".
- Para cada cena de 01 a 06, inclua um campo "imagePrompt" em inglês descrevendo a cena vertical 9:16 fotorrealista estilo Pixar 3D com decoração natalina aconchegante (luzes pisca-pisca douradas, guirlandas, enfeites de Natal) e a descrição exata da roupa e óculos do personagem daquela cena!
- Cena "07" (FAMILIA, isFinale: true): Encerramento natalino com todos felizes no sofá (imageFile: "07_Final_Familia_Natal_9x16.png", fallbackAsset: "09_Final_Familia_CORRIGIDA_5_dogs_9x16.webp").

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
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
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

const CHARACTER_FALLBACK_IMAGES = {
  RAVEN: "episodes/ep03/images/01_Raven_Prato_Vazio_9x16.png",
  LUNA: "episodes/ep03/images/02_Luna_Inocente_9x16.png",
  THEO: "episodes/ep03/images/03_Theo_Brincando_9x16.png",
  JONNY: "episodes/ep03/images/04_Jonny_Apontando_9x16.png",
  VLAD: "episodes/ep03/images/05_Vlad_Dormindo_Migalhas_9x16.png",
  FAMILIA: "episodes/ep03/images/06_Familia_Rindo_9x16.png",
  NARRADOR: "episodes/ep03/images/00_Abertura_Casa_Azul_9x16.png"
};

async function generateChristmasSceneImage({ prompt, character, outPath, seed }) {
  const fullPrompt = `${prompt}, magical cozy Christmas holiday decorations, warm golden fairy lights, red and gold Christmas ornaments, pine garlands, ultra detailed fluffy Pomeranian fur, 3D Pixar-style photorealistic cinema quality, vertical 9:16 aspect ratio, no text, no watermark`;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    fullPrompt
  )}?width=1080&height=1920&model=flux&nologo=true&seed=${seed}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > 10000) {
          fs.writeFileSync(outPath, Buffer.from(arrayBuf));
          return;
        }
      }
    } catch (err) {
      console.warn(`⚠️ Tentativa ${attempt} de imagem natalina falhou (${err.message})`);
    }
  }

  const fallbackRel =
    CHARACTER_FALLBACK_IMAGES[character] || CHARACTER_FALLBACK_IMAGES.FAMILIA;
  const fallbackAbs = path.resolve(fallbackRel);
  if (fs.existsSync(fallbackAbs)) {
    fs.copyFileSync(fallbackAbs, outPath);
    return;
  }
  throw new Error(`Falha ao gerar imagem natalina para ${character}`);
}

export async function runChristmasSpecialCycle() {
  const history = JSON.parse(fs.readFileSync(CHRISTMAS_HISTORY_PATH, "utf-8"));
  const nextNum = history.lastChristmasEpisode + 1;
  const cycleDate = new Date().toISOString().slice(0, 10);

  const suggestedChapter =
    history.plannedStoryArc[nextNum - 1] ||
    `Dia ${nextNum}: Preparativos Mágicos para a Grande Noite de Natal da Família Spitz`;

  const epFolder = path.resolve(
    `episodes/natal_ep${String(nextNum).padStart(2, "0")}`
  );
  const imagesDir = path.join(epFolder, "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  console.log(
    `🎄 Iniciando Especial de Natal #${nextNum} (${cycleDate}) — Tema: ${suggestedChapter}`
  );

  const episodeData = await generateChristmasScriptWithGemini({
    christmasDayNumber: nextNum,
    cycleDate,
    suggestedChapter,
    pastEpisodes: history.publishedEpisodes
  });

  episodeData.scenes.forEach((s, idx) => {
    s.id = String(idx).padStart(2, "0");
    if (!s.imageFile) s.imageFile = `${s.id}_${s.character}_Natal_9x16.png`;
  });
  episodeData.scenes[0].fallbackAsset = "00_Abertura_Casa_Azul_9x16.webp";
  const lastScene = episodeData.scenes[episodeData.scenes.length - 1];
  lastScene.isFinale = true;
  lastScene.fallbackAsset = "09_Final_Familia_CORRIGIDA_5_dogs_9x16.webp";
  lastScene.banner = {
    pt: ["🎄 Especial de Natal Spitz!", "Todo dia um novo preparativo!"],
    en: ["🎄 Spitz Christmas Special!", "A new holiday story every day!"]
  };

  const epJsonPath = path.join(
    epFolder,
    `natal_ep${String(nextNum).padStart(2, "0")}.json`
  );
  fs.writeFileSync(epJsonPath, JSON.stringify(episodeData, null, 2), "utf-8");

  for (const scene of episodeData.scenes) {
    if (scene.id === "00" || scene.isFinale) continue;
    const imgOut = path.join(imagesDir, scene.imageFile);
    if (!fs.existsSync(imgOut)) {
      console.log(`🖼️🎄 Gerando frame 9:16 natalino da Cena ${scene.id}...`);
      await generateChristmasSceneImage({
        prompt: scene.imagePrompt || CHARACTERS[scene.character]?.visual,
        character: scene.character,
        outPath: imgOut,
        seed: 251200 + nextNum * 100 + Number(scene.id)
      });
    }
  }

  const assetsDir = path.resolve("assets");
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

  // Agenda/publica os Shorts Especiais de Natal (12:00 PT-BR e 20:00 EN-US)
  const ptUpload = await uploadVideoToYouTube({
    videoPath: ptResult.videoPath,
    thumbnailPath: ptResult.thumbnailPath,
    title: episodeData.seo.pt.selectedTitle,
    description: episodeData.seo.pt.description,
    tags: episodeData.seo.pt.tags,
    defaultLanguage: "pt-BR",
    publishAtIso: `${cycleDate}T12:00:00-03:00`,
    madeForKids: true
  });

  const enUpload = await uploadVideoToYouTube({
    videoPath: enResult.videoPath,
    thumbnailPath: enResult.thumbnailPath,
    title: episodeData.seo.en.selectedTitle,
    description: episodeData.seo.en.description,
    tags: episodeData.seo.en.tags,
    defaultLanguage: "en-US",
    publishAtIso: `${cycleDate}T20:00:00-03:00`,
    madeForKids: true
  });

  history.lastChristmasEpisode = nextNum;
  history.publishedEpisodes.push(
    `Especial de Natal #${nextNum}: ${episodeData.theme.pt}`
  );
  fs.writeFileSync(CHRISTMAS_HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");

  console.log("🎅🎄 Especial de Natal finalizado e agendado com sucesso!", {
    ptUpload,
    enUpload
  });
}

if (process.argv[1] && process.argv[1].endsWith("christmas-cycle.js")) {
  runChristmasSpecialCycle().catch((err) => {
    console.error("❌ Erro no ciclo Especial de Natal:", err);
    process.exit(1);
  });
}
