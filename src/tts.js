import fs from "node:fs";
import https from "node:https";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { CHARACTERS } from "./characters.js";

function fetchGoogleTTSBuffer(text, lang) {
  const tl = lang === "pt" ? "pt-BR" : "en";
  const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
    text
  )}&tl=${tl}&client=tw-ob`;

  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Google TTS status ${res.statusCode}`));
            return;
          }
          const chunks = [];
          res.on("data", (d) => chunks.push(d));
          res.on("end", () => resolve(Buffer.concat(chunks)));
        }
      )
      .on("error", reject);
  });
}

/**
 * Aplica modelagem acústica FFmpeg por personagem:
 * - Para o VLAD (Alfa da família): reduz o pitch (voz masculina bem grave), adiciona ganho de grave (110Hz) e compressor de presença vocal.
 * - Para os demais personagens: ajusta timbre e cadência mantendo clareza cristalina.
 */
function applyVoiceMastering({ rawMp3, outPath, voiceProfile }) {
  const { pitch = 1.0, tempo = 1.05, bassGainDb = 0 } = voiceProfile || {};
  const adjustedTempo = Math.max(0.5, Math.min(2.0, tempo / pitch)).toFixed(3);

  const filters = [
    `asetrate=24000*${pitch}`,
    `aresample=24000`,
    `atempo=${adjustedTempo}`
  ];

  if (bassGainDb > 0) {
    filters.push(`equalizer=f=115:width_type=o:width=1.8:g=${bassGainDb}`);
    filters.push(`volume=1.35`);
  }

  const res = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-i",
      rawMp3,
      "-af",
      filters.join(","),
      "-ar",
      "24000",
      "-ac",
      "1",
      outPath
    ],
    { encoding: "utf-8" }
  );

  if (res.status !== 0) {
    throw new Error(`Falha ao masterizar áudio TTS: ${res.stderr}`);
  }
}

export async function synthesizeSpeech({ characterKey, text, lang, outPath }) {
  const charConfig = CHARACTERS[characterKey] || CHARACTERS.NARRADOR;
  const voice = charConfig.voices[lang] || charConfig.voices.pt;
  const rawMp3 = `${outPath}.raw.mp3`;

  // 1. Tenta Microsoft Edge Neural TTS (com retry automático até 3x sem prosody quebrado)
  let edgeSuccess = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(
        voice,
        OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
      );
      // Chamamos toStream sem opções SSML extras que causam fechamento prematuro no Edge
      const { audioStream } = tts.toStream(text);

      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(rawMp3);
        const timeout = setTimeout(() => {
          writeStream.destroy();
          reject(new Error("Edge TTS timeout"));
        }, 12000);

        audioStream.pipe(writeStream);
        writeStream.on("finish", () => {
          clearTimeout(timeout);
          resolve();
        });
        writeStream.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        audioStream.on("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      if (fs.existsSync(rawMp3) && fs.statSync(rawMp3).size > 1000) {
        edgeSuccess = true;
        console.log(
          `   🎙️ [${lang.toUpperCase()}] Voz neural (${voice}) gerada para ${characterKey}`
        );
        break;
      }
    } catch (err) {
      if (attempt === 3) {
        console.warn(
          `[TTS] Edge Neural TTS falhou após 3 tentativas para ${characterKey} (${err.message}), usando fallback...`
        );
      }
    }
  }

  if (!edgeSuccess) {
    const buf = await fetchGoogleTTSBuffer(text, lang);
    fs.writeFileSync(rawMp3, buf);
  }

  // Aplica a modelagem de timbre (especialmente o grave encorpado de Alfa da família do Vlad)
  applyVoiceMastering({
    rawMp3,
    outPath,
    voiceProfile: charConfig.voiceProfile
  });

  if (fs.existsSync(rawMp3)) fs.unlinkSync(rawMp3);
  return outPath;
}
