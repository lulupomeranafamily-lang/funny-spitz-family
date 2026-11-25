import fs from 'fs';
import path from 'path';
import https from 'https';
import { execFileSync, spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CUTOUTS_DIR = path.join(__dirname, '..', 'assets', 'character_cutouts');

/**
 * Calibrated Anatomical Rigs for All 5 Funny Spitz Family Characters + Multi-Dog Family Rig
 * Every rig is 100% faithful to personagens.png and calibrated for:
 * - Syllable-accurate jaw & mouth opening/closing (mouthOpen 0.0 -> 1.1)
 * - Vowel horizontal mouth spread (mouthSpread -0.8 -> +0.8)
 * - Natural eye blinking behind eyeglasses (zero eyeglass frame distortion)
 * - Expressive ear perking on vocal peaks
 * - 3D pseudo-perspective head yaw & pitch (snout parallax over ears/mane)
 * - Chest breathing & paw gesturing
 */
export const CHARACTER_RIGS = {
  RAVEN: [
    {
      file: 'raven_rig.png',
      scale: 0.74,
      anchorY: 1.0,
      faces: [
        {
          furColor: [28, 24, 24],
          nose: { cx: 0.52, cy: 0.47 },
          mouth: { cx: 0.52, cy: 0.555, rx: 0.052, ry: 0.048, baseOpen: 0.80 },
          leftEye: { cx: 0.45, cy: 0.38, rx: 0.033, ry: 0.030 },
          rightEye: { cx: 0.59, cy: 0.38, rx: 0.033, ry: 0.030 },
          leftEar: { cx: 0.38, cy: 0.23, r: 0.10 },
          rightEar: { cx: 0.65, cy: 0.23, r: 0.10 },
          head: { cx: 0.52, cy: 0.42, neckY: 0.64 }
        }
      ]
    }
  ],
  VLAD: [
    {
      file: 'vlad_rig.png',
      scale: 0.75,
      anchorY: 1.0,
      faces: [
        {
          furColor: [235, 200, 165],
          nose: { cx: 0.50, cy: 0.48 },
          mouth: { cx: 0.50, cy: 0.542, rx: 0.054, ry: 0.044, baseOpen: 0.80 },
          leftEye: { cx: 0.425, cy: 0.395, rx: 0.032, ry: 0.030 },
          rightEye: { cx: 0.575, cy: 0.395, rx: 0.032, ry: 0.030 },
          leftEar: { cx: 0.35, cy: 0.23, r: 0.11 },
          rightEar: { cx: 0.65, cy: 0.23, r: 0.11 },
          head: { cx: 0.50, cy: 0.42, neckY: 0.64 },
          paw: { cx: 0.28, cy: 0.80, r: 0.12 }
        }
      ]
    }
  ],
  LUNA: [
    {
      file: 'luna_rig.png',
      scale: 0.73,
      anchorY: 1.0,
      faces: [
        {
          furColor: [28, 24, 24],
          nose: { cx: 0.55, cy: 0.475 },
          mouth: { cx: 0.54, cy: 0.562, rx: 0.054, ry: 0.048, baseOpen: 0.80 },
          leftEye: { cx: 0.47, cy: 0.385, rx: 0.033, ry: 0.030 },
          rightEye: { cx: 0.61, cy: 0.385, rx: 0.033, ry: 0.030 },
          leftEar: { cx: 0.38, cy: 0.23, r: 0.10 },
          rightEar: { cx: 0.63, cy: 0.23, r: 0.10 },
          head: { cx: 0.52, cy: 0.42, neckY: 0.64 }
        }
      ]
    }
  ],
  THEO: [
    {
      file: 'theo_rig.png',
      scale: 0.73,
      anchorY: 1.0,
      faces: [
        {
          furColor: [225, 175, 130],
          nose: { cx: 0.56, cy: 0.48 },
          mouth: { cx: 0.545, cy: 0.562, rx: 0.055, ry: 0.048, baseOpen: 0.80 },
          leftEye: { cx: 0.46, cy: 0.40, rx: 0.032, ry: 0.030 },
          rightEye: { cx: 0.60, cy: 0.38, rx: 0.032, ry: 0.030 },
          leftEar: { cx: 0.35, cy: 0.26, r: 0.10 },
          rightEar: { cx: 0.64, cy: 0.23, r: 0.10 },
          head: { cx: 0.51, cy: 0.42, neckY: 0.64 }
        }
      ]
    }
  ],
  JONNY: [
    {
      file: 'jonny_rig.png',
      scale: 0.76,
      anchorY: 1.0,
      faces: [
        {
          furColor: [235, 195, 150],
          nose: { cx: 0.50, cy: 0.515 },
          mouth: { cx: 0.50, cy: 0.600, rx: 0.048, ry: 0.044, baseOpen: 0.80 },
          leftEye: { cx: 0.445, cy: 0.435, rx: 0.025, ry: 0.025 },
          rightEye: { cx: 0.555, cy: 0.435, rx: 0.025, ry: 0.025 },
          leftEar: { cx: 0.39, cy: 0.24, r: 0.08 },
          rightEar: { cx: 0.61, cy: 0.24, r: 0.08 },
          head: { cx: 0.50, cy: 0.48, neckY: 0.72 },
          paw: { cx: 0.53, cy: 0.86, r: 0.12 }
        }
      ]
    }
  ],
  FAMILIA: [
    {
      file: 'familia_5_dogs.png',
      scale: 0.84,
      anchorY: 1.0,
      faces: [
        // Raven (left)
        {
          furColor: [28, 24, 24],
          nose: { cx: 0.21, cy: 0.52 },
          mouth: { cx: 0.21, cy: 0.56, rx: 0.025, ry: 0.026, baseOpen: 0.80 },
          leftEye: { cx: 0.17, cy: 0.48, rx: 0.016, ry: 0.016 },
          rightEye: { cx: 0.24, cy: 0.48, rx: 0.016, ry: 0.016 },
          leftEar: { cx: 0.12, cy: 0.39, r: 0.05 },
          rightEar: { cx: 0.26, cy: 0.39, r: 0.05 },
          head: { cx: 0.20, cy: 0.49, neckY: 0.62 }
        },
        // Vlad (center-left)
        {
          furColor: [225, 185, 145],
          nose: { cx: 0.45, cy: 0.44 },
          mouth: { cx: 0.45, cy: 0.49, rx: 0.028, ry: 0.028, baseOpen: 0.80 },
          leftEye: { cx: 0.41, cy: 0.40, rx: 0.016, ry: 0.016 },
          rightEye: { cx: 0.49, cy: 0.40, rx: 0.016, ry: 0.016 },
          leftEar: { cx: 0.36, cy: 0.31, r: 0.05 },
          rightEar: { cx: 0.52, cy: 0.31, r: 0.05 },
          head: { cx: 0.45, cy: 0.42, neckY: 0.56 }
        },
        // Theo (front center)
        {
          furColor: [225, 175, 130],
          nose: { cx: 0.59, cy: 0.60 },
          mouth: { cx: 0.59, cy: 0.65, rx: 0.026, ry: 0.026, baseOpen: 0.80 },
          leftEye: { cx: 0.55, cy: 0.56, rx: 0.015, ry: 0.015 },
          rightEye: { cx: 0.62, cy: 0.56, rx: 0.015, ry: 0.015 },
          leftEar: { cx: 0.51, cy: 0.48, r: 0.04 },
          rightEar: { cx: 0.66, cy: 0.48, r: 0.04 },
          head: { cx: 0.59, cy: 0.58, neckY: 0.70 }
        },
        // Luna (upper right)
        {
          furColor: [28, 24, 24],
          nose: { cx: 0.74, cy: 0.49 },
          mouth: { cx: 0.74, cy: 0.54, rx: 0.025, ry: 0.025, baseOpen: 0.80 },
          leftEye: { cx: 0.70, cy: 0.45, rx: 0.016, ry: 0.016 },
          rightEye: { cx: 0.77, cy: 0.45, rx: 0.016, ry: 0.016 },
          leftEar: { cx: 0.66, cy: 0.35, r: 0.05 },
          rightEar: { cx: 0.81, cy: 0.36, r: 0.05 },
          head: { cx: 0.74, cy: 0.47, neckY: 0.59 }
        },
        // Jonny (lower right)
        {
          furColor: [235, 195, 150],
          nose: { cx: 0.86, cy: 0.60 },
          mouth: { cx: 0.86, cy: 0.65, rx: 0.025, ry: 0.025, baseOpen: 0.80 },
          leftEye: { cx: 0.83, cy: 0.57, rx: 0.014, ry: 0.014 },
          rightEye: { cx: 0.90, cy: 0.57, rx: 0.014, ry: 0.014 },
          leftEar: { cx: 0.79, cy: 0.49, r: 0.04 },
          rightEar: { cx: 0.93, cy: 0.49, r: 0.04 },
          head: { cx: 0.86, cy: 0.58, neckY: 0.70 }
        }
      ]
    }
  ]
};
CHARACTER_RIGS.NARRADOR = CHARACTER_RIGS.FAMILIA;

/**
 * Extract frame-accurate 30fps Lip-Sync envelope (mouthOpen + mouthSpread) from an MP3/WAV voice file.
 */
export function extractAudioLipSyncEnvelope(audioPath, totalFrames, fps = 30) {
  const envelope = [];
  if (!audioPath || !fs.existsSync(audioPath)) {
    // Fallback rhythmic speech envelope if no audio path passed
    for (let f = 0; f < totalFrames; f++) {
      const t = f / fps;
      const open = Math.max(0, Math.sin(t * 14) * 0.5 + Math.sin(t * 23) * 0.4 + 0.25);
      envelope.push({ mouthOpen: Math.min(1.05, open), mouthSpread: Math.sin(t * 9) * 0.6 });
    }
    return envelope;
  }

  try {
    // Decode audio to 16kHz mono signed 16-bit PCM via ffmpeg
    const sampleRate = 16000;
    const pcmBuf = execFileSync(ffmpegPath, [
      '-i', audioPath,
      '-ac', '1',
      '-ar', String(sampleRate),
      '-f', 's16le',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 25 * 1024 * 1024 });

    const samples = new Int16Array(pcmBuf.buffer, pcmBuf.byteOffset, Math.floor(pcmBuf.byteLength / 2));
    const samplesPerFrame = Math.floor(sampleRate / fps);

    // First pass: compute raw RMS energy and zero-crossing rate per frame
    const rawRms = new Float32Array(totalFrames);
    const rawZcr = new Float32Array(totalFrames);
    let peakRms = 0.01;

    for (let f = 0; f < totalFrames; f++) {
      const startSample = f * samplesPerFrame;
      const endSample = Math.min(samples.length, startSample + samplesPerFrame);
      if (startSample >= samples.length || endSample <= startSample) {
        rawRms[f] = 0;
        rawZcr[f] = 0;
        continue;
      }

      let sumSq = 0;
      let zeroCrossings = 0;
      let prev = samples[startSample];
      for (let i = startSample; i < endSample; i++) {
        const val = samples[i] / 32768.0;
        sumSq += val * val;
        if ((samples[i] >= 0 && prev < 0) || (samples[i] < 0 && prev >= 0)) {
          zeroCrossings++;
        }
        prev = samples[i];
      }
      const count = endSample - startSample;
      const rms = Math.sqrt(sumSq / count);
      rawRms[f] = rms;
      rawZcr[f] = zeroCrossings / count;
      if (rms > peakRms) peakRms = rms;
    }

    // Second pass: Local Syllable Valley-to-Peak Contrast so every spoken syllable visibly closes (0.0) on consonants and opens wide (0.8..1.1) on vowels!
    let prevOpen = 0;
    for (let f = 0; f < totalFrames; f++) {
      const globalNorm = rawRms[f] / (peakRms * 0.80);
      if (globalNorm < 0.085) {
        // Silence / pause between phrases -> mouth 100% CLOSED!
        prevOpen = prevOpen * 0.35;
        envelope.push({ mouthOpen: prevOpen < 0.05 ? 0.0 : prevOpen, mouthSpread: 0.0 });
        continue;
      }

      // Compute local syllable min & max in a ±4 frame (±133ms) window
      let localMin = rawRms[f];
      let localMax = rawRms[f];
      for (let k = Math.max(0, f - 4); k <= Math.min(totalFrames - 1, f + 4); k++) {
        if (rawRms[k] < localMin) localMin = rawRms[k];
        if (rawRms[k] > localMax) localMax = rawRms[k];
      }

      const localSpan = Math.max(peakRms * 0.07, localMax - localMin);
      const syllablePhase = (rawRms[f] - localMin) / localSpan; // 0.0 at consonant valley, 1.0 at vowel peak

      let targetOpen;
      if (syllablePhase < 0.28) {
        // Consonant closure between syllables -> snap mouth closed!
        targetOpen = 0.0;
      } else if (syllablePhase < 0.55) {
        targetOpen = 0.35 + ((syllablePhase - 0.28) / 0.27) * 0.35;
      } else {
        targetOpen = 0.78 + ((syllablePhase - 0.55) / 0.45) * 0.32 * Math.min(1.2, globalNorm);
      }

      // Fast response so mouth closures and openings are crisp and clearly visible at 30fps
      const smoothedOpen = prevOpen * 0.25 + targetOpen * 0.75;
      prevOpen = smoothedOpen;

      const mouthSpread = Math.max(-0.75, Math.min(0.85, (rawZcr[f] - 0.11) * 8.0));
      envelope.push({
        mouthOpen: smoothedOpen < 0.05 ? 0.0 : smoothedOpen,
        mouthSpread
      });
    }
  } catch (err) {
    for (let f = 0; f < totalFrames; f++) {
      const t = f / fps;
      const open = Math.max(0, Math.sin(t * 14) * 0.5 + Math.sin(t * 23) * 0.4 + 0.25);
      envelope.push({ mouthOpen: Math.min(1.05, open), mouthSpread: Math.sin(t * 9) * 0.6 });
    }
  }
  return envelope;
}

/**
 * Deform a character cutout RGBA buffer supporting 1 or multiple faces (e.g. FAMILIA 5 dogs!).
 */
export function deformCharacterMultiFaceRGBA(srcBuf, W, H, faces, frameState) {
  const dstBuf = Buffer.allocUnsafe(W * H * 4);

  // Precompute pixel parameters for each face in the rig
  const preFaces = faces.map((rig, idx) => {
    const phase = idx * 1.37;
    const faceState = frameState.perFace ? frameState.perFace[idx] : frameState;
    const baseOpen = rig.mouth.baseOpen ?? 0.80;
    const mRy = rig.mouth.ry * H;
    return {
      mCx: rig.mouth.cx * W,
      mCy: rig.mouth.cy * H,
      mRx: rig.mouth.rx * W,
      mRy,
      baseOpen,
      closure: (baseOpen - faceState.mouthOpen) / Math.max(0.01, baseOpen),
      maxJawPullUp: mRy * 1.32,
      mouthOpen: faceState.mouthOpen,
      mouthSpread: faceState.mouthSpread || 0,
      nCx: rig.nose.cx * W,
      nCy: rig.nose.cy * H,
      lEx: rig.leftEye.cx * W,
      lEy: rig.leftEye.cy * H,
      rEx: rig.rightEye.cx * W,
      rEy: rig.rightEye.cy * H,
      eRx: rig.leftEye.rx * W,
      eRy: rig.leftEye.ry * H,
      lEarX: rig.leftEar.cx * W,
      lEarY: rig.leftEar.cy * H,
      rEarX: rig.rightEar.cx * W,
      rEarY: rig.rightEar.cy * H,
      earR: (rig.leftEar.r || 0.09) * W,
      hCx: (rig.head?.cx ?? 0.5) * W,
      hCy: (rig.head?.cy ?? 0.40) * H,
      neckY: (rig.head?.neckY ?? 0.62) * H,
      yawPx: (faceState.headYaw || 0) * W * (faces.length > 1 ? 0.014 : 0.032),
      pitchPx: (faceState.headPitch || 0) * H * (faces.length > 1 ? 0.012 : 0.024),
      headRollRad: (faceState.headRoll || 0) * (faces.length > 1 ? 0.038 : 0.078),
      earLiftPx: (faceState.earPerk || 0) * H * (faces.length > 1 ? 0.016 : 0.030),
      blink: faceState.blink || 0,
      furR: rig.furColor ? rig.furColor[0] : 30,
      furG: rig.furColor ? rig.furColor[1] : 25,
      furB: rig.furColor ? rig.furColor[2] : 22,
      paw: rig.paw ? { cx: rig.paw.cx * W, cy: rig.paw.cy * H, r: rig.paw.r * W } : null,
      pawWave: faceState.pawWave || 0,
      breathScale: (faceState.breath || 0) * 0.016,
      horizSpan: faces.length > 1 ? W * 0.14 : W * 0.35
    };
  });

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let srcX = x;
      let srcY = y;

      // Accumulate spatial warps across faces
      for (let f = 0; f < preFaces.length; f++) {
        const pf = preFaces[f];
        if (Math.abs(x - pf.hCx) > pf.horizSpan * 1.8) continue;

        const faceHorizW = preFaces.length > 1
          ? Math.exp(-0.5 * ((x - pf.hCx) / (pf.horizSpan * 0.75)) ** 2)
          : 1.0;

        const headW = (y < pf.neckY ? Math.min(1, Math.max(0, (pf.neckY - y) / (H * 0.12))) : 0) * faceHorizW;

        let localYaw = 0;
        let localPitch = 0;
        if (headW > 0.001) {
          // 1A. Adorable Pomeranian Neck-Pivot Head Tilt (headRoll around (hCx, neckY) while shoulders stay anchored!)
          const theta = pf.headRollRad * headW;
          if (Math.abs(theta) > 0.0005) {
            const dxNeck = x - pf.hCx;
            const dyNeck = y - pf.neckY;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);
            srcX += (dxNeck * cosT + dyNeck * sinT) - dxNeck;
            srcY += (-dxNeck * sinT + dyNeck * cosT) - dyNeck;
          }

          // 1C. Expressive Eyebrow / Forehead Lift on emphasized syllables (above the eyes, below the ears)
          const browY = (pf.lEy + pf.rEy) * 0.5 - pf.eRy * 1.45;
          const dyBrow = (y - browY) / (pf.eRy * 1.35);
          const dxBrow = (x - pf.nCx) / (pf.horizSpan * 0.55);
          if (Math.abs(dyBrow) < 1.2 && Math.abs(dxBrow) < 1.2) {
            const wBrow = Math.exp(-0.8 * (dxBrow * dxBrow + dyBrow * dyBrow));
            srcY += pf.mouthOpen * pf.eRy * 0.55 * wBrow;
          }
          const dxN = (x - pf.nCx) / (pf.horizSpan * 0.65);
          const dyN = (y - pf.nCy) / (H * 0.20);
          const snoutDepth = Math.exp(-0.5 * (dxN * dxN + dyN * dyN));
          const parallaxFactor = 0.35 + 0.65 * snoutDepth;
          localYaw = pf.yawPx * headW * parallaxFactor;
          localPitch = pf.pitchPx * headW * parallaxFactor;
          srcX -= localYaw;
          srcY -= localPitch;
        } else if (y >= pf.neckY) {
          const torsoW = Math.min(1, (y - pf.neckY) / (H * 0.2)) * faceHorizW;
          srcX -= (x - pf.hCx) * pf.breathScale * torsoW;
          srcY -= (y - pf.neckY) * pf.breathScale * 0.5 * torsoW;
        }

        // Ear Perk
        if (pf.earLiftPx !== 0 && y < pf.hCy + pf.earR) {
          const dLE = Math.hypot(x - pf.lEarX, y - pf.lEarY) / pf.earR;
          if (dLE < 1.8) {
            const wE = Math.exp(-dLE * dLE);
            srcY += pf.earLiftPx * wE;
            srcX += pf.earLiftPx * 0.3 * wE;
          }
          const dRE = Math.hypot(x - pf.rEarX, y - pf.rEarY) / pf.earR;
          if (dRE < 1.8) {
            const wE = Math.exp(-dRE * dRE);
            srcY += pf.earLiftPx * wE;
            srcX -= pf.earLiftPx * 0.3 * wE;
          }
        }

        // Mouth & Jaw Lip-Sync: Full-range physical lower-jaw & tongue vertical motion + vowel spread across the ENTIRE [0.0 .. 1.1] range!
        const shiftedMCx = pf.mCx + localYaw;
        const shiftedMCy = pf.mCy + localPitch;
        const dxM = (x - shiftedMCx) / (pf.mRx * 1.38);
        if (Math.abs(dxM) < 1.38) {
          const upperMuzzleY = shiftedMCy - pf.mRy * 0.50;
          const lowerChinY = shiftedMCy + pf.mRy * 1.18;
          if (y > upperMuzzleY && y < lowerChinY) {
            const horizM = Math.cos((dxM / 1.38) * (Math.PI / 2)) ** 2;
            const normY = (y - upperMuzzleY) / (lowerChinY - upperMuzzleY);
            const vertM = Math.sin(normY * Math.PI) ** 1.25;

            if (pf.closure >= 0) {
              // Closing/semi-open: physically lift the lower lip & tongue upward (clamped above the bow tie / necklace!)
              const jawLift = pf.closure * pf.mRy * 0.48 * horizM * vertM;
              const maxSafeChinSampleY = shiftedMCy + pf.mRy * 0.90;
              srcY = Math.min(maxSafeChinSampleY, srcY + jawLift);
            } else {
              // Wide-open vowel peak: physically drop the lower jaw & tongue downward!
              const jawDrop = (-pf.closure) * pf.mRy * 1.75 * horizM * vertM;
              srcY -= jawDrop;
            }

            const spreadFactor = pf.mouthSpread * 0.22 * horizM * vertM;
            srcX -= (x - shiftedMCx) * spreadFactor;
          }
        }

        // Paw Gesture
        if (pf.paw && pf.pawWave) {
          const dP = Math.hypot(x - pf.paw.cx, y - pf.paw.cy) / pf.paw.r;
          if (dP < 1.8) {
            const wP = Math.exp(-dP * dP);
            srcX -= pf.pawWave * W * 0.030 * wP;
            srcY -= Math.abs(pf.pawWave) * H * 0.018 * wP;
          }
        }
      }

      // Bilinear interpolation sample
      const sx = Math.max(0, Math.min(W - 1.001, srcX));
      const sy = Math.max(0, Math.min(H - 1.001, srcY));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = (y0 * W + x0) * 4;
      const i10 = (y0 * W + x1) * 4;
      const i01 = (y1 * W + x0) * 4;
      const i11 = (y1 * W + x1) * 4;

      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;

      let r = srcBuf[i00] * w00 + srcBuf[i10] * w10 + srcBuf[i01] * w01 + srcBuf[i11] * w11;
      let g = srcBuf[i00 + 1] * w00 + srcBuf[i10 + 1] * w10 + srcBuf[i01 + 1] * w01 + srcBuf[i11 + 1] * w11;
      let b = srcBuf[i00 + 2] * w00 + srcBuf[i10 + 2] * w10 + srcBuf[i01 + 2] * w01 + srcBuf[i11 + 2] * w11;
      let a = srcBuf[i00 + 3] * w00 + srcBuf[i10 + 3] * w10 + srcBuf[i01 + 3] * w01 + srcBuf[i11 + 3] * w11;

      if (a > 10) {
        for (let f = 0; f < preFaces.length; f++) {
          const pf = preFaces[f];
          if (Math.abs(x - pf.hCx) > pf.horizSpan * 1.5) continue;

          // Moving Lower-Lip & Real Photographic Cheek-Fur Closure Shader:
          // Smoothly raises the lower lip & real photographic cheek fur from the bottom of the mouth (openRatio = 1)
          // to the upper smile line (openRatio = 0) in sync with pf.mouthOpen!
          const openRatio = Math.min(1.0, Math.max(0.0, pf.mouthOpen / 0.78));
          if (openRatio < 0.96) {
            const sMCx = pf.mCx + pf.yawPx * 0.85;
            const sMCy = pf.mCy + pf.pitchPx * 0.85;
            const dxLip = (x - sMCx) / (pf.mRx * 1.22);
            const dyLip = (y - (sMCy + pf.mRy * 0.08)) / (pf.mRy * 1.25);
            const inMouthEllipse = dxLip * dxLip + dyLip * dyLip;

            if (inMouthEllipse < 1.25 && Math.abs(dxLip) < 1.08) {
              // In screen coordinates (+Y = down), a happy upturned smile has LARGER y at center (dx=0) and SMALLER y at corners (|dx|=1)!
              const topSmileY = sMCy - pf.mRy * 0.12 - 0.32 * pf.mRy * (dxLip * dxLip);
              const bottomOpenY = sMCy + pf.mRy * 0.96;
              const currentLowerLipY = topSmileY + (bottomOpenY - topSmileY) * (0.04 + 0.96 * openRatio);

              // Only affect pixels that belong to the open mouth cavity or pink tongue
              const isPinkTongue = (r > g * 1.12 && r > b * 1.15 && r > 65);
              const isDarkMouthOrLip = (r < 115 && g < 95 && b < 95 && y > topSmileY - pf.mRy * 0.10);

              if ((isPinkTongue || isDarkMouthOrLip) && y >= currentLowerLipY - pf.mRy * 0.14) {
                const distBelowLip = (y - currentLowerLipY) / pf.mRy;
                const horizSoft = Math.cos((dxLip / 1.08) * (Math.PI / 2)) ** 1.5;
                const radialFade = Math.min(1.0, (1.25 - inMouthEllipse) * 2.5) * horizSoft;

                if (distBelowLip < 0.14) {
                  // On the moving lower black lip edge: natural upturned dark smile seam
                  const lipEdgeW = Math.min(1.0, (1.0 - openRatio * 0.5) * radialFade);
                  r = r * (1 - lipEdgeW) + 26 * lipEdgeW;
                  g = g * (1 - lipEdgeW) + 20 * lipEdgeW;
                  b = b * (1 - lipEdgeW) + 20 * lipEdgeW;
                } else {
                  // Below the moving lower lip: cross-blend REAL photographic fur from both left and right cheeks (zero center seam!)
                  const leftSampleX = Math.max(0, Math.min(W - 1, Math.round(sMCx - pf.mRx * 1.48 - Math.abs(x - sMCx) * 0.25)));
                  const rightSampleX = Math.max(0, Math.min(W - 1, Math.round(sMCx + pf.mRx * 1.48 + Math.abs(x - sMCx) * 0.25)));
                  const cheekSampleY = Math.max(0, Math.min(H - 1, Math.round(y - pf.mRy * 0.12)));
                  const lIdx = (cheekSampleY * W + leftSampleX) * 4;
                  const rIdx = (cheekSampleY * W + rightSampleX) * 4;
                  const rightWeight = Math.min(1, Math.max(0, (dxLip + 1.0) * 0.5));
                  const furSampleR = srcBuf[lIdx] * (1 - rightWeight) + srcBuf[rIdx] * rightWeight;
                  const furSampleG = srcBuf[lIdx + 1] * (1 - rightWeight) + srcBuf[rIdx + 1] * rightWeight;
                  const furSampleB = srcBuf[lIdx + 2] * (1 - rightWeight) + srcBuf[rIdx + 2] * rightWeight;

                  const coverW = Math.min(0.98, Math.min(1.0, (distBelowLip - 0.14) * 4.5 + 0.65) * Math.min(1.0, (1.25 - inMouthEllipse) * 2.8));
                  r = r * (1 - coverW) + furSampleR * coverW;
                  g = g * (1 - coverW) + furSampleG * coverW;
                  b = b * (1 - coverW) + furSampleB * coverW;
                }
              }
            }
          }

          // Natural Eye Blink behind glasses
          if (pf.blink > 0.02) {
            const sLEx = pf.lEx + pf.yawPx * 0.75;
            const sLEy = pf.lEy + pf.pitchPx * 0.75;
            const sREx = pf.rEx + pf.yawPx * 0.75;
            const sREy = pf.rEy + pf.pitchPx * 0.75;

            const dLE2 = ((x - sLEx) / (pf.eRx * 0.82)) ** 2 + ((y - sLEy) / (pf.eRy * 0.82)) ** 2;
            const dRE2 = ((x - sREx) / (pf.eRx * 0.82)) ** 2 + ((y - sREy) / (pf.eRy * 0.82)) ** 2;

            if (dLE2 < 1.0 || dRE2 < 1.0) {
              const isLeft = dLE2 < 1.0;
              const d2 = isLeft ? dLE2 : dRE2;
              const ey = isLeft ? sLEy : sREy;
              const relEy = (y - (ey - pf.eRy * 0.75)) / (pf.eRy * 1.5);
              if (relEy <= pf.blink * 1.15) {
                const edgeSoft = Math.min(1, (1 - d2) * 2.2);
                const isLashLine = Math.abs(relEy - pf.blink * 0.92) < 0.16;
                const lidR = isLashLine ? 18 : pf.furR * 0.85;
                const lidG = isLashLine ? 14 : pf.furG * 0.85;
                const lidB = isLashLine ? 14 : pf.furB * 0.85;
                const lidBlend = Math.min(0.95, pf.blink * edgeSoft);
                r = r * (1 - lidBlend) + lidR * lidBlend;
                g = g * (1 - lidBlend) + lidG * lidBlend;
                b = b * (1 - lidBlend) + lidB * lidBlend;
              }
            }
          }
        }
      }

      const dstIdx = (y * W + x) * 4;
      dstBuf[dstIdx] = Math.round(r);
      dstBuf[dstIdx + 1] = Math.round(g);
      dstBuf[dstIdx + 2] = Math.round(b);
      dstBuf[dstIdx + 3] = Math.round(a);
    }
  }

  return dstBuf;
}

