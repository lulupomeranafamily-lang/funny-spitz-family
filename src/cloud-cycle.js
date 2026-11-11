import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { CHARACTERS } from "./characters.js";
import { produceEpisodeForLanguage } from "./produce-episode.js";
import { produceLongEpisode16x9 } from "./produce-long-16x9.js";
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

ESTRUTURA OBRIGATÓRIA DE 8 CENAS (00 a 07) E REGRAS DE DIÁLOGO NATURAL:
- Cena "00" (NARRADOR): Sempre na casa azul (imageFile: "00_Abertura_Casa_Azul_9x16.png", fallbackAsset: "00_Abertura_Casa_Azul_9x16.webp").
- Cenas "01" a "06": Desenvolva uma história divertida, familiar e com humor leve (gancho, mistério/confusão divertida, clímax engraçado com a família). Cada fala deve ter entre 8 e 15 palavras.
- REGRAS DE NATURALIDADE DAS FALAS (MUITO IMPORTANTE PARA O TTS):
  1. Escreva diálogos 100% naturais, coloquiais e fluidos, como uma família real conversando com carinho e bom humor.
  2. PROIBIDO escrever onomatopeias literais que soam robóticas no TTS (NUNCA escreva "Ronc...", "Haha!", "Hahaha", "Hã?!", "Snore...", "Zzz"). Use palavras reais e pausas naturais com vírgulas.
  3. PROIBIDO usar expressões traduzidas ou artificiais como "Pelos meus bigodes!" / "By my whiskers!".
- Para cada cena de 01 a 06, inclua um campo "imagePrompt" em inglês descrevendo a cena vertical 9:16 fotorrealista cinematográfica com a descrição exata da roupa e óculos do personagem daquela cena!
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

  const candidateModels = [
    "gemini-3.0-flash",
    "gemini-3-flash-preview",
    "gemini-2.5-flash"
  ];

  // Descobre automaticamente modelos flash disponíveis na conta caso os nomes mudem no futuro
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const dynamicFlash = (listData.models || [])
        .filter(
          (m) =>
            m.name?.includes("gemini") &&
            m.name?.includes("flash") &&
            !m.name?.includes("2.5") &&
            (m.supportedGenerationMethods || []).includes("generateContent")
        )
        .map((m) => m.name.replace(/^models\//, ""));
      for (const m of dynamicFlash) {
        if (!candidateModels.includes(m)) candidateModels.unshift(m);
      }
    }
  } catch {
    // Segue com a lista padrão
  }

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
        console.log(`✅ Roteiro gerado com sucesso via ${endpoint.split("?")[0]}`);
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

  throw new Error(`Erro na Gemini/Vertex API: ${lastErr}`);
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

/**
 * Gera imagem 9:16 (1080x1920) na nuvem sem custo (com retry automático e fallback seguro
 * para o banco de retratos oficiais dos personagens caso o servidor externo oscile).
 */
async function generateCloudSceneImage({ prompt, character, outPath, seed }) {
  const fullPrompt = `${prompt}, cozy warm home interior lighting, shallow depth of field, ultra detailed fluffy fur, photorealistic cinema quality, vertical 9:16 aspect ratio, no text, no watermark`;
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
      console.warn(`⚠️ Tentativa ${attempt} de imagem externa falhou (${err.message})`);
    }
  }

  // Fallback para o retrato oficial 9:16 do personagem no repositório
  const fallbackRel =
    CHARACTER_FALLBACK_IMAGES[character] || CHARACTER_FALLBACK_IMAGES.FAMILIA;
  const fallbackAbs = path.resolve(fallbackRel);
  if (fs.existsSync(fallbackAbs)) {
    console.log(`🐾 Usando retrato oficial consistente de ${character}`);
    fs.copyFileSync(fallbackAbs, outPath);
    return;
  }
  throw new Error(`Falha ao gerar imagem da cena para ${character}`);
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

  // Garante abertura, nomes de arquivos de imagem e encerramento oficiais
  episodeData.scenes.forEach((s, idx) => {
    s.id = String(idx).padStart(2, "0");
    if (!s.imageFile) s.imageFile = `${s.id}_${s.character}_9x16.png`;
  });
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
        character: scene.character,
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

  // Nota: O Vídeo Longo 16:9 das 17:00 agora é produzido em 3D Real no Desktop via Google Vids!
  console.log("ℹ️ Shorts 9:16 com frames agendados! O episódio longo 16:9 em 3D será gerado à tarde no Desktop via Google Vids.");

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
