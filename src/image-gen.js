import fs from "node:fs";
import crypto from "node:crypto";
import sharp from "sharp";

const GRADIO_FLUX_SPACES = [
  "https://black-forest-labs-flux-1-schnell.hf.space",
  "https://multimodalart-flux-1-merged.hf.space"
];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const seenHashes = new Set();
let lastPollinationsCallMs = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 1. Pollinations FLUX com URL limpa (sem enhance=true e resolução 1280x720 / 720x1280),
 * respeitando intervalo mínimo entre requisições para nunca receber HTTP 402/500.
 */
async function generateWithPollinations({
  prompt,
  seed,
  isWidescreen,
  model = "flux"
}) {
  const elapsed = Date.now() - lastPollinationsCallMs;
  if (elapsed < 6500) {
    await sleep(6500 - elapsed);
  }
  lastPollinationsCallMs = Date.now();

  const w = isWidescreen ? 1280 : 720;
  const h = isWidescreen ? 720 : 1280;
  const cleanPrompt = prompt.slice(0, 260);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    cleanPrompt
  )}?width=${w}&height=${h}&model=${model}&nologo=true&seed=${seed}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
      },
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`Pollinations (${model}) HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 12000) {
      throw new Error(`Pollinations buffer too small (${buf.byteLength})`);
    }
    return buf;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 2. Gradio Space FLUX.1 (ZeroGPU gratuito)
 */
async function generateWithGradioFluxSpace({
  baseUrl,
  prompt,
  seed,
  isWidescreen
}) {
  const width = isWidescreen ? 1280 : 720;
  const height = isWidescreen ? 720 : 1280;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
    const callRes = await fetch(`${baseUrl}/gradio_api/call/infer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA
      },
      body: JSON.stringify({
        data: [prompt, seed, false, width, height, 4]
      }),
      signal: controller.signal
    });
    if (!callRes.ok) {
      throw new Error(`HTTP ${callRes.status} on ${baseUrl}`);
    }
    const { event_id: eventId } = await callRes.json();
    if (!eventId) {
      throw new Error(`No event_id from ${baseUrl}`);
    }

    const streamRes = await fetch(
      `${baseUrl}/gradio_api/call/infer/${eventId}`,
      {
        headers: { "User-Agent": BROWSER_UA },
        signal: controller.signal
      }
    );
    if (!streamRes.ok) {
      throw new Error(`HTTP ${streamRes.status} on stream ${eventId}`);
    }
    const sseText = await streamRes.text();
    const lines = sseText.split("\n");
    let dataLine = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("event: complete") && lines[i + 1]?.startsWith("data: ")) {
        dataLine = lines[i + 1].slice(6).trim();
        break;
      }
    }
    if (!dataLine) {
      throw new Error(`Gradio quota/stream incomplete on ${baseUrl}`);
    }

    const parsed = JSON.parse(dataLine);
    const imgUrl =
      parsed?.[0]?.url ||
      (parsed?.[0]?.path
        ? `${baseUrl}/gradio_api/file=${parsed[0].path}`
        : null);
    if (!imgUrl) {
      throw new Error(`No image URL from ${baseUrl}`);
    }

    const imgRes = await fetch(imgUrl, {
      headers: { "User-Agent": BROWSER_UA },
      signal: controller.signal
    });
    if (!imgRes.ok) {
      throw new Error(`Download failed from ${imgUrl}`);
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.byteLength < 12000) {
      throw new Error(`Image too small (${buf.byteLength} bytes)`);
    }
    return buf;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 3. AI Horde (aihorde.net Open-Source Community Cluster - 100% gratuito e sem limite por IP)
 */
async function generateWithAiHorde({ prompt, seed, isWidescreen }) {
  const width = isWidescreen ? 576 : 384;
  const height = isWidescreen ? 384 : 576;

  const startRes = await fetch("https://aihorde.net/api/v2/generate/async", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: "0000000000",
      "Client-Agent": "FunnySpitzFamily:1.0:antigravity"
    },
    body: JSON.stringify({
      prompt: `${prompt} ### blurry, ugly, deformed, text, watermark, bad anatomy`,
      params: {
        sampler_name: "k_euler_a",
        cfg_scale: 7,
        width,
        height,
        steps: 20,
        seed: String(seed),
        n: 1
      },
      models: [
        "Dreamshaper",
        "AbsoluteReality",
        "ICBINP - I Cant Believe Its Not Photography",
        "stable_diffusion"
      ],
      nsfw: false,
      censor_nsfw: true
    })
  });

  if (!startRes.ok) {
    throw new Error(`AI Horde start HTTP ${startRes.status}`);
  }
  const { id } = await startRes.json();
  if (!id) throw new Error("AI Horde returned no job id");

  for (let poll = 0; poll < 40; poll++) {
    await sleep(3000);
    const statusRes = await fetch(
      `https://aihorde.net/api/v2/generate/status/${id}`,
      {
        headers: { "Client-Agent": "FunnySpitzFamily:1.0:antigravity" }
      }
    );
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    if (statusData.done && statusData.generations?.[0]?.img) {
      const imgField = statusData.generations[0].img;
      if (imgField.startsWith("http")) {
        const dl = await fetch(imgField);
        if (dl.ok) return Buffer.from(await dl.arrayBuffer());
      } else {
        return Buffer.from(imgField, "base64");
      }
    }
    if (statusData.faulted) {
      throw new Error("AI Horde job faulted");
    }
  }
  throw new Error("AI Horde timeout");
}

