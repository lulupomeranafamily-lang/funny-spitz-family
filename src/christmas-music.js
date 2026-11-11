import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const SAMPLE_RATE = 44100;

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Gera uma trilha musical natalina 100% original / domínio público (Celesta Mágica + Guizos de Trenó Sleigh Bells + Baixo Pizzicato Acolhedor)
 * Totalmente livre de direitos autorais (Royalty-Free / Zero Content ID) para a Série Especial de Natal.
 */
export function ensureChristmasMusicMp3(assetsDir) {
  fs.mkdirSync(assetsDir, { recursive: true });
  const mp3Path = path.join(assetsDir, "christmas_bg_music.mp3");
  if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 20000) {
    return mp3Path;
  }

  const durationSec = 32; // Loop de 32s perfeito que se repete nos vídeos
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const L = new Float32Array(numSamples);
  const R = new Float32Array(numSamples);

  // Melodia natalina festiva em Dó Maior (inspirada em motivos clássicos natalinos de domínio público de 1857 + arpejos mágicos)
  // Cada passo = 0.25s (120 BPM)
  const stepDur = 0.25;
  const melody = [
    // Frase 1 (Sinos de Belém / Jingle motif alegre)
    76, 76, 76, 0, 76, 76, 76, 0,
    76, 79, 72, 74, 76, 0, 0, 0,
    77, 77, 77, 77, 77, 76, 76, 76,
    76, 74, 74, 76, 74, 0, 79, 0,
    // Frase 2
    76, 76, 76, 0, 76, 76, 76, 0,
    76, 79, 72, 74, 76, 0, 0, 0,
    77, 77, 77, 77, 77, 76, 76, 76,
    79, 79, 77, 74, 72, 0, 84, 0,
    // Frase 3 (Arpejos mágicos de Caixa de Música / Celesta de Natal)
    84, 83, 81, 79, 77, 76, 74, 72,
    74, 76, 77, 79, 81, 0, 79, 0,
    84, 83, 81, 79, 81, 79, 77, 76,
    74, 77, 79, 83, 84, 0, 72, 0,
    // Frase 4 (Celebração em Família)
    72, 77, 77, 79, 77, 76, 74, 74,
    74, 79, 79, 81, 79, 77, 76, 72,
    72, 81, 81, 83, 81, 79, 77, 74,
    72, 74, 79, 76, 77, 0, 72, 0
  ];

  const bassProgression = [
    48, 55, 48, 55, 48, 55, 48, 55,
    53, 60, 48, 55, 50, 57, 55, 43,
    48, 55, 48, 55, 48, 55, 48, 55,
    53, 60, 55, 62, 48, 55, 48, 48
  ];

  // Semente determinística para o ruído metálico dos guizos de trenó (Sleigh Bells)
  let rng = 1234567;
  function nextRand() {
    rng = (rng * 16807) % 2147483647;
    return (rng / 1073741823.5) - 1.0;
  }

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const stepIdx = Math.floor(t / stepDur);
    const st = t % stepDur;

    // 1. Celesta / Glockenspiel Natalino (Fundamental + 2º e 3º harmônicos cristalinos)
    let celesta = 0;
    const noteMidi = melody[stepIdx % melody.length];
    if (noteMidi > 0) {
      const f = midiToFreq(noteMidi);
      const env = Math.exp(-st * 7.5);
      const chimeInharm = Math.exp(-st * 18) * 0.35 * Math.sin(2 * Math.PI * f * 2.756 * st);
      celesta =
        0.34 *
        env *
        (Math.sin(2 * Math.PI * f * st) +
          0.45 * Math.sin(2 * Math.PI * f * 2 * st) +
          chimeInharm);
    }

    // 2. Guizos de Trenó do Papai Noel (Sleigh Bells a cada 0.5s = 2 steps)
    const beatT = t % 0.5;
    const sleighEnv = Math.exp(-beatT * 26);
    const shimmer =
      Math.sin(2 * Math.PI * 4200 * t) * 0.4 +
      Math.sin(2 * Math.PI * 5650 * t) * 0.35 +
      Math.sin(2 * Math.PI * 7100 * t) * 0.25;
    const sleighBell = 0.14 * sleighEnv * shimmer * (0.6 + 0.4 * nextRand());

    // 3. Baixo Pizzicato Acolhedor + Pad de Cordas Quentes
    const bassStep = Math.floor(t / 0.5);
    const bassT = t % 0.5;
    const bassMidi = bassProgression[bassStep % bassProgression.length];
    const bf = midiToFreq(bassMidi);
    const bassEnv = Math.exp(-bassT * 6.0);
    const bass =
      0.26 *
      bassEnv *
      (Math.sin(2 * Math.PI * bf * bassT) + 0.3 * Math.sin(4 * Math.PI * bf * bassT));

    const pad =
      0.08 * Math.sin(2 * Math.PI * midiToFreq(60) * t) +
      0.07 * Math.sin(2 * Math.PI * midiToFreq(64) * t) +
      0.07 * Math.sin(2 * Math.PI * midiToFreq(67) * t);

    L[i] = celesta + sleighBell * 1.1 + bass + pad;
    R[i] = celesta * 0.94 + sleighBell * 0.9 + bass + pad * 1.05;
  }

  const wavPath = path.join(assetsDir, "christmas_bg_music.wav");
  const dataSize = numSamples * 4;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, L[i]));
    const r = Math.max(-1, Math.min(1, R[i]));
    buffer.writeInt16LE(Math.round(l * 32767), offset);
    buffer.writeInt16LE(Math.round(r * 32767), offset + 2);
    offset += 4;
  }
  fs.writeFileSync(wavPath, buffer);

  spawnSync(
    ffmpegPath,
    ["-y", "-i", wavPath, "-c:a", "libmp3lame", "-b:a", "192k", mp3Path],
    { encoding: "utf-8" }
  );
  if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
  console.log(`🎄🔔 Trilha natalina sem direitos autorais gerada em: ${mp3Path}`);
  return mp3Path;
}
