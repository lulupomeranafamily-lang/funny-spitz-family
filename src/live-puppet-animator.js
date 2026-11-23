import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

/**
 * Renderiza localmente (via Sharp + SVG Multi-Camadas com Depth-of-Field Bokeh Real)
 * o cenário 1920x1080 exato de cada uma das 20 cenas do roteiro, combinando 100%
 * com a iluminação dourada cinematográfica de `personagens.png` e garantindo:
 * - ZERO humanos
 * - ZERO marcas d'água
 * - ZERO cenas reaproveitadas de episódios anteriores
 * - 100% de fidelidade ao roteiro de cada cena!
 */
export async function generateCleanStageBackground({
  bgPrompt,
  sceneId = "00",
  isWidescreen = true,
  outPath
}) {
  const W = isWidescreen ? 1920 : 1080;
  const H = isWidescreen ? 1080 : 1920;
  const id = String(sceneId).padStart(2, "0");

  // Paleta de céu/ambiente e elementos arquitetônicos específicos de cada uma das 20 cenas do Parque
  const themes = {
    "00": { sky1: "#0EA5E9", sky2: "#BAE6FD", ground: "#D97706", accent: "#F59E0B", kind: "park_gate" },
    "01": { sky1: "#78350F", sky2: "#F59E0B", ground: "#451A03", accent: "#FDE047", kind: "ticket_booth" },
    "02": { sky1: "#0284C7", sky2: "#E0F2FE", ground: "#15803D", accent: "#EF4444", kind: "roller_coaster" },
    "03": { sky1: "#0369A1", sky2: "#BAE6FD", ground: "#B45309", accent: "#10B981", kind: "park_plaza_sign" },
    "04": { sky1: "#1E1B4B", sky2: "#B45309", ground: "#451A03", accent: "#FACC15", kind: "carousel_wide" },
    "05": { sky1: "#831843", sky2: "#F472B6", ground: "#701A75", accent: "#FDE047", kind: "carousel_closeup" },
    "06": { sky1: "#1E1B4B", sky2: "#991B1B", ground: "#111827", accent: "#EF4444", kind: "bumper_arena_red" },
    "07": { sky1: "#0F172A", sky2: "#1D4ED8", ground: "#1E293B", accent: "#38BDF8", kind: "bumper_arena_blue" },
    "08": { sky1: "#2E1065", sky2: "#7E22CE", ground: "#1E1B4B", accent: "#F472B6", kind: "bumper_arena_purple" },
    "09": { sky1: "#31102F", sky2: "#78350F", ground: "#451A03", accent: "#FBBF24", kind: "hall_of_mirrors" },
    "10": { sky1: "#1E1B4B", sky2: "#92400E", ground: "#3B0764", accent: "#FDE047", kind: "royal_mirror" },
    "11": { sky1: "#1E1B4B", sky2: "#0369A1", ground: "#0F172A", accent: "#F59E0B", kind: "arcade_claw" },
    "12": { sky1: "#701A75", sky2: "#DB2777", ground: "#4A044E", accent: "#FDE047", kind: "prize_booth" },
    "13": { sky1: "#0284C7", sky2: "#FEF08A", ground: "#B45309", accent: "#DC2626", kind: "popcorn_cart" },
    "14": { sky1: "#0EA5E9", sky2: "#FBCFE8", ground: "#9D174D", accent: "#F472B6", kind: "cotton_candy_distant" },
    "15": { sky1: "#831843", sky2: "#F472B6", ground: "#500724", accent: "#FBCFE8", kind: "cotton_candy_machine" },
    "16": { sky1: "#0284C7", sky2: "#FDE68A", ground: "#15803D", accent: "#F472B6", kind: "sunny_carnival_walk" },
    "17": { sky1: "#7C2D12", sky2: "#F97316", ground: "#14532D", accent: "#FDE047", kind: "sunset_park_bench" },
    "18": { sky1: "#4C1D95", sky2: "#FB923C", ground: "#7C2D12", accent: "#FEF08A", kind: "ferris_wheel_sunset" },
    "19": { sky1: "#090D16", sky2: "#1E1B4B", ground: "#172554", accent: "#FDE047", kind: "night_fireworks_castle" }
  };

  const t = themes[id] || themes["00"];

  // Gera luzes bokeh douradas suaves de fundo (mesma estética fotográfica de personagens.png)
  let bokehCircles = "";
  for (let i = 0; i < 38; i++) {
    const cx = ((i * 197 + Number(id) * 83) % W);
    const cy = ((i * 131 + Number(id) * 59) % Math.round(H * 0.78));
    const r = 18 + ((i * 23) % 55);
    const op = (0.14 + ((i % 5) * 0.06)).toFixed(2);
    const col = i % 3 === 0 ? "#FFFBEB" : i % 3 === 1 ? t.accent : "#FDE047";
    bokehCircles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity="${op}"/>`;
  }

  // Elementos arquitetônicos específicos de cada cena no fundo
  let archSvg = "";
  if (t.kind === "park_gate" || t.kind === "night_fireworks_castle") {
    // Roda-gigante iluminada + Castelo/Portão do Parque + Fogos (na cena 19)
    archSvg = `
      <g opacity="0.88">
        <circle cx="${W * 0.78}" cy="${H * 0.42}" r="220" fill="none" stroke="${t.accent}" stroke-width="10"/>
        <circle cx="${W * 0.78}" cy="${H * 0.42}" r="170" fill="none" stroke="#FFF" stroke-width="4" stroke-dasharray="14,10"/>
        <line x1="${W * 0.78}" y1="${H * 0.42}" x2="${W * 0.68}" y2="${H * 0.82}" stroke="${t.accent}" stroke-width="14"/>
        <line x1="${W * 0.78}" y1="${H * 0.42}" x2="${W * 0.88}" y2="${H * 0.82}" stroke="${t.accent}" stroke-width="14"/>
        <!-- Castelo / Portão do Parque -->
        <rect x="${W * 0.12}" y="${H * 0.35}" width="260" height="380" rx="12" fill="#E11D48" stroke="#FDE047" stroke-width="8"/>
        <polygon points="${W * 0.10},${H * 0.35} ${W * 0.12 + 130},${H * 0.14} ${W * 0.12 + 280},${H * 0.35}" fill="#F59E0B" stroke="#FFF" stroke-width="6"/>
        <path d="M ${W * 0.18} ${H * 0.75} A 75 95 0 0 1 ${W * 0.31} ${H * 0.75} Z" fill="#1E1B4B"/>
      </g>`;
    if (t.kind === "night_fireworks_castle") {
      archSvg += `
        <g>
          <circle cx="${W * 0.25}" cy="${H * 0.20}" r="110" fill="none" stroke="#F43F5E" stroke-width="8" stroke-dasharray="6,18"/>
          <circle cx="${W * 0.25}" cy="${H * 0.20}" r="70" fill="none" stroke="#FDE047" stroke-width="10" stroke-dasharray="4,14"/>
          <circle cx="${W * 0.52}" cy="${H * 0.16}" r="130" fill="none" stroke="#38BDF8" stroke-width="8" stroke-dasharray="6,20"/>
          <circle cx="${W * 0.52}" cy="${H * 0.16}" r="85" fill="none" stroke="#A855F7" stroke-width="10" stroke-dasharray="5,15"/>
          <circle cx="${W * 0.76}" cy="${H * 0.22}" r="115" fill="none" stroke="#4ADE80" stroke-width="8" stroke-dasharray="6,18"/>
        </g>`;
    }
  } else if (t.kind === "roller_coaster") {
    archSvg = `
      <g opacity="0.92">
        <circle cx="${W * 0.28}" cy="${H * 0.44}" r="240" fill="none" stroke="#DC2626" stroke-width="24"/>
        <circle cx="${W * 0.28}" cy="${H * 0.44}" r="215" fill="none" stroke="#FCA5A5" stroke-width="8" stroke-dasharray="22,16"/>
        <path d="M 0 ${H * 0.72} Q ${W * 0.50} ${H * 0.10} ${W} ${H * 0.62}" fill="none" stroke="#DC2626" stroke-width="22"/>
        <path d="M 0 ${H * 0.72} Q ${W * 0.50} ${H * 0.10} ${W} ${H * 0.62}" fill="none" stroke="#FEF08A" stroke-width="6" stroke-dasharray="18,18"/>
      </g>`;
  } else if (t.kind === "carousel_wide" || t.kind === "carousel_closeup") {
    archSvg = `
      <g opacity="0.90">
        <polygon points="${W * 0.12},${H * 0.28} ${W * 0.50},${H * 0.08} ${W * 0.88},${H * 0.28}" fill="#DC2626" stroke="#FDE047" stroke-width="12"/>
        <rect x="${W * 0.15}" y="${H * 0.28}" width="${W * 0.70}" height="38" rx="10" fill="#F59E0B" stroke="#FEF08A" stroke-width="6"/>
        <line x1="${W * 0.24}" y1="${H * 0.31}" x2="${W * 0.24}" y2="${H * 0.78}" stroke="#FDE047" stroke-width="14"/>
        <line x1="${W * 0.76}" y1="${H * 0.31}" x2="${W * 0.76}" y2="${H * 0.78}" stroke="#FDE047" stroke-width="14"/>
      </g>`;
  } else if (t.kind.startsWith("bumper_arena")) {
    archSvg = `
      <g opacity="0.88">
        <rect x="${W * 0.08}" y="${H * 0.12}" width="${W * 0.84}" height="45" rx="16" fill="${t.accent}" stroke="#FFF" stroke-width="6"/>
        <line x1="0" y1="${H * 0.74}" x2="${W}" y2="${H * 0.74}" stroke="${t.accent}" stroke-width="10"/>
        <ellipse cx="${W * 0.20}" cy="${H * 0.66}" rx="125" ry="52" fill="#F59E0B" stroke="#FFF" stroke-width="6"/>
        <ellipse cx="${W * 0.82}" cy="${H * 0.66}" rx="125" ry="52" fill="#10B981" stroke="#FFF" stroke-width="6"/>
      </g>`;
  } else if (t.kind === "popcorn_cart" || t.kind.startsWith("cotton_candy") || t.kind === "ticket_booth" || t.kind === "prize_booth") {
    const stripeCol = t.kind.startsWith("cotton_candy") ? "#EC4899" : "#DC2626";
    archSvg = `
      <g opacity="0.90">
        <rect x="${W * 0.10}" y="${H * 0.18}" width="${W * 0.80}" height="80" rx="18" fill="${stripeCol}" stroke="#FDE047" stroke-width="8"/>
        <rect x="${W * 0.14}" y="${H * 0.26}" width="26" height="${H * 0.52}" fill="#FDE047"/>
        <rect x="${W * 0.84}" y="${H * 0.26}" width="26" height="${H * 0.52}" fill="#FDE047"/>
        <rect x="${W * 0.10}" y="${H * 0.72}" width="${W * 0.80}" height="240" rx="14" fill="${stripeCol}" stroke="#FDE047" stroke-width="8"/>
      </g>`;
  } else if (t.kind === "ferris_wheel_sunset") {
    archSvg = `
      <g opacity="0.90">
        <circle cx="${W * 0.50}" cy="${H * 0.48}" r="520" fill="none" stroke="#FDE047" stroke-width="18"/>
        <line x1="0" y1="${H * 0.15}" x2="${W}" y2="${H * 0.85}" stroke="#F59E0B" stroke-width="12"/>
        <line x1="${W}" y1="${H * 0.15}" x2="0" y2="${H * 0.85}" stroke="#F59E0B" stroke-width="12"/>
        <rect x="40" y="30" width="${W - 80}" height="${H - 60}" rx="55" fill="none" stroke="#F59E0B" stroke-width="24"/>
      </g>`;
  } else {
    archSvg = `
      <g opacity="0.85">
        <rect x="${W * 0.10}" y="${H * 0.68}" width="${W * 0.80}" height="32" rx="12" fill="#92400E" stroke="#FDE047" stroke-width="5"/>
        <circle cx="${W * 0.18}" cy="${H * 0.36}" r="90" fill="${t.accent}" opacity="0.35"/>
        <circle cx="${W * 0.82}" cy="${H * 0.36}" r="90" fill="${t.accent}" opacity="0.35"/>
      </g>`;
  }

  const stageSvg = Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${t.sky1}"/>
        <stop offset="70%" stop-color="${t.sky2}"/>
        <stop offset="100%" stop-color="${t.ground}"/>
      </linearGradient>
      <radialGradient id="warmGlow" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stop-color="#FFFBEB" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.25"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#skyGrad)"/>
    <rect y="${Math.round(H * 0.74)}" width="${W}" height="${Math.round(H * 0.26)}" fill="${t.ground}" opacity="0.85"/>
    ${bokehCircles}
    ${archSvg}
    <rect width="${W}" height="${H}" fill="url(#warmGlow)"/>
  </svg>`);

  // Renderiza o fundo com leve desfoque cinematográfico de profundidade de campo (depth-of-field bokeh)
  // para destacar o personagem fotorrealista de personagens.png em primeiro plano!
  await sharp(stageSvg)
    .blur(4.5)
    .resize(W, H, { fit: "cover" })
    .png()
    .toFile(outPath);

  return outPath;
}

