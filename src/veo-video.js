import fs from "node:fs";

/**
 * Integração com Google Veo (Image-to-Video / Text-to-Video API)
 * Gera clipes MP4 de 5 a 8 segundos com movimentos reais dos personagens (dançando, piscando,
 * abanando o rabo, batendo palmas, etc.) a partir da imagem base da cena.
 */
export async function generateVeoRealMotionClip({
  imagePath,
  motionPrompt,
  aspectRatio = "16:9",
  outVideoPath
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

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

      // Aguarda conclusão da operação assíncrona do Veo (até 3 minutos)
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
      // Tenta próximo modelo ou retorna null para fallback
    }
  }

  return null;
}
