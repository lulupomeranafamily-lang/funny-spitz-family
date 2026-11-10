import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { CHARACTERS } from "./characters.js";
import { produceEpisodeForLanguage } from "./produce-episode.js";
import { uploadVideoToYouTube } from "./youtube-upload.js";

const HISTORY_PATH = path.resolve("config/history.json");

/**
 * Chama a Gemini API gratuita (Google AI Studio Free Tier) para gerar o roteiro bilíngue (PT + EN),
 * descrições visuais consistentes e metadados de SEO completos.
 */
async function generateEpisodeScriptWithGemini({ episodeNumber, cycleDate, pastThemes }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Variável GEMINI_API_KEY não definida nos Secrets do GitHub!");
  }

  const prompt = `
Você é o roteirista oficial do canal infantil/familiar "Funny Spitz Family" (@FunnySpitzFamily).
Crie o roteiro completo e metadados de SEO para o Episódio ${episodeNumber} (data do ciclo: ${cycleDate}), em formato JSON puro (sem blocos markdown), bilíngue (Português e Inglês).

TEMAS JÁ PUBLICADOS (PROIBIDO REPETIR):
${pastThemes.map((t) => `- ${t}`).join("\n")}

PERSONAGENS FIXOS (mantenha 100% da personalidade e aparência nas descrições em inglês de imagePrompt):
- RAVEN (Mamãe): ${CHARACTERS.RAVEN.visual}
- VLAD (Papai, voz grave de alfa mas bem-humorado e dorminhoco/atrapalhado): ${CHARACTERS.VLAD.visual}
- LUNA (15 anos, adolescente fofa): ${CHARACTERS.LUNA.visual}
- THEO (10 anos, curioso e criativo): ${CHARACTERS.THEO.visual}
- JONNY (8 anos, caçula esperto): ${CHARACTERS.JONNY.visual}

ESTRUTURA OBRIGATÓRIA DE 8 CENAS (00 a 07):
- Cena "00" (NARRADOR): Sempre na casa azul (imageFile: "00_Abertura_Casa_Azul_9x16.png", fallbackAsset: "00_Abertura_Casa_Azul_9x16.webp").
- Cenas "01" a "06": Desenvolva uma história divertida, familiar e com humor leve (gancho, mistério/confusão divertida, clímax engraçado com a família). Cada fala deve ter entre 7 e 13 palavras. Para cada cena de 01 a 06, inclua um campo "imagePrompt" em inglês descrevendo a cena vertical 9:16 fotorrealista cinematográfica com a descrição exata da roupa e óculos do personagem daquela cena!
- Cena "07" (NARRADOR, isFinale: true): Encerramento com todos no sofá (imageFile: "07_Final_Familia_Sofa_9x16.png", fallbackAsset: "09_Final_Familia_CORRIGIDA_5_dogs_9x16.webp").

Retorne APENAS um JSON válido seguindo exatamente este schema:
{
  "episodeNumber": ${episodeNumber},
  "cycleDate": "${cycleDate}",
  "theme": { "pt": "...", "en": "..." },
  "seo": {
    "pt": {
      "titleOptions": ["...", "...", "..."],
      "selectedTitle": "... #Shorts",
      "description": "...",
      "tags": ["Funny Spitz Family", "Spitz Alemão", "Lulu da Pomerânia", "..."],
      "hashtags": ["#FunnySpitzFamily", "#SpitzAlemao", "#Shorts"],
      "thumbnailText": "TEXTO CURTO ATÉ 4 PALAVRAS",
      "scheduledTime": "07:00"
    },
    "en": {
      "titleOptions": ["...", "...", "..."],
      "selectedTitle": "... #Shorts",
      "description": "...",
      "tags": ["Funny Spitz Family", "Pomeranian", "Cute Dogs", "..."],
      "hashtags": ["#FunnySpitzFamily", "#Pomeranian", "#Shorts"],
      "thumbnailText": "SHORT TEXT MAX 4 WORDS",
      "scheduledTime": "18:00"
    }
  },
  "scenes": [
    {
      "id": "00",
      "character": "NARRADOR",
      "imageFile": "00_Abertura_Casa_Azul_9x16.png",
      "fallbackAsset": "00_Abertura_Casa_Azul_9x16.webp",
      "zoomDirection": "in",
      "text": { "pt": "...", "en": "..." }
    },
    {
      "id": "01",
      "character": "RAVEN",
      "imageFile": "01_Cena.png",
      "imagePrompt": "Photorealistic cinematic 9:16 vertical portrait of ...",
      "zoomDirection": "out",
      "text": { "pt": "...", "en": "..." }
    }
  ]
}
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.8
        }
      })
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro na Gemini API (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(rawJson);
}

/**
 * Gera imagem 9:16 (1080x1920) na nuvem sem custo (tenta Gemini Imagen se disponível na chave,
 * com fallback gratuito imediato para motor Flux 9:16 de alta definição).
 */
async function generateCloudSceneImage({ prompt, outPath, seed }) {
  const fullPrompt = `${prompt}, cozy warm home interior lighting, shallow depth of field, ultra detailed fluffy fur, Pixar-like live action photorealistic cinema quality, vertical 9:16 aspect ratio, no text, no watermark`;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    fullPrompt
  )}?width=1080&height=1920&model=flux&nologo=true&seed=${seed}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha ao gerar imagem na nuvem (${res.status})`);
  }
  const arrayBuf = await res.arrayBuffer();
  fs.writeFileSync(outPath, Buffer.from(arrayBuf));
}