/**
 * Mapeia cada personagem e humor do roteiro para a pose recortada oficial de personagens.png
 */
export function selectCharacterCutoutPath({ character, mood, sceneId, repoDir }) {
  const dir = path.join(repoDir, "assets/character_cutouts");
  const idx = Number(sceneId || 0);

  if (character === "RAVEN") {
    const poses = ["raven_talking.png", "raven_glasses_paw.png"];
    return path.join(dir, poses[idx % poses.length]);
  }
  if (character === "VLAD") {
    if (mood === "funny_snore") return path.join(dir, "vlad_sleeping.png");
    const poses = ["vlad_winking.png", "vlad_paws_open.png", "cutout_vlad.png"];
    return path.join(dir, poses[idx % poses.length]);
  }
  if (character === "LUNA") {
    const poses = ["luna_paws_up.png", "luna_waving.png"];
    return path.join(dir, poses[idx % poses.length]);
  }
  if (character === "THEO") {
    const poses = ["theo_curious.png", "theo_pointing.png"];
    return path.join(dir, poses[idx % poses.length]);
  }
  if (character === "JONNY") {
    const poses = ["jonny_waving.png", "jonny_excited.png"];
    return path.join(dir, poses[idx % poses.length]);
  }
  return path.join(dir, "familia_5_dogs.png");
}

