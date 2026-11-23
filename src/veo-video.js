import fs from "node:fs";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Fallback Gratuito ZeroGPU: Lightricks LTX-Video-Distilled via Gradio API
 * Gera clipe MP4 com movimento 3D quando o Google Vids / Google Veo atinge limite de cota.
 */
async function generateLtxVideoClip({
  imagePath,
  motionPrompt,
  outVideoPath
}) {
  const baseUrl = "https://lightricks-ltx-video-distilled.hf.space";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75000);

  try {
    let uploadedFileObj = null;
    if (imagePath && fs.existsSync(imagePath)) {
      const formData = new FormData();
      const fileBlob = new Blob([fs.readFileSync(imagePath)], {
        type: "image/png"
      });
      formData.append("files", fileBlob, "scene.png");
      const upRes = await fetch(`${baseUrl}/gradio_api/upload`, {
        method: "POST",
        headers: { "User-Agent": BROWSER_UA },
        body: formData,
        signal: controller.signal
      });
      if (upRes.ok) {
        const upJson = await upRes.json();
        if (upJson?.[0]) {
          uploadedFileObj = {
            path: upJson[0],
            meta: { _type: "gradio.FileData" }
          };
        }
      }
    }

    const endpoint = uploadedFileObj ? "image_to_video" : "text_to_video";
    const callRes = await fetch(`${baseUrl}/gradio_api/call/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA
      },
      body: JSON.stringify({
        data: [
          `${motionPrompt}. 3D Pixar Disney animation style, cute fluffy Pomeranian dog moving naturally, blinking eyes, wagging tail, fluid motion, cinematic lighting`,
          "worst quality, inconsistent motion, blurry, jittery, distorted, text, watermark",
          uploadedFileObj,
          null,
          512,
          704,
          uploadedFileObj ? "image-to-video" : "text-to-video",
          3,
          9,
          Math.floor(Math.random() * 100000),
          true,
          1,
          true
        ]
      }),
      signal: controller.signal
    });

    if (!callRes.ok) return null;
    const { event_id: eventId } = await callRes.json();
    if (!eventId) return null;

    const streamRes = await fetch(
      `${baseUrl}/gradio_api/call/${endpoint}/${eventId}`,
      {
        headers: { "User-Agent": BROWSER_UA },
        signal: controller.signal
      }
    );
    if (!streamRes.ok) return null;

    const sseText = await streamRes.text();
    const lines = sseText.split("\n");
    let dataLine = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("event: complete") && lines[i + 1]?.startsWith("data: ")) {
        dataLine = lines[i + 1].slice(6).trim();
        break;
      }
    }
    if (!dataLine) return null;

    const parsed = JSON.parse(dataLine);
    const videoObj = parsed?.[0]?.video || parsed?.[0];
    const vidUrl =
      videoObj?.url ||
      (videoObj?.path ? `${baseUrl}/gradio_api/file=${videoObj.path}` : null);
    if (!vidUrl) return null;

    const vidRes = await fetch(vidUrl, {
      headers: { "User-Agent": BROWSER_UA },
      signal: controller.signal
    });
    if (!vidRes.ok) return null;

    const buf = Buffer.from(await vidRes.arrayBuffer());
    if (buf.byteLength > 20000) {
      fs.writeFileSync(outVideoPath, buf);
      console.log(`✅ [LTX-Video 3D] Clipe com movimento real salvo: ${outVideoPath}`);
      return outVideoPath;
    }
  } catch {
    // Segue para animação cinematográfica 3D multi-camadas caso o cluster ZeroGPU esteja ocupado
  } finally {
    clearTimeout(timeout);
  }
  return null;
}

/**
 * Integração Multi-Provedor de Vídeo 3D (Google Veo API -> LTX-Video 3D ZeroGPU)
 * Gera clipes MP4 com movimentos reais dos personagens a partir da imagem 3D inédita da cena.
 */
export async function generateVeoRealMotionClip({
  imagePath,
  motionPrompt,
  aspectRatio = "16:9",
  outVideoPath
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    const imageBase64 = fs.existsSync(imagePath)
      ? fs.readFileSync(imagePath).toString("base64")
      : null;

    const models = ["veo-3.0-generate-preview", "veo-2.0-generate-001"];

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${apiKey}`;
        const instance = {
          prompt: `${motionPrompt}. Natural 3D Pixar-style live-action Pomeranian dog movement, expressive face, blinking eyes, wagging tail, fluid motion, cinematic lighting.`
        };
        if (imageBase64) {
          instance.image = {
            bytesBase64Encoded: imageBase64,
            mimeType: "image/png"
          };
        }

        const startRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instances: [instance],
            parameters: {
              aspectRatio,
              sampleCount: 1,
              durationSeconds: 6
            }
          })
        });

        if (!startRes.ok) continue;
        const opData = await startRes.json();
        const opName = opData.name;
        if (!opName) continue;

        console.log(`🎥 [Google Veo] Gerando movimento real (${model}): ${opName}...`);

        for (let poll = 0; poll < 36; poll++) {
          await new Promise((r) => setTimeout(r, 5000));
          const pollRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${apiKey}`
          );
          if (!pollRes.ok) continue;
          const pollData = await pollRes.json();
          if (pollData.done) {
            const videoUri =
              pollData.response?.generateVideoResponse?.generatedSamples?.[0]
                ?.video?.uri;
            if (videoUri) {
              const vidRes = await fetch(`${videoUri}&key=${apiKey}`);
              if (vidRes.ok) {
                const buf = Buffer.from(await vidRes.arrayBuffer());
                fs.writeFileSync(outVideoPath, buf);
                console.log(`✅ [Google Veo] Clipe com movimento real salvo: ${outVideoPath}`);
                return outVideoPath;
              }
            }
            break;
          }
        }
      } catch {
        // Tenta próximo motor
      }
    }
  }

  // Motor Alternativo Gratuito ao Google Vids / Google Veo: LTX-Video 3D
  return await generateLtxVideoClip({
    imagePath,
    motionPrompt,
    outVideoPath
  });
}
