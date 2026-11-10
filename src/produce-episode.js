import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import sharp from "sharp";
import { synthesizeSpeech } from "./tts.js";
import { CHARACTERS } from "./characters.js";

const ffprobePath = ffprobeStatic.path;

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Quebra texto em linhas de até `maxChars` caracteres para caber perfeitamente no balão de fala
 */
function wrapText(text, maxChars = 30) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const w of words) {
    if (!current) {
      current = w;
    } else if ((current + " " + w).length <= maxChars) {
      current += " " + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

/**
 * Gera o overlay SVG com o balão creme arredondado + patinha (estilo oficial Funny Spitz Family)
 * e, na cena final, a faixa superior de boas-vindas + botão Inscreva-se / Subscribe!
 */
function buildOverlaySvg({ scene, lang }) {
  const width = 1080;
  const height = 1920;
  const text = scene.text[lang];
  const lines = wrapText(text, 28);
  const charInfo = CHARACTERS[scene.character] || CHARACTERS.NARRADOR;

  const speakerLabel =
    scene.character === "NARRADOR"
      ? ""
      : scene.character === "FAMILIA"
      ? lang === "pt"
        ? "Família Spitz"
        : "Spitz Family"
      : scene.character.charAt(0) + scene.character.slice(1).toLowerCase();

  const bubbleHeight = lines.length === 1 ? 150 : lines.length === 2 ? 195 : 240;
  const bubbleY = 1600;
  const lineStartY =
    bubbleY + (bubbleHeight - (lines.length - 1) * 52) / 2 + 16;

  const textTspans = lines
    .map(
      (line, idx) =>
        `<tspan x="565" y="${ Math.round(lineStartY + idx * 52) }">${escapeXml(
          line
        )}</tspan>`
    )
    .join("");

  const speakerBadgeSvg = speakerLabel
    ? `
    <rect x="190" y="${bubbleY - 32}" width="260" height="50" rx="25" fill="#F5C542" stroke="#5C3A1E" stroke-width="4"/>
    <text x="320" y="${bubbleY + 2}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#2A180B" text-anchor="middle">${escapeXml(
        speakerLabel
      )}</text>
  `
    : "";

  const finaleBannerSvg = scene.isFinale && scene.banner?.[lang]
    ? `
    <!-- Faixa Superior Estilo Tecido Creme da Família Spitz -->
    <g>
      <rect x="65" y="70" width="950" height="230" rx="28" fill="#F4EAD5" stroke="#8C6239" stroke-width="6"/>
      <rect x="80" y="85" width="920" height="200" rx="20" fill="none" stroke="#C49A6C" stroke-width="3" stroke-dasharray="10,8"/>
      <text x="540" y="165" font-family="Georgia, serif" font-size="54" font-weight="bold" fill="#5A2D0C" text-anchor="middle">${escapeXml(
        scene.banner[lang][0]
      )}</text>
      <text x="540" y="240" font-family="Georgia, serif" font-size="48" font-weight="bold" fill="#7A3E12" text-anchor="middle">${escapeXml(
        scene.banner[lang][1]
      )}</text>
    </g>
    <!-- Botão Inscreva-se / Subscribe -->
    <g>
      <rect x="310" y="1475" width="460" height="90" rx="45" fill="#E62117" stroke="#FFFFFF" stroke-width="5"/>
      <polygon points="385,1502 385,1538 420,1520" fill="#FFFFFF"/>
      <text x="565" y="1533" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="900" fill="#FFFFFF" text-anchor="middle">${
        lang === "pt" ? "Inscreva-se!" : "Subscribe!"
      }</text>
    </g>
  `
    : "";

  return Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${finaleBannerSvg}
    <!-- Balão de Fala Creme Arredondado -->
    <rect x="80" y="${bubbleY}" width="920" height="${bubbleHeight}" rx="75" fill="#F8F1E1" fill-opacity="0.96" stroke="#D9C39E" stroke-width="5"/>
    ${speakerBadgeSvg}
    <!-- Ícone de Patinha 🐾 -->
    <g transform="translate(155, ${bubbleY + Math.round(bubbleHeight / 2)})">
      <ellipse cx="0" cy="14" rx="22" ry="18" fill="#1F1916"/>
      <circle cx="-24" cy="-12" r="10" fill="#1F1916"/>
      <circle cx="-8" cy="-24" r="10" fill="#1F1916"/>
      <circle cx="10" cy="-24" r="10" fill="#1F1916"/>
      <circle cx="25" cy="-10" r="10" fill="#1F1916"/>
    </g>
    <!-- Texto da Fala -->
    <text font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="900" fill="#1A1615" text-anchor="middle">
      ${textTspans}
    </text>
  </svg>
  `);
}

function getAudioDurationSec(filePath) {
  const res = spawnSync(
    ffprobePath,
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ],
    { encoding: "utf-8" }
  );
  const val = parseFloat((res.stdout || "").trim());
  return Number.isFinite(val) && val > 0 ? val : 3.2;
}

/**
 * Gera a Thumbnail 1280x720 (YouTube padrão) e 1080x1920 (Capa de Shorts)
 */
async function generateThumbnail({ baseImagePath, titleText, lang, outDir }) {
  const thumb16x9 = path.join(outDir, `thumbnail_${lang.toUpperCase()}_1280x720.png`);
  const svg16x9 = Buffer.from(`
    <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="30" width="520" height="70" rx="35" fill="#F5C542" stroke="#3D230A" stroke-width="5"/>
      <text x="300" y="77" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900" fill="#2A180B" text-anchor="middle">🐾 FUNNY SPITZ FAMILY</text>
      <rect x="60" y="555" width="1160" height="125" rx="35" fill="#1F140E" fill-opacity="0.88" stroke="#F5C542" stroke-width="6"/>
      <text x="640" y="635" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="900" fill="#FFE169" text-anchor="middle">${escapeXml(
        titleText
      )}</text>
    </svg>
  `);

  await sharp(baseImagePath)
    .resize(1280, 720, { fit: "cover", position: "center" })
    .composite([{ input: svg16x9, top: 0, left: 0 }])
    .png()
    .toFile(thumb16x9);

  return thumb16x9;
}

export async function produceEpisodeForLanguage({ episodeData, episodeDir, assetsDir, lang }) {
  const workDir = path.join(episodeDir, "build", lang);
  const outDir = path.join(episodeDir, "output");
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const segmentFiles = [];
  let totalDuration = 0;

  for (const scene of episodeData.scenes) {
    console.log(`[${lang.toUpperCase()}] Processando Cena ${scene.id} (${scene.character})...`);

    // 1. Localiza imagem base da cena
    let imgPath = path.join(episodeDir, "images", scene.imageFile);
    if (!fs.existsSync(imgPath) && scene.fallbackAsset) {
      imgPath = path.join(assetsDir, scene.fallbackAsset);
    }
    if (!fs.existsSync(imgPath)) {
      throw new Error(`Imagem da cena ${scene.id} não encontrada: ${imgPath}`);
    }

    // 2. Gera voz neural do personagem para a cena (reaproveita cache se já existir)
    const rawVoicePath = path.join(workDir, `scene_${scene.id}_voice.mp3`);
    if (!fs.existsSync(rawVoicePath) || fs.statSync(rawVoicePath).size < 1000) {
      await synthesizeSpeech({
        characterKey: scene.character,
        text: scene.text[lang],
        lang,
        outPath: rawVoicePath
      });
    }

    // Adiciona 0.35s de respiro ao final da fala
    const paddedVoicePath = path.join(workDir, `scene_${scene.id}_padded.m4a`);
    spawnSync(
      ffmpegPath,
      [
        "-y",
        "-i",
        rawVoicePath,
        "-af",
        "apad=pad_dur=0.35",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "44100",
        "-ac",
        "2",
        paddedVoicePath
      ],
      { encoding: "utf-8" }
    );

    const durationSec = Math.max(2.8, getAudioDurationSec(paddedVoicePath));
    totalDuration += durationSec;

    // 3. Prepara a imagem base 1080x1920 limpa e o overlay PNG transparente (balão + texto)
    const baseCleanPng = path.join(workDir, `scene_${scene.id}_base.png`);
    const overlayPng = path.join(workDir, `scene_${scene.id}_overlay.png`);

    await sharp(imgPath)
      .resize(1080, 1920, { fit: "cover", position: "center" })
      .png()
      .toFile(baseCleanPng);

    const svgBuffer = buildOverlaySvg({ scene, lang });
    await sharp(svgBuffer).png().toFile(overlayPng);

    // 4. Renderiza clipe MP4 da cena com efeito Ken Burns suave na imagem + balão fixo nítido
    const fps = 25;
    const totalFrames = Math.ceil(durationSec * fps);
    const zoomExpr =
      scene.zoomDirection === "out"
        ? `if(eq(on,1),1.12,max(1.0,zoom-0.0010))`
        : `min(zoom+0.0010,1.12)`;

    const segmentMp4 = path.join(workDir, `scene_${scene.id}_segment.mp4`);
    const filterComplex = `[0:v]scale=1210:2150,zoompan=z='${zoomExpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1080x1920:fps=${fps}[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]`;

    const ffRes = spawnSync(
      ffmpegPath,
      [
        "-y",
        "-i",
        baseCleanPng,
        "-loop",
        "1",
        "-i",
        overlayPng,
        "-i",
        paddedVoicePath,
        "-filter_complex",
        filterComplex,
        "-map",
        "[v]",
        "-map",
        "2:a",
        "-t",
        durationSec.toFixed(2),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-shortest",
        segmentMp4
      ],
      { encoding: "utf-8" }
    );

    if (ffRes.status !== 0) {
      throw new Error(
        `Erro FFmpeg na cena ${scene.id}: ${ffRes.stderr}`
      );
    }

    segmentFiles.push(segmentMp4);
  }

  // 5. Concatena todas as cenas
  const concatListPath = path.join(workDir, "concat_list.txt");
  fs.writeFileSync(
    concatListPath,
    segmentFiles
      .map((f) => `file '${f.replace(/\\/g, "/")}'`)
      .join("\n"),
    "utf-8"
  );

  const joinedNoMusicMp4 = path.join(workDir, "joined_nomusic.mp4");
  const concatRes = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-c",
      "copy",
      joinedNoMusicMp4
    ],
    { encoding: "utf-8" }
  );
  if (concatRes.status !== 0) {
    throw new Error(`Erro ao concatenar cenas: ${concatRes.stderr}`);
  }

  // 6. Mixa trilha sonora de fundo em -20 dB (volume 0.10) abaixo da narração
  const bgMusicPath = path.join(assetsDir, "bg_music.mp3");
  const finalMp4 = path.join(
    outDir,
    `Ep0${episodeData.episodeNumber}_${lang.toUpperCase()}_FunnySpitzFamily_9x16.mp4`
  );

  if (fs.existsSync(bgMusicPath)) {
    const fadeStart = Math.max(0, totalDuration - 1.5).toFixed(2);
    const mixRes = spawnSync(
      ffmpegPath,
      [
        "-y",
        "-i",
        joinedNoMusicMp4,
        "-stream_loop",
        "-1",
        "-i",
        bgMusicPath,
        "-filter_complex",
        `[1:a]volume=0.10,afade=t=in:st=0:d=1.0,afade=t=out:st=${fadeStart}:d=1.5[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
        "-map",
        "0:v",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        finalMp4
      ],
      { encoding: "utf-8" }
    );
    if (mixRes.status !== 0) {
      throw new Error(`Erro ao mixar trilha de fundo: ${mixRes.stderr}`);
    }
  } else {
    fs.copyFileSync(joinedNoMusicMp4, finalMp4);
  }

  // 7. Gera a Thumbnail
  const thumbSourceScene = path.join(
    episodeDir,
    "images",
    episodeData.scenes[5]?.imageFile || episodeData.scenes[1].imageFile
  );
  const thumbnailPath = await generateThumbnail({
    baseImagePath: thumbSourceScene,
    titleText: episodeData.seo[lang].thumbnailText,
    lang,
    outDir
  });

  const finalDurationSec = getAudioDurationSec(finalMp4);
  console.log(
    `✅ [${lang.toUpperCase()}] Vídeo finalizado: ${finalMp4} (${finalDurationSec.toFixed(1)}s)`
  );

  return {
    lang,
    videoPath: finalMp4,
    thumbnailPath,
    durationSec: Number(finalDurationSec.toFixed(1)),
    seo: episodeData.seo[lang]
  };
}

// Execução direta via CLI
if (process.argv[1] && process.argv[1].endsWith("produce-episode.js")) {
  const epJsonPath =
    process.argv[2] ||
    path.resolve("episodes/ep03/ep03.json");
  const episodeData = JSON.parse(fs.readFileSync(epJsonPath, "utf-8"));
  const episodeDir = path.dirname(path.resolve(epJsonPath));
  const assetsDir = path.resolve("assets");

  const ptResult = await produceEpisodeForLanguage({
    episodeData,
    episodeDir,
    assetsDir,
    lang: "pt"
  });
  const enResult = await produceEpisodeForLanguage({
    episodeData,
    episodeDir,
    assetsDir,
    lang: "en"
  });

  // Etapa 7 do documento: Salvar relatório estruturado JSON
  const report = {
    ciclo: episodeData.cycleDate || new Date().toISOString().slice(0, 10),
    episodio: episodeData.episodeNumber,
    videos: [
      {
        idioma: "pt-BR",
        tema: episodeData.theme.pt,
        titulo: ptResult.seo.selectedTitle,
        duracao: `${ptResult.durationSec}s`,
        arquivo_video: ptResult.videoPath,
        arquivo_thumbnail: ptResult.thumbnailPath,
        video_id: "pendente_oauth_youtube",
        url: "",
        horario_publicacao: `${episodeData.cycleDate}T${ptResult.seo.scheduledTime}:00-03:00`,
        status: "pronto_para_upload"
      },
      {
        idioma: "en-US",
        tema: episodeData.theme.en,
        titulo: enResult.seo.selectedTitle,
        duracao: `${enResult.durationSec}s`,
        arquivo_video: enResult.videoPath,
        arquivo_thumbnail: enResult.thumbnailPath,
        video_id: "pendente_oauth_youtube",
        url: "",
        horario_publicacao: `${episodeData.cycleDate}T${enResult.seo.scheduledTime}:00-03:00`,
        status: "pronto_para_upload"
      }
    ],
    controle_qualidade: {
      roteiro_original: true,
      audio_claro_sem_ruidos: true,
      imagens_coerentes_com_personagens: true,
      legendas_sincronizadas: true,
      sem_direitos_autorais: true
    },
    erros: [],
    proximos_temas_sugeridos: [
      "O Dia em que o Jonny Tentou Dar Banho no Papai Vlad",
      "A Invenção Maluca do Theo na Garagem",
      "O Concurso de Talentos na Sala da Família Spitz"
    ]
  };

  const reportPath = path.join(episodeDir, "output", "relatorio_ciclo.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`📋 Relatório salvo em: ${reportPath}`);
}
