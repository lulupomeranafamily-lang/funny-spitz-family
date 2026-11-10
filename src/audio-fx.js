import fs from "node:fs";

/**
 * Sintetizador Procedural de Áudio (WAV PCM 44.1kHz Stereo 16-bit)
 * 100% Livre de Direitos Autorais (Royalty-Free / Original Synthesis):
 * Gera trilhas musicais dinâmicas por clima da cena (Suspense, Dançante, Acolhedora, Comédia, Festa)
 * e efeitos especiais sonoros (Dun-Dun-Dun, Lupa Mágica, Ronco Cômico, Boing, Fanfarra).
 */
const SAMPLE_RATE = 44100;

function writeWavFile(filePath, leftChannel, rightChannel) {
  const numSamples = leftChannel.length;
  const dataSize = numSamples * 4; // 2 channels * 2 bytes
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM
  buffer.writeUInt16LE(1, 20); // Linear PCM
  buffer.writeUInt16LE(2, 22); // Stereo
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, leftChannel[i]));
    const r = Math.max(-1, Math.min(1, rightChannel[i]));
    buffer.writeInt16LE(Math.round(l * 32767), offset);
    buffer.writeInt16LE(Math.round(r * 32767), offset + 2);
    offset += 4;
  }

  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Gera Efeitos Sonoros Especiais (SFX) pontuais para o início/meio de cada cena
 */
export function generateSfxWav(sfxType, outPath) {
  const durationSec = sfxType === "snore" ? 3.2 : 1.8;
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const L = new Float32Array(numSamples);
  const R = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let val = 0;

    if (sfxType === "chime") {
      // Brilho mágico de harpa/carrilhão (C6 -> E6 -> G6 -> C7)
      const notes = [84, 88, 91, 96];
      notes.forEach((n, idx) => {
        const start = idx * 0.12;
        if (t >= start) {
          const dt = t - start;
          const env = Math.exp(-dt * 4.5);
          const f = midiToFreq(n);
          val += 0.22 * env * (Math.sin(2 * Math.PI * f * dt) + 0.4 * Math.sin(4 * Math.PI * f * dt));
        }
      });
    } else if (sfxType === "dun_dun_dun") {
      // Efeito dramático "DUN - DUN - DUUUN!" de choque/mistério
      const hits = [
        { start: 0.0, dur: 0.32, notes: [48, 55, 63] },
        { start: 0.36, dur: 0.32, notes: [47, 54, 62] },
        { start: 0.72, dur: 1.05, notes: [45, 51, 60] }
      ];
      for (const h of hits) {
        if (t >= h.start && t <= h.start + h.dur) {
          const dt = t - h.start;
          const env = Math.exp(-dt * 3.2);
          for (const n of h.notes) {
            const f = midiToFreq(n);
            val +=
              0.24 *
              env *
              (Math.sin(2 * Math.PI * f * dt) +
                0.5 * Math.sin(4 * Math.PI * f * dt) +
                0.25 * Math.tanh(3 * Math.sin(2 * Math.PI * f * dt)));
          }
        }
      }
    } else if (sfxType === "whoosh_magnifying") {
      // Som de lupa de detetive + nota de pista misteriosa
      const sweepFreq = 220 + 680 * Math.sin(Math.min(1, t / 0.6) * Math.PI);
      const env = t < 0.6 ? Math.sin((t / 0.6) * Math.PI) : 0;
      val += 0.25 * env * Math.sin(2 * Math.PI * sweepFreq * t);
      if (t >= 0.45) {
        const dt = t - 0.45;
        val += 0.28 * Math.exp(-dt * 5) * Math.sin(2 * Math.PI * midiToFreq(79) * dt);
      }
    } else if (sfxType === "disco_drop") {
      // Subida de sintetizador dançante + batida pop
      const f = 300 + t * 500;
      const env = t < 0.7 ? t / 0.7 : Math.exp(-(t - 0.7) * 6);
      val += 0.25 * env * Math.sin(2 * Math.PI * f * t);
    } else if (sfxType === "pop_click") {
      // Peças de quebra-cabeça encaixando (pop + click alegre)
      const pops = [0.05, 0.35, 0.65];
      for (const p of pops) {
        if (t >= p && t < p + 0.15) {
          const dt = t - p;
          const f = 450 + dt * 1800;
          val += 0.35 * Math.exp(-dt * 25) * Math.sin(2 * Math.PI * f * dt);
        }
      }
    } else if (sfxType === "snore") {
      // Ronco cômico suave + assobio de desenho animado no soninho do Vlad
      if (t < 1.2) {
        const env = Math.sin((t / 1.2) * Math.PI);
        const f = 92 + 12 * Math.sin(2 * Math.PI * 18 * t);
        val += 0.28 * env * Math.tanh(2.5 * Math.sin(2 * Math.PI * f * t));
      } else if (t >= 1.35 && t < 2.6) {
        const dt = t - 1.35;
        const env = Math.sin((dt / 1.25) * Math.PI);
        const whistleFreq = 680 - dt * 220;
        val += 0.20 * env * Math.sin(2 * Math.PI * whistleFreq * dt);
      }
    } else if (sfxType === "boing") {
      // Efeito clássico de mola "BOING!" quando o Vlad acorda assustado
      const env = Math.exp(-t * 2.8);
      const f = 190 + 140 * Math.sin(2 * Math.PI * 11 * t) + t * 220;
      val += 0.38 * env * Math.sin(2 * Math.PI * f * t);
    } else if (sfxType === "yay_fanfare") {
      // Fanfarra alegre de encerramento (C5 - E5 - G5 - C6)
      const chord = [72, 76, 79, 84];
      chord.forEach((n, idx) => {
        const start = idx * 0.1;
        if (t >= start) {
          const dt = t - start;
          const env = Math.exp(-dt * 2.2);
          const f = midiToFreq(n);
          val += 0.20 * env * (Math.sin(2 * Math.PI * f * dt) + 0.5 * Math.sin(4 * Math.PI * f * dt));
        }
      });
    }

    L[i] = val;
    R[i] = val * 0.95;
  }

  return writeWavFile(outPath, L, R);
}