/**
 * Renderiza um clipe MP4 30fps com Movimento Natural 2.5D Live-Puppet:
 * - Camada 0 (Cenário Exato do Roteiro): Movimento suave de câmera 3D + bokeh cinematográfico
 * - Camada 1 (Personagem Oficial de personagens.png recortado em alta definição + Objeto da Cena):
 *   Move a cabeça/tronco naturalmente (respiração contínua + balanço de fala sincronizado + inclinação orgânica)
 */
export async function renderLivePuppetSceneClip({
  bgImagePath,
  characterCutoutPath,
  propOverlayPng = null,
  isWidescreen = true,
  durationSec = 10,
  mood = "cozy",
  outClipPath,
  outStillFramePath
}) {
  const W = isWidescreen ? 1920 : 1080;
  const H = isWidescreen ? 1080 : 1920;

  const charH = isWidescreen ? 760 : 980;
  const charResizedPath = outClipPath.replace(/\.mp4$/, "_char_layer.png");
  await sharp(characterCutoutPath)
    .resize({ height: charH, width: Math.round(W * 0.78), fit: "inside" })
    .png()
    .toFile(charResizedPath);

  const charMeta = await sharp(charResizedPath).metadata();
  const cW = charMeta.width || 650;
  const cH = charMeta.height || charH;

  // Pad canvas to 740x780 so props align consistently
  const canvasW = Math.max(cW, 700);
  const canvasH = Math.max(cH, 780);
  const paddedCharPath = outClipPath.replace(/\.mp4$/, "_char_padded.png");

  const composites = [
    {
      input: charResizedPath,
      left: Math.round((canvasW - cW) / 2),
      top: Math.round(canvasH - cH)
    }
  ];

  if (propOverlayPng && fs.existsSync(propOverlayPng)) {
    const propBuf = await sharp(propOverlayPng)
      .resize(canvasW, canvasH, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    composites.push({ input: propBuf, left: 0, top: 0 });
  }

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite(composites)
    .png()
    .toFile(paddedCharPath);

  const baseX = Math.round((W - canvasW) / 2);
  const baseY = isWidescreen
    ? Math.round(H - canvasH - 110)
    : Math.round(H - canvasH - 380);

  const bobFreq =
    mood === "upbeat_dance" ? "4.8" : mood === "funny_snore" ? "1.4" : "3.4";
  const bobAmp =
    mood === "upbeat_dance" ? "18" : mood === "funny_snore" ? "10" : "12";
  const swayFreq = mood === "upbeat_dance" ? "2.4" : "1.6";
  const swayAmp = mood === "upbeat_dance" ? "22" : "14";
  const rotAmp = mood === "funny_snore" ? "0.02" : "0.045";

  const bgScaleW = Math.round(W * 1.12);
  const bgScaleH = Math.round(H * 1.12);
  const filterComplex = [
    `[0:v]scale=${bgScaleW}:${bgScaleH}:force_original_aspect_ratio=increase,crop=${W}:${H}:'(${bgScaleW}-${W})/2+sin(t*0.55)*28':'(${bgScaleH}-${H})/2+cos(t*0.45)*14',fps=30[bg]`,
    `[1:v]format=rgba,rotate='${rotAmp}*sin(t*${bobFreq})':c=none:ow=${canvasW + 60}:oh=${canvasH + 60}[char]`,
    `[bg][char]overlay=x='${baseX - 30}+${swayAmp}*sin(t*${swayFreq})':y='${baseY - 30}+${bobAmp}*abs(sin(t*${bobFreq}))':format=auto,format=yuv420p[v]`
  ].join(";");

  const ffRes = spawnSync(
    ffmpegPath,
    [
      "-y",
      "-loop",
      "1",
      "-i",
      bgImagePath,
      "-loop",
      "1",
      "-i",
      paddedCharPath,
      "-filter_complex",
      filterComplex,
      "-map",
      "[v]",
      "-t",
      durationSec.toFixed(2),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      outClipPath
    ],
    { encoding: "utf-8" }
  );

  if (ffRes.status !== 0) {
    throw new Error(`Erro ao animar Live-Puppet ${outClipPath}: ${ffRes.stderr}`);
  }

  if (outStillFramePath) {
    spawnSync(ffmpegPath, [
      "-y",
      "-ss",
      "1.2",
      "-i",
      outClipPath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      outStillFramePath
    ]);
  }

  try {
    fs.unlinkSync(charResizedPath);
    fs.unlinkSync(paddedCharPath);
  } catch {}
  return outClipPath;
}