/**
 * Compute natural eye blink curve at time t (seconds) with optional phase offset.
 * Blinks last ~160ms every ~2.9 seconds.
 */
function computeBlinkAtTime(t, phaseOffset = 0) {
  const period = 2.85;
  const localT = (t + phaseOffset) % period;
  const blinkCenter = 1.4;
  const halfDur = 0.085;
  const dist = Math.abs(localT - blinkCenter);
  if (dist >= halfDur) return 0.0;
  return Math.cos((dist / halfDur) * (Math.PI / 2)) ** 1.5;
}

/**
 * Render a 30fps Lip-Sync Animated Scene Clip (16:9 or 9:16) where the character's mouth, jaw, tongue,
 * eyes, ears, 3D head turn, breathing, and paw gestures are driven directly by the scene's TTS audio file!
 */
export async function renderLipSyncSceneClip({
  character,
  sceneIndex,
  backgroundPath,
  voiceAudioPath,
  outputClipPath,
  durationSec = 9.0,
  fps = 30,
  width = 1920,
  height = 1080
}) {
  const charKey = (character || 'FAMILIA').toUpperCase();
  const rigOptions = CHARACTER_RIGS[charKey] || CHARACTER_RIGS.FAMILIA;
  const chosenRig = rigOptions[sceneIndex % rigOptions.length];
  const cutoutPath = path.join(CUTOUTS_DIR, chosenRig.file);

  const totalFrames = Math.ceil(durationSec * fps);
  const lipSyncEnv = extractAudioLipSyncEnvelope(voiceAudioPath, totalFrames, fps);

  // Prepare extra-wide background for smooth cinematic camera pan
  const bgMoveSpanX = Math.round(width * 0.08);
  const bgMoveSpanY = Math.round(height * 0.04);
  const bgCanvasW = width + bgMoveSpanX;
  const bgCanvasH = height + bgMoveSpanY;

  let bgRaw;
  if (backgroundPath && fs.existsSync(backgroundPath)) {
    const { data } = await sharp(backgroundPath)
      .resize(bgCanvasW, bgCanvasH, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    bgRaw = data;
  } else {
    bgRaw = Buffer.alloc(bgCanvasW * bgCanvasH * 4, 40);
  }

  // Keep the exact 1:1 square (500:500) aspect ratio used in the calibration grid (personagens_5_clean_cutouts.jpg)
  // so every (cx, cy) coordinate hits the exact pixel of the nose, mouth, eyes, and chin!
  const isVertical = height > width;
  const calibAspect = 1.0;

  let meshW, meshH;
  if (isVertical) {
    meshW = Math.round(width * 0.96);
    meshH = Math.round(meshW / calibAspect);
  } else {
    meshH = Math.round(height * (charKey === 'FAMILIA' || charKey === 'NARRADOR' ? 0.80 : 0.83));
    meshW = Math.round(meshH * calibAspect);
  }
  const targetCharW = meshW;
  const targetCharH = meshH;

  const { data: charMeshRaw } = await sharp(cutoutPath)
    .resize(meshW, meshH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Find lowest opaque row (maxOpaqueY) so the character's bottom edge sits 100% flush at charBottom with zero gap!
  let maxOpaqueY = meshH - 1;
  outer: for (let y = meshH - 1; y >= 0; y--) {
    const rowOff = y * meshW * 4;
    for (let x = 0; x < meshW; x++) {
      if (charMeshRaw[rowOff + x * 4 + 3] > 60) {
        maxOpaqueY = y;
        break outer;
      }
    }
  }

  // Spawn ffmpeg receiving raw RGBA frames at 30fps
  await new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      '-y',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', `${width}x${height}`,
      '-r', String(fps),
      '-i', 'pipe:0',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      outputClipPath
    ], { stdio: ['pipe', 'ignore', 'ignore'] });

    ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
    ff.on('error', reject);

    (async () => {
      const panDir = sceneIndex % 2 === 0 ? 1 : -1;
      const frameBuf = Buffer.allocUnsafe(width * height * 4);

      for (let f = 0; f < totalFrames; f++) {
        const t = f / fps;
        const progress = f / totalFrames;
        const env = lipSyncEnv[f] || { mouthOpen: 0, mouthSpread: 0 };

        // Build per-face animation state for frame f driven by speech prosody (calm during pauses, expressive during syllables!)
        const perFace = chosenRig.faces.map((_, faceIdx) => {
          const phase = sceneIndex * 1.3 + faceIdx * 1.7;
          const mouthOpen = env.mouthOpen;
          const mouthSpread = env.mouthSpread;
          const blink = computeBlinkAtTime(t, phase);

          // Speech-driven prosody: head tilt (headRoll), 3D head turn (headYaw), and syllable nod (headPitch)
          const speechDrive = 0.25 + 0.75 * Math.min(1.0, mouthOpen * 1.25);
          const headYaw = (Math.sin(t * 1.65 + phase) * 0.65 + Math.cos(t * 2.9 + phase) * 0.35) * speechDrive;
          const headRoll = (Math.sin(t * 1.35 + phase * 0.8) * 0.70 + Math.sin(t * 3.1 + phase) * 0.30 * mouthOpen);
          const headPitch = -mouthOpen * 0.48 + Math.sin(t * 2.4 + phase) * 0.20;
          const earPerk = Math.min(1.0, mouthOpen * 0.95 + Math.max(0, Math.sin(t * 4.5 + phase) * 0.25));
          const breath = Math.sin(t * 2.3 + phase) * (1.0 + 0.35 * mouthOpen);
          const pawWave = Math.sin(t * 5.6 + phase) * (0.20 + 0.80 * Math.min(1, mouthOpen));

          return { mouthOpen, mouthSpread, blink, headYaw, headRoll, headPitch, earPerk, breath, pawWave };
        });

        // 1. Deform character mesh at meshW x meshH
        const warpedMesh = deformCharacterMultiFaceRGBA(charMeshRaw, meshW, meshH, chosenRig.faces, { perFace });

        // 2. Copy panning background slice into frameBuf
        const bgOffX = Math.round((bgMoveSpanX / 2) + panDir * (progress - 0.5) * bgMoveSpanX * 0.9);
        const bgOffY = Math.round((bgMoveSpanY / 2) + Math.sin(t * 0.9) * (bgMoveSpanY * 0.35));

        for (let y = 0; y < height; y++) {
          const srcRowStart = ((y + bgOffY) * bgCanvasW + bgOffX) * 4;
          const dstRowStart = y * width * 4;
          bgRaw.copy(frameBuf, dstRowStart, srcRowStart, srcRowStart + width * 4);
        }

        // 3. Composite deformed character onto frameBuf at native 1:1 resolution
        // Anchor charBottom right behind the 3D studio counter ledge & speech bubble (0.84 * height in 16:9, 0.83 * height in 9:16)
        // so 100% of the character's shirt, bow tie, pearl necklace, paws, and moving mouth sit ABOVE the speech bubble!
        const charLeft = Math.round((width - targetCharW) / 2 + Math.sin(t * 1.4 + sceneIndex) * (width * 0.010));
        // Speech-rhythm vertical bounce + gentle breathing bob so the whole body feels alive while speaking!
        const speechBouncePx = Math.round((-env.mouthOpen * 9) + Math.sin(t * 2.4 + sceneIndex) * 4);
        const charBottom = (isVertical ? Math.round(height * 0.83) : Math.round(height * 0.84)) + 12;
        const charTop = charBottom - maxOpaqueY + speechBouncePx;

        for (let y = Math.max(0, charTop); y < Math.min(height, charBottom); y++) {
          const my = y - charTop;
          if (my < 0 || my >= meshH) continue;
          const rowMeshOffset = my * meshW * 4;
          const rowFrameOffset = y * width * 4;

          for (let x = Math.max(0, charLeft); x < Math.min(width, charLeft + targetCharW); x++) {
            const mx = x - charLeft;
            const mIdx = rowMeshOffset + mx * 4;
            const alpha = warpedMesh[mIdx + 3];
            if (alpha === 0) continue;

            const fIdx = rowFrameOffset + x * 4;
            if (alpha === 255) {
              frameBuf[fIdx] = warpedMesh[mIdx];
              frameBuf[fIdx + 1] = warpedMesh[mIdx + 1];
              frameBuf[fIdx + 2] = warpedMesh[mIdx + 2];
            } else {
              const aNorm = alpha / 255;
              const invA = 1 - aNorm;
              frameBuf[fIdx] = Math.round(warpedMesh[mIdx] * aNorm + frameBuf[fIdx] * invA);
              frameBuf[fIdx + 1] = Math.round(warpedMesh[mIdx + 1] * aNorm + frameBuf[fIdx + 1] * invA);
              frameBuf[fIdx + 2] = Math.round(warpedMesh[mIdx + 2] * aNorm + frameBuf[fIdx + 2] * invA);
            }
          }
        }

        // Draw a warm 3D gourmet wooden/marble studio counter surface from charBottom - 16 to height so the character stands naturally behind the counter!
        {
          const counterTop = charBottom - 16;
          for (let y = counterTop; y < height; y++) {
            const relY = (y - counterTop) / (height - counterTop);
            const isRim = y < counterTop + 18;
            const isShadowLine = y >= counterTop + 18 && y < counterTop + 24;
            const baseR = isRim ? 168 : isShadowLine ? 62 : Math.round(104 * (1 - relY * 0.35));
            const baseG = isRim ? 124 : isShadowLine ? 38 : Math.round(68 * (1 - relY * 0.35));
            const baseB = isRim ? 82 : isShadowLine ? 22 : Math.round(42 * (1 - relY * 0.35));
            const rowFrameOffset = y * width * 4;
            for (let x = 0; x < width; x++) {
              const fIdx = rowFrameOffset + x * 4;
              const centerGlow = Math.exp(-(((x - width * 0.5) / (width * 0.45)) ** 2)) * 22;
              frameBuf[fIdx] = Math.min(255, Math.round(baseR + centerGlow));
              frameBuf[fIdx + 1] = Math.min(255, Math.round(baseG + centerGlow * 0.75));
              frameBuf[fIdx + 2] = Math.min(255, Math.round(baseB + centerGlow * 0.45));
            }
          }
        }

        // 4. 30fps Ambient Floating Golden Dust / Christmas Snow Particles (adds living 3D atmosphere to the scene!)
        const isXmasClip = /natal|christmas/i.test(outputClipPath);
        const numParticles = isXmasClip ? 36 : 18;
        for (let p = 0; p < numParticles; p++) {
          const speedY = isXmasClip ? (55 + (p % 5) * 22) : (24 + (p % 4) * 12);
          const px = Math.round(((p * 173 + sceneIndex * 67) + Math.sin(t * 1.8 + p) * 38) % width);
          const py = Math.round(((p * 137 + t * speedY) % (charBottom - 20)));
          const pr = isXmasClip ? (3 + (p % 4)) : (2 + (p % 3));
          const pAlpha = (0.35 + 0.35 * Math.sin(t * 4.0 + p)) * (isXmasClip ? 0.9 : 0.6);
          const pR = 255;
          const pG = isXmasClip && (p % 2 === 0) ? 255 : 238;
          const pB = isXmasClip && (p % 2 === 0) ? 255 : 175;

          for (let dy = -pr; dy <= pr; dy++) {
            const yy = py + dy;
            if (yy < 0 || yy >= charBottom) continue;
            for (let dx = -pr; dx <= pr; dx++) {
              const xx = px + dx;
              if (xx < 0 || xx >= width) continue;
              const dist2 = (dx * dx + dy * dy) / (pr * pr);
              if (dist2 > 1.0) continue;
              const wP = (1.0 - dist2) * pAlpha;
              const fIdx = (yy * width + xx) * 4;
              frameBuf[fIdx] = Math.min(255, Math.round(frameBuf[fIdx] * (1 - wP) + pR * wP));
              frameBuf[fIdx + 1] = Math.min(255, Math.round(frameBuf[fIdx + 1] * (1 - wP) + pG * wP));
              frameBuf[fIdx + 2] = Math.min(255, Math.round(frameBuf[fIdx + 2] * (1 - wP) + pB * wP));
            }
          }
        }

        if (!ff.stdin.write(frameBuf)) {
          await new Promise(r => ff.stdin.once('drain', r));
        }
      }
      ff.stdin.end();
    })().catch(reject);
  });

  return outputClipPath;
}