/**
 * Gera Trilha Musical Instrumental específica para o clima (mood) de cada cena!
 * - `upbeat_dance`: Batida pop/dance animada 128 BPM com baixo synth e melodia dançante
 * - `suspense_detective` / `tiptoe_suspense` / `shock_mystery`: Walking bass furtivo estilo detetive + marimba misteriosa + tic-tac
 * - `funny_snore` / `comedy_boing`: Tuba cômica "oom-pah" + melodia divertida
 * - `cozy` / `curious_pop` / `happy_celebration`: Arpejos alegres e acolhedores
 */
export function generateMoodMusicWav({ mood, durationSec, outPath }) {
  const numSamples = Math.floor(SAMPLE_RATE * durationSec);
  const L = new Float32Array(numSamples);
  const R = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let left = 0;
    let right = 0;

    if (mood === "upbeat_dance") {
      // 128 BPM Dance Beat para a cena da Luna!
      const beatDur = 60 / 128;
      const beatIdx = Math.floor(t / beatDur);
      const bt = t % beatDur;

      // Kick drum a cada batida
      const kickFreq = 130 * Math.exp(-bt * 28) + 48;
      const kickEnv = Math.exp(-bt * 12);
      const kick = 0.45 * kickEnv * Math.sin(2 * Math.PI * kickFreq * bt);

      // Hi-hat no contratempo
      const subBt = (t + beatDur / 2) % beatDur;
      const hatEnv = Math.exp(-subBt * 45);
      const hat = 0.12 * hatEnv * (Math.random() * 2 - 1);

      // Baixo Synth Funky + Arpejo Dance
      const bassNotes = [48, 48, 55, 53, 51, 51, 55, 58];
      const melodyNotes = [72, 75, 79, 84, 79, 75, 82, 79];
      const stepIdx = Math.floor(t / (beatDur / 2));
      const stepT = t % (beatDur / 2);

      const bassF = midiToFreq(bassNotes[stepIdx % bassNotes.length]);
      const melF = midiToFreq(melodyNotes[stepIdx % melodyNotes.length]);
      const bass = 0.25 * Math.exp(-stepT * 6) * Math.tanh(2.2 * Math.sin(2 * Math.PI * bassF * stepT));
      const mel = 0.22 * Math.exp(-stepT * 8) * Math.sin(2 * Math.PI * melF * stepT);

      left = kick + bass + mel + hat * 0.8;
      right = kick + bass + mel * 0.9 + hat * 1.2;
    } else if (
      mood === "suspense_detective" ||
      mood === "tiptoe_suspense" ||
      mood === "shock_mystery"
    ) {
      // Trilha de Suspense / Detetive Furtivo (Pizzicato Walking Bass + Tic-Tac + Acorde menor misterioso)
      const stepDur = 0.38;
      const stepIdx = Math.floor(t / stepDur);
      const st = t % stepDur;

      // Walking bass em Dó menor / Fá# diminuto (estilo Pantera Cor-de-Rosa / Sherlock)
      const sneakyScale = [48, 51, 53, 54, 55, 54, 51, 47];
      const noteMidi = sneakyScale[stepIdx % sneakyScale.length];
      const f = midiToFreq(noteMidi);
      const pizzEnv = Math.exp(-st * 11);
      const pizz = 0.38 * pizzEnv * (Math.sin(2 * Math.PI * f * st) + 0.4 * Math.sin(4 * Math.PI * f * st));

      // Nota aguda furtiva de xilofone a cada 2 passos
      let highSneak = 0;
      if (stepIdx % 2 === 1) {
        const hf = midiToFreq(noteMidi + 24);
        highSneak = 0.18 * Math.exp(-st * 18) * Math.sin(2 * Math.PI * hf * st);
      }

      // Pad de tensão suave ao fundo
      const pad = 0.10 * Math.sin(2 * Math.PI * midiToFreq(60) * t) + 0.08 * Math.sin(2 * Math.PI * midiToFreq(63) * t);

      left = pizz + highSneak + pad;
      right = pizz * 0.9 + highSneak * 1.1 + pad;
    } else if (mood === "funny_snore" || mood === "comedy_boing") {
      // Trilha Cômica de Tuba "Oom-Pah" para o Papai Vlad
      const stepDur = 0.42;
      const stepIdx = Math.floor(t / stepDur);
      const st = t % stepDur;

      const tubaNotes = [43, 50, 45, 50, 48, 55, 43, 50];
      const f = midiToFreq(tubaNotes[stepIdx % tubaNotes.length]);
      const env = Math.exp(-st * 7.5);
      const tuba = 0.36 * env * Math.tanh(2.0 * Math.sin(2 * Math.PI * f * st));

      const quirkNotes = [67, 71, 74, 72, 69, 67, 71, 79];
      const qf = midiToFreq(quirkNotes[stepIdx % quirkNotes.length]);
      const quirk = stepIdx % 2 === 0 ? 0.18 * Math.exp(-st * 14) * Math.sin(2 * Math.PI * qf * st) : 0;

      left = tuba + quirk;
      right = tuba + quirk * 0.85;
    } else {
      // Trilha alegre / acolhedora / festiva (cozy, curious_pop, happy_celebration)
      const stepDur = mood === "happy_celebration" ? 0.24 : 0.34;
      const stepIdx = Math.floor(t / stepDur);
      const st = t % stepDur;

      const happyNotes = [60, 64, 67, 72, 69, 72, 76, 79];
      const f = midiToFreq(happyNotes[stepIdx % happyNotes.length]);
      const env = Math.exp(-st * 6.5);
      const bell = 0.26 * env * (Math.sin(2 * Math.PI * f * st) + 0.3 * Math.sin(4 * Math.PI * f * st));
      const warmPad =
        0.12 * Math.sin(2 * Math.PI * midiToFreq(48) * t) +
        0.10 * Math.sin(2 * Math.PI * midiToFreq(55) * t);

      left = bell + warmPad;
      right = bell * 0.92 + warmPad * 1.05;
    }

    // Fade in e fade out suave da cena
    const fade =
      t < 0.25
        ? t / 0.25
        : t > durationSec - 0.35
        ? Math.max(0, (durationSec - t) / 0.35)
        : 1.0;

    L[i] = left * fade;
    R[i] = right * fade;
  }

  return writeWavFile(outPath, L, R);
}
