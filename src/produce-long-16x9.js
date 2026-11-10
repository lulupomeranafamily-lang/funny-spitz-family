import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import sharp from "sharp";
import { synthesizeSpeech } from "./tts.js";
import { CHARACTERS } from "./characters.js";
import { generateSfxWav, generateMoodMusicWav } from "./audio-fx.js";
import { generateVeoRealMotionClip } from "./veo-video.js";

const ffprobePath = ffprobeStatic.path;

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text, maxChars = 58) {
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
 * Gera camada de Efeitos Visuais Especiais (VFX) em SVG + Balão Widescreen 16:9 (1920x1080)
 */
function buildWidescreenVfxAndOverlaySvg({ scene, lang }) {
  const width = 1920;
  const height = 1080;
  const text = scene.text[lang];
  const lines = wrapText(text, 56);

  const speakerLabel =
    scene.character === "NARRADOR"
      ? lang === "pt"
        ? "Narrador"
        : "Narrator"
      : scene.character === "FAMILIA"
      ? lang === "pt"
        ? "Família Spitz"
        : "Spitz Family"
      : scene.character.charAt(0) + scene.character.slice(1).toLowerCase();

  // Efeitos Especiais Visuais por Cena (VFX)
  let vfxSvg = "";
  if (scene.vfx === "fireflies" || scene.vfx === "sparkles") {
    vfxSvg = `
      <g opacity="0.88">
        <circle cx="220" cy="180" r="10" fill="#FFE875"/>
        <circle cx="220" cy="180" r="24" fill="#FFE875" opacity="0.35"/>
        <circle cx="1680" cy="220" r="12" fill="#FFE875"/>
        <circle cx="1680" cy="220" r="28" fill="#FFE875" opacity="0.35"/>
        <circle cx="1490" cy="480" r="9" fill="#FFF2A6"/>
        <circle cx="340" cy="520" r="11" fill="#FFE875"/>
        <text x="1620" y="160" font-size="64" fill="#FFE875">✨</text>
        <text x="260" y="290" font-size="56" fill="#FFE875">✨</text>
      </g>
    `;
  } else if (scene.vfx === "shock_lines") {
    vfxSvg = `
      <g>
        <rect x="0" y="0" width="1920" height="1080" fill="none" stroke="#FF4B2B" stroke-width="24" stroke-opacity="0.45"/>
        <circle cx="1640" cy="210" r="78" fill="#FF3B30" stroke="#FFFFFF" stroke-width="6"/>
        <text x="1640" y="242" font-family="Arial, sans-serif" font-size="95" font-weight="900" fill="#FFFFFF" text-anchor="middle">!?</text>
        <circle cx="280" cy="210" r="68" fill="#FFB800" stroke="#FFFFFF" stroke-width="6"/>
        <text x="280" y="238" font-family="Arial, sans-serif" font-size="85" font-weight="900" fill="#2A180B" text-anchor="middle">!</text>
      </g>
    `;
  } else if (scene.vfx === "magnifying_spotlight") {
    vfxSvg = `
      <g>
        <!-- Moldura de Lupa / Vinheta de Suspense -->
        <rect x="0" y="0" width="1920" height="1080" fill="none" stroke="#120E0A" stroke-width="70" stroke-opacity="0.55"/>
        <rect x="60" y="50" width="380" height="64" rx="32" fill="#2A180B" fill-opacity="0.85" stroke="#F5C542" stroke-width="4"/>
        <text x="250" y="92" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="#FFE169" text-anchor="middle">🔍 ${
          lang === "pt" ? "MODO DETETIVE" : "DETECTIVE MODE"
        }</text>
      </g>
    `;
  } else if (scene.vfx === "disco_notes") {
    vfxSvg = `
      <g>
        <!-- Luzes Neon de Festa Dançante e Notas Musicais -->
        <circle cx="180" cy="160" r="140" fill="#FF2E93" opacity="0.28"/>
        <circle cx="1740" cy="180" r="160" fill="#00E5FF" opacity="0.28"/>
        <circle cx="960" cy="100" r="130" fill="#FFE600" opacity="0.22"/>
        <text x="220" y="230" font-family="Arial, sans-serif" font-size="95" font-weight="bold" fill="#FF47B6">♪</text>
        <text x="1650" y="250" font-family="Arial, sans-serif" font-size="105" font-weight="bold" fill="#00F0FF">♫</text>
        <text x="1520" y="420" font-family="Arial, sans-serif" font-size="80" font-weight="bold" fill="#FFE600">♬</text>
        <text x="340" y="410" font-family="Arial, sans-serif" font-size="85" font-weight="bold" fill="#00F0FF">♪</text>
      </g>
    `;
  } else if (scene.vfx === "zzz_bubbles") {
    vfxSvg = `
      <g>
        <circle cx="1420" cy="310" r="42" fill="#FFFDF7" fill-opacity="0.9" stroke="#5C3A1E" stroke-width="4"/>
        <text x="1420" y="325" font-family="Georgia, serif" font-size="44" font-weight="bold" fill="#2A180B" text-anchor="middle">Z</text>
        <circle cx="1520" cy="215" r="54" fill="#FFFDF7" fill-opacity="0.92" stroke="#5C3A1E" stroke-width="4"/>
        <text x="1520" y="233" font-family="Georgia, serif" font-size="56" font-weight="bold" fill="#2A180B" text-anchor="middle">Zz</text>
        <circle cx="1645" cy="115" r="68" fill="#FFFDF7" fill-opacity="0.95" stroke="#5C3A1E" stroke-width="5"/>
        <text x="1645" y="136" font-family="Georgia, serif" font-size="66" font-weight="bold" fill="#2A180B" text-anchor="middle">Zzz...</text>
      </g>
    `;
  } else if (scene.vfx === "hearts_confetti") {
    vfxSvg = `
      <g>
        <text x="180" y="220" font-size="78" fill="#FF3366">❤️</text>
        <text x="1710" y="220" font-size="78" fill="#FF3366">❤️</text>
        <text x="310" y="390" font-size="68" fill="#FFD700">✨</text>
        <text x="1590" y="390" font-size="68" fill="#FFD700">✨</text>
      </g>
    `;
  }

  const finaleBannerSvg =
    scene.isFinale && scene.banner?.[lang]
      ? `
      <g>
        <rect x="410" y="35" width="1100" height="150" rx="28" fill="#F4EAD5" fill-opacity="0.95" stroke="#8C6239" stroke-width="6"/>
        <text x="960" y="98" font-family="Georgia, serif" font-size="48" font-weight="bold" fill="#5A2D0C" text-anchor="middle">${escapeXml(
          scene.banner[lang][0]
        )}</text>
        <text x="960" y="158" font-family="Arial, sans-serif" font-size="38" font-weight="900" fill="#E62117" text-anchor="middle">▶ ${escapeXml(
          scene.banner[lang][1]
        )}</text>
      </g>
    `
      : "";

  const bubbleHeight = lines.length === 1 ? 130 : 165;
  const bubbleY = 875;
  const lineStartY =
    bubbleY + (bubbleHeight - (lines.length - 1) * 48) / 2 + 15;

  const textTspans = lines
    .map(
      (line, idx) =>
        `<tspan x="1010" y="${Math.round(lineStartY + idx * 48)}">${escapeXml(
          line
        )}</tspan>`
    )
    .join("");

  return Buffer.from(`
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${vfxSvg}
    ${finaleBannerSvg}
    <!-- Balão de Fala Widescreen 16:9 -->
    <rect x="180" y="${bubbleY}" width="1560" height="${bubbleHeight}" rx="65" fill="#F8F1E1" fill-opacity="0.95" stroke="#D9C39E" stroke-width="5"/>
    <!-- Badge do Personagem -->
    <rect x="260" y="${bubbleY - 30}" width="280" height="50" rx="25" fill="#F5C542" stroke="#5C3A1E" stroke-width="4"/>
    <text x="400" y="${bubbleY + 4}" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="900" fill="#2A180B" text-anchor="middle">${escapeXml(
    speakerLabel
  )}</text>
    <!-- Ícone de Patinha 🐾 -->
    <g transform="translate(255, ${bubbleY + Math.round(bubbleHeight / 2) + 8})">
      <ellipse cx="0" cy="12" rx="20" ry="16" fill="#1F1916"/>
      <circle cx="-22" cy="-10" r="9" fill="#1F1916"/>
      <circle cx="-7" cy="-21" r="9" fill="#1F1916"/>
      <circle cx="9" cy="-21" r="9" fill="#1F1916"/>
      <circle cx="23" cy="-9" r="9" fill="#1F1916"/>
    </g>
    <!-- Texto da Fala -->
    <text font-family="Arial, Helvetica, sans-serif" font-size="37" font-weight="900" fill="#1A1615" text-anchor="middle">
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
  return Number.isFinite(val) && val > 0 ? val : 5.0;
}

/**
 * Expressões de Movimento Cinematográfico Dinâmico (Movimento de Câmera, Balanço de Dança, Shake de Choque, Respiração)
 */
function buildMotionFilterExpr(motionType, totalFrames, fps) {
  if (motionType === "crash_zoom_shake") {
    // Zoom rápido dramático + tremor de choque nos primeiros frames
    return `scale=2304:1296,zoompan=z='min(1.18,1.0+on*0.0035)':x='iw/2-(iw/zoom/2)+if(lt(on,28),sin(on*1.9)*14,0)':y='ih/2-(ih/zoom/2)+if(lt(on,28),cos(on*2.3)*10,0)':d=${totalFrames}:s=1920x1080:fps=${fps},eq=contrast=1.05:saturation=1.08`;
  }
  if (motionType === "dance_bounce") {
    // Movimento rítmico dançante (pulsação no compasso de 128 BPM + balanço lateral + brilho colorido)
    return `scale=2304:1296,zoompan=z='1.09+0.035*abs(sin(on*0.26))':x='iw/2-(iw/zoom/2)+sin(on*0.13)*36':y='ih/2-(ih/zoom/2)+abs(cos(on*0.26))*24':d=${totalFrames}:s=1920x1080:fps=${fps},hue=H='sin(t*3)*8':s=1.15`;
  }
  if (motionType === "breathing_zoom") {
    // Movimento suave de respiração/ronco na barriga do Papai Vlad dormindo
    return `scale=2304:1296,zoompan=z='1.08+0.03*sin(on*0.09)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+sin(on*0.09)*14':d=${totalFrames}:s=1920x1080:fps=${fps}`;
  }
  if (motionType === "detective_pan") {
    // Panorâmica investigativa horizontal buscando pistas na sala
    return `scale=2304:1296,zoompan=z='1.12':x='(iw-iw/zoom)*(on/${totalFrames})':y='ih/2-(ih/zoom/2)+sin(on*0.08)*10':d=${totalFrames}:s=1920x1080:fps=${fps}`;
  }
  if (motionType === "pan_right_zoom_in") {
    return `scale=2304:1296,zoompan=z='1.02+0.10*(on/${totalFrames})':x='(iw-iw/zoom)*0.3+(iw-iw/zoom)*0.4*(on/${totalFrames})':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1920x1080:fps=${fps}`;
  }
  // gentle_float / celebration_zoom
  return `scale=2304:1296,zoompan=z='1.04+0.08*(on/${totalFrames})':x='iw/2-(iw/zoom/2)+sin(on*0.07)*16':y='ih/2-(ih/zoom/2)+cos(on*0.07)*10':d=${totalFrames}:s=1920x1080:fps=${fps}`;
}

async function generateWidescreenThumbnail({ baseImagePath, titleText, lang, outDir }) {
  const thumbPath = path.join(outDir, `thumbnail_16x9_${lang.toUpperCase()}.png`);
  const svg = Buffer.from(`
    <svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="30" width="540" height="72" rx="36" fill="#F5C542" stroke="#3D230A" stroke-width="5"/>
      <text x="310" y="78" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900" fill="#2A180B" text-anchor="middle">🐾 FUNNY SPITZ FAMILY</text>
      <rect x="60" y="555" width="1160" height="125" rx="35" fill="#1F140E" fill-opacity="0.90" stroke="#F5C542" stroke-width="6"/>
      <text x="640" y="635" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="900" fill="#FFE169" text-anchor="middle">${escapeXml(
        titleText
      )}</text>
    </svg>
  `);

  await sharp(baseImagePath)
    .resize(1280, 720, { fit: "cover", position: "center" })
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toFile(thumbPath);

  return thumbPath;
}

export async function produceLongEpisode16x9({ episodeData, episodeDir, lang }) {
  const workDir = path.join(episodeDir, "build", lang);
  const outDir = path.join(episodeDir, "output");
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const segmentFiles = [];

  for (const scene of episodeData.scenes) {
    console.log(
      `🎬 [16:9 ${lang.toUpperCase()}] Cena ${scene.id} (${scene.character}) | Clima: ${scene.mood} | SFX: ${scene.sfx} | Motion: ${scene.motion}`
    );

    const imgPath = path.join(episodeDir, "images", scene.imageFile);
    if (!fs.existsSync(imgPath)) {
      throw new Error(`Imagem 16:9 não encontrada: ${imgPath}`);
    }

    // 1. Voz neural do personagem (com Vlad Alfa bem grave nas cenas 07 e 08)
    const rawVoicePath = path.join(workDir, `scene_${scene.id}_voice.mp3`);
    if (!fs.existsSync(rawVoicePath) || fs.statSync(rawVoicePath).size < 1000) {
      await synthesizeSpeech({
        characterKey: scene.character,
        text: scene.text[lang],
        lang,
        outPath: rawVoicePath
      });
    }

    // Adiciona pequeno respiro antes (0.35s) para o efeito especial sonoro brilhar e depois (0.55s)
    const paddedVoicePath = path.join(workDir, `scene_${scene.id}_voice_pad.wav`);
    spawnSync(
      ffmpegPath,
      [
        "-y",
        "-i",
        rawVoicePath,
        "-af",
        "adelay=350|350,apad=pad_dur=0.55",
        "-ar",
        "44100",
        "-ac",
        "2",
        paddedVoicePath
      ],
      { encoding: "utf-8" }
    );

    const durationSec = Math.max(4.5, getAudioDurationSec(paddedVoicePath));

    // 2. Gera Efeito Sonoro Especial (SFX) e Música Dinâmica da Cena (Suspense / Dançante / Comédia / Festa)
    const sfxWavPath = path.join(workDir, `scene_${scene.id}_sfx.wav`);
    const moodMusicWavPath = path.join(workDir, `scene_${scene.id}_bgm.wav`);
    generateSfxWav(scene.sfx || "chime", sfxWavPath);
    generateMoodMusicWav({
      mood: scene.mood || "cozy",
      durationSec,
      outPath: moodMusicWavPath
    });

    // Mixa Voz + Efeito Especial Sonoro + Música Dinâmica da Cena
    const mixedAudioM4a = path.join(workDir, `scene_${scene.id}_mixed_audio.m4a`);
    const audioMixRes = spawnSync(
      ffmpegPath,
      [
        "-y",
        "-i",
        paddedVoicePath,
        "-i",
        sfxWavPath,
        "-i",
        moodMusicWavPath,
        "-filter_complex",
        "[0:a]volume=1.35[v];[1:a]volume=0.42[sfx];[2:a]volume=0.22[bgm];[v][sfx][bgm]amix=inputs=3:duration=first:dropout_transition=1[aout]",
        "-map",
        "[aout]",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "44100",
        "-ac",
        "2",
        mixedAudioM4a
      ],
      { encoding: "utf-8" }
    );
    if (audioMixRes.status !== 0) {
      throw new Error(`Erro ao mixar áudio da cena ${scene.id}: ${audioMixRes.stderr}`);
    }

    // 3. Prepara imagem Widescreen 1920x1080 e Overlay de VFX + Legenda
    const baseCleanPng = path.join(workDir, `scene_${scene.id}_base16x9.png`);
    const overlayPng = path.join(workDir, `scene_${scene.id}_overlay16x9.png`);

    await sharp(imgPath)
      .resize(1920, 1080, { fit: "cover", position: "center" })
      .png()
      .toFile(baseCleanPng);

    const svgBuffer = buildWidescreenVfxAndOverlaySvg({ scene, lang });
    await sharp(svgBuffer).png().toFile(overlayPng);

    // 4. Verifica se há clipe MP4 com movimento real (Google Veo / Flow / Hailuo) na pasta clips/ ou gera via Veo API
    const clipsDir = path.join(episodeDir, "clips");
    fs.mkdirSync(clipsDir, { recursive: true });
    let realMotionVideoPath = scene.videoFile
      ? path.join(clipsDir, scene.videoFile)
      : path.join(clipsDir, `scene_${scene.id}.mp4`);

    if (!fs.existsSync(realMotionVideoPath) && process.env.ENABLE_VEO_API === "true") {
      await generateVeoRealMotionClip({
        imagePath: baseCleanPng,
        motionPrompt: scene.motionPrompt || `${scene.character} Pomeranian dog moving naturally: ${scene.text.en}`,
        aspectRatio: "16:9",
        outVideoPath: realMotionVideoPath
      });
    }

    const fps = 25;
    const totalFrames = Math.ceil(durationSec * fps);
    const segmentMp4 = path.join(workDir, `scene_${scene.id}_segment16x9.mp4`);

    let ffRes;
    if (fs.existsSync(realMotionVideoPath)) {
      console.log(`   🎥 Usando clipe com movimento real 3D: ${path.basename(realMotionVideoPath)}`);
      const filterComplex = `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=${fps}[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]`;
      ffRes = spawnSync(
        ffmpegPath,
        [
          "-y",
          "-stream_loop",
          "-1",
          "-i",
          realMotionVideoPath,
          "-loop",
          "1",
          "-i",
          overlayPng,
          "-i",
          mixedAudioM4a,
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
          "19",
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
    } else {
      const motionExpr = buildMotionFilterExpr(scene.motion, totalFrames, fps);
      const filterComplex = `[0:v]${motionExpr}[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]`;

      ffRes = spawnSync(
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
          mixedAudioM4a,
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
          "19",
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
    }

    if (ffRes.status !== 0) {
      throw new Error(`Erro FFmpeg 16:9 na cena ${scene.id}: ${ffRes.stderr}`);
    }

    segmentFiles.push(segmentMp4);
  }

  // 5. Concatena todas as 10 cenas Widescreen 16:9
  const concatListPath = path.join(workDir, "concat_16x9.txt");
  fs.writeFileSync(
    concatListPath,
    segmentFiles.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"),
    "utf-8"
  );

  const finalMp4 = path.join(
    outDir,
    `Ep0${episodeData.episodeNumber}_Longo_16x9_${lang.toUpperCase()}_FunnySpitzFamily.mp4`
  );

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
      "-movflags",
      "+faststart",
      finalMp4
    ],
    { encoding: "utf-8" }
  );
  if (concatRes.status !== 0) {
    throw new Error(`Erro ao concatenar vídeo 16:9: ${concatRes.stderr}`);
  }

  // 6. Gera a Thumbnail 16:9 de Alta Conversão
  const thumbSource = path.join(
    episodeDir,
    "images",
    episodeData.scenes[7]?.imageFile || episodeData.scenes[2].imageFile
  );
  const thumbnailPath = await generateWidescreenThumbnail({
    baseImagePath: thumbSource,
    titleText: episodeData.seo[lang].thumbnailText,
    lang,
    outDir
  });

  const finalDurationSec = getAudioDurationSec(finalMp4);
  console.log(
    `✅ [16:9 ${lang.toUpperCase()}] Vídeo Longo finalizado: ${finalMp4} (${finalDurationSec.toFixed(1)}s)`
  );

  return {
    lang,
    videoPath: finalMp4,
    thumbnailPath,
    durationSec: Number(finalDurationSec.toFixed(1)),
    seo: episodeData.seo[lang]
  };
}

if (process.argv[1] && process.argv[1].endsWith("produce-long-16x9.js")) {
  const epJsonPath =
    process.argv[2] || path.resolve("episodes/ep03_long/ep03_long.json");
  const episodeData = JSON.parse(fs.readFileSync(epJsonPath, "utf-8"));
  const episodeDir = path.dirname(path.resolve(epJsonPath));

  const ptRes = await produceLongEpisode16x9({
    episodeData,
    episodeDir,
    lang: "pt"
  });
  const enRes = await produceLongEpisode16x9({
    episodeData,
    episodeDir,
    lang: "en"
  });

  const report = {
    ciclo: episodeData.cycleDate,
    formato: "16:9_longo",
    episodio: episodeData.episodeNumber,
    videos: [
      {
        idioma: "pt-BR",
        tema: episodeData.theme.pt,
        titulo: ptRes.seo.selectedTitle,
        duracao: `${ptRes.durationSec}s`,
        arquivo_video: ptRes.videoPath,
        arquivo_thumbnail: ptRes.thumbnailPath,
        video_id: "pendente_aprovacao",
        url: "",
        horario_publicacao: `${episodeData.cycleDate}T17:00:00-03:00`,
        status: "pronto_para_aprovacao"
      },
      {
        idioma: "en-US",
        tema: episodeData.theme.en,
        titulo: enRes.seo.selectedTitle,
        duracao: `${enRes.durationSec}s`,
        arquivo_video: enRes.videoPath,
        arquivo_thumbnail: enRes.thumbnailPath,
        video_id: "pendente_aprovacao",
        url: "",
        horario_publicacao: `${episodeData.cycleDate}T17:00:00-03:00`,
        status: "pronto_para_aprovacao"
      }
    ]
  };

  const reportPath = path.join(episodeDir, "output", "relatorio_ciclo_16x9.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`📋 Relatório 16:9 salvo em: ${reportPath}`);
}