async function runDailyCloudCycle() {
  const history = fs.existsSync(HISTORY_PATH)
    ? JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"))
    : { lastEpisodeNumber: 3, publishedThemes: [] };

  const nextEpNum = history.lastEpisodeNumber + 1;
  const cycleDate = new Date().toISOString().slice(0, 10);
  const epFolder = path.resolve(
    `episodes/ep${String(nextEpNum).padStart(2, "0")}`
  );
  const imagesDir = path.join(epFolder, "images");
  fs.mkdirSync(imagesDir, { recursive: true });

  console.log(`🎬 Iniciando Ciclo Diário em Nuvem - Episódio ${nextEpNum} (${cycleDate})...`);

  // Etapa 1 e 2: Pesquisa de tema inédito + Roteiro Bilíngue + SEO
  const episodeData = await generateEpisodeScriptWithGemini({
    episodeNumber: nextEpNum,
    cycleDate,
    pastThemes: history.publishedThemes
  });

  // Garante abertura e encerramento oficiais
  episodeData.scenes[0].fallbackAsset = "00_Abertura_Casa_Azul_9x16.webp";
  const lastScene = episodeData.scenes[episodeData.scenes.length - 1];
  lastScene.isFinale = true;
  lastScene.fallbackAsset = "09_Final_Familia_CORRIGIDA_5_dogs_9x16.webp";
  lastScene.banner = {
    pt: ["Somos a Spitz Funny Family!", "Bem-vindo à nossa família!"],
    en: ["We are the Funny Spitz Family!", "Welcome to our family!"]
  };

  const epJsonPath = path.join(
    epFolder,
    `ep${String(nextEpNum).padStart(2, "0")}.json`
  );
  fs.writeFileSync(epJsonPath, JSON.stringify(episodeData, null, 2), "utf-8");

  // Etapa 3: Gera as imagens das cenas intermediárias (01 a 06)
  for (const scene of episodeData.scenes) {
    if (scene.id === "00" || scene.isFinale) continue;
    const imgOut = path.join(imagesDir, scene.imageFile);
    if (!fs.existsSync(imgOut)) {
      console.log(`🖼️ Gerando imagem 9:16 da Cena ${scene.id}...`);
      await generateCloudSceneImage({
        prompt: scene.imagePrompt || CHARACTERS[scene.character]?.visual,
        outPath: imgOut,
        seed: nextEpNum * 100 + Number(scene.id)
      });
    }
  }

  // Copia cena 01 ou 05 como base de thumbnail caso necessário
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

  // Etapa 6: Publicação e Agendamento Automático (07:00 e 18:00 America/Sao_Paulo)
  const ptUpload = await uploadVideoToYouTube({
    videoPath: ptResult.videoPath,
    thumbnailPath: ptResult.thumbnailPath,
    title: episodeData.seo.pt.selectedTitle,
    description: episodeData.seo.pt.description,
    tags: episodeData.seo.pt.tags,
    defaultLanguage: "pt-BR",
    publishAtIso: `${cycleDate}T07:00:00-03:00`,
    madeForKids: true
  });

  const enUpload = await uploadVideoToYouTube({
    videoPath: enResult.videoPath,
    thumbnailPath: enResult.thumbnailPath,
    title: episodeData.seo.en.selectedTitle,
    description: episodeData.seo.en.description,
    tags: episodeData.seo.en.tags,
    defaultLanguage: "en-US",
    publishAtIso: `${cycleDate}T18:00:00-03:00`,
    madeForKids: true
  });

  // Etapa 7: Atualiza histórico e salva relatório
  history.lastEpisodeNumber = nextEpNum;
  history.publishedThemes.push(
    `Episódio ${nextEpNum}: ${episodeData.theme.pt}`
  );
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8");

  const report = {
    ciclo: cycleDate,
    episodio: nextEpNum,
    videos: [
      {
        idioma: "pt-BR",
        tema: episodeData.theme.pt,
        titulo: episodeData.seo.pt.selectedTitle,
        video_id: ptUpload.videoId,
        url: ptUpload.url,
        horario_publicacao: ptUpload.publishAt,
        status: ptUpload.status
      },
      {
        idioma: "en-US",
        tema: episodeData.theme.en,
        titulo: episodeData.seo.en.selectedTitle,
        video_id: enUpload.videoId,
        url: enUpload.url,
        horario_publicacao: enUpload.publishAt,
        status: enUpload.status
      }
    ]
  };

  const reportPath = path.join(epFolder, "output", "relatorio_ciclo.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log("🎉 Ciclo em nuvem finalizado com sucesso!", report);
}

runDailyCloudCycle().catch((err) => {
  console.error("❌ Erro no ciclo em nuvem:", err);
  process.exit(1);
});