/**
 * 4. Google Imagen 3 API (quando GEMINI_API_KEY está configurada e com cota)
 */
async function generateWithGeminiApi({ prompt, aspectRatio }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("No GEMINI_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspectRatio === "16:9" ? "16:9" : "9:16"
      }
    })
  });
  if (!res.ok) {
    throw new Error(`Gemini Imagen HTTP ${res.status}`);
  }
  const data = await res.json();
  const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error("No bytesBase64Encoded in Imagen response");
  return Buffer.from(b64, "base64");
}

/**
 * Cascata Multi-Provedor para gerar imagens 3D estilo Pixar 100% inéditas para cada cena.
 * Suporta tanto 16:9 (1920x1080 para vídeos longos) quanto 9:16 (1080x1920 para Shorts).
 * Garante via hash SHA-256 que nenhuma imagem do episódio seja repetida.
 */
export async function generateUniqueSceneImage({
  prompt,
  aspectRatio = "16:9",
  outPath,
  seed = Math.floor(Math.random() * 900000) + 10000
}) {
  const isWidescreen = aspectRatio === "16:9";
  const targetWidth = isWidescreen ? 1920 : 1080;
  const targetHeight = isWidescreen ? 1080 : 1920;

  const styledPrompt = `3D Pixar Disney animation, ${prompt}, ultra detailed fluffy Pomeranian fur, vibrant lighting, no text`;

  const providers = [
    {
      name: "Pollinations FLUX Clean",
      fn: (s) =>
        generateWithPollinations({
          prompt: styledPrompt,
          seed: s,
          isWidescreen,
          model: "flux"
        })
    },
    {
      name: "FLUX.1-schnell (Gradio Space 1)",
      fn: (s) =>
        generateWithGradioFluxSpace({
          baseUrl: GRADIO_FLUX_SPACES[0],
          prompt: styledPrompt,
          seed: s,
          isWidescreen
        })
    },
    {
      name: "FLUX.1-merged (Gradio Space 2)",
      fn: (s) =>
        generateWithGradioFluxSpace({
          baseUrl: GRADIO_FLUX_SPACES[1],
          prompt: styledPrompt,
          seed: s,
          isWidescreen
        })
    },
    {
      name: "AI Horde Community Cluster",
      fn: (s) =>
        generateWithAiHorde({
          prompt: styledPrompt,
          seed: s,
          isWidescreen
        })
    },
    {
      name: "Google Imagen 3 API",
      fn: () =>
        generateWithGeminiApi({
          prompt: styledPrompt,
          aspectRatio
        })
    }
  ];

  for (let round = 0; round < 3; round++) {
    for (const provider of providers) {
      const currentSeed = (seed + round * 9973) % 2147483647;
      try {
        const rawBuf = await provider.fn(currentSeed);
        const hash = crypto.createHash("sha256").update(rawBuf).digest("hex");
        if (seenHashes.has(hash)) {
          console.warn(
            `⚠️ [${provider.name}] Imagem duplicada detectada (hash ${hash.slice(0, 8)}), tentando nova seed...`
          );
          continue;
        }
        seenHashes.add(hash);

        await sharp(rawBuf)
          .resize(targetWidth, targetHeight, { fit: "cover" })
          .png({ compressionLevel: 6 })
          .toFile(outPath);

        console.log(
          `   ✨ [${provider.name}] Nova imagem 3D (${targetWidth}x${targetHeight}) gerada -> ${outPath}`
        );
        return outPath;
      } catch (err) {
        console.warn(`   ⚠️ [${provider.name}] indisponível (${err.message}). Tentando próximo motor...`);
        await sleep(1500);
      }
    }
  }

  throw new Error(`Todos os motores de imagem falharam para: ${outPath}`);
}
