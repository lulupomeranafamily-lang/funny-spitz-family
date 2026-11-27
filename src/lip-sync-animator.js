import fs from 'fs';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

export const CHARACTER_RIGS = {};

/**
 * Extract frame-accurate 30fps Lip-Sync envelope (mouthOpen + mouthSpread) from an MP3/WAV/M4A voice file,
 * smoothed with a 5-tap Gaussian temporal filter so mouth movements are velvety-smooth and natural.
 */
export function extractAudioLipSyncEnvelope(audioPath, totalFrames, fps = 30) {
  const envelope = [];
  if (!audioPath || !fs.existsSync(audioPath)) {
    for (let f = 0; f < totalFrames; f++) {
      const t = f / fps;
      const open = Math.max(0, Math.sin(t * 12) * 0.45 + Math.sin(t * 19) * 0.35 + 0.25);
      envelope.push({ mouthOpen: Math.min(1.05, open), mouthSpread: Math.sin(t * 8) * 0.5 });
    }
    return smoothLipSyncEnvelope(envelope);
  }

  try {
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

    const rawRms = new Float32Array(totalFrames);
    const rawZcr = new Float32Array(totalFrames);
    let peakRms = 0.01;

    for (let f = 0; f < totalFrames; f++) {
      const startSample = f * samplesPerFrame;
      const endSample = Math.min(samples.length, startSample + samplesPerFrame);
      if (startSample >= samples.length || endSample <= startSample) continue;

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

    let prevOpen = 0;
    for (let f = 0; f < totalFrames; f++) {
      const globalNorm = rawRms[f] / (peakRms * 0.80);
      if (globalNorm < 0.085) {
        prevOpen = prevOpen * 0.45;
        envelope.push({ mouthOpen: prevOpen < 0.04 ? 0.0 : prevOpen, mouthSpread: 0.0 });
        continue;
      }

      let localMin = rawRms[f];
      let localMax = rawRms[f];
      for (let k = Math.max(0, f - 4); k <= Math.min(totalFrames - 1, f + 4); k++) {
        if (rawRms[k] < localMin) localMin = rawRms[k];
        if (rawRms[k] > localMax) localMax = rawRms[k];
      }

      const localSpan = Math.max(peakRms * 0.07, localMax - localMin);
      const syllablePhase = (rawRms[f] - localMin) / localSpan;

      let targetOpen;
      if (syllablePhase < 0.26) {
        targetOpen = 0.0;
      } else if (syllablePhase < 0.55) {
        targetOpen = 0.32 + ((syllablePhase - 0.26) / 0.29) * 0.36;
      } else {
        targetOpen = 0.74 + ((syllablePhase - 0.55) / 0.45) * 0.34 * Math.min(1.2, globalNorm);
      }

      const smoothedOpen = prevOpen * 0.35 + targetOpen * 0.65;
      prevOpen = smoothedOpen;

      const mouthSpread = Math.max(-0.65, Math.min(0.75, (rawZcr[f] - 0.11) * 7.0));
      envelope.push({
        mouthOpen: smoothedOpen < 0.04 ? 0.0 : smoothedOpen,
        mouthSpread
      });
    }
  } catch {
    for (let f = 0; f < totalFrames; f++) {
      const t = f / fps;
      const open = Math.max(0, Math.sin(t * 12) * 0.45 + Math.sin(t * 19) * 0.35 + 0.25);
      envelope.push({ mouthOpen: Math.min(1.05, open), mouthSpread: Math.sin(t * 8) * 0.5 });
    }
  }

  return smoothLipSyncEnvelope(envelope);
}

/**
 * 5-tap Gaussian temporal smoothing kernel for organic, non-robotic mouth motion.
 */
export function smoothLipSyncEnvelope(rawEnv) {
  const n = rawEnv.length;
  if (n === 0) return rawEnv;
  const weights = [0.10, 0.22, 0.36, 0.22, 0.10];
  return rawEnv.map((_, i) => {
    let sumOpen = 0;
    let sumSpread = 0;
    for (let k = -2; k <= 2; k++) {
      const idx = Math.max(0, Math.min(n - 1, i + k));
      const w = weights[k + 2];
      sumOpen += rawEnv[idx].mouthOpen * w;
      sumSpread += (rawEnv[idx].mouthSpread || 0) * w;
    }
    return {
      mouthOpen: sumOpen < 0.035 ? 0.0 : sumOpen,
      mouthSpread: sumSpread
    };
  });
}

/**
 * Automatically detects the speaking dog's mouth center (cx, cy) and radii (rx, ry)
 * in a full-scene 3D photograph or video frame.
 */
export function detectMouthInSceneRGBA(buf, W, H, hintCx = 0.50, hintCy = 0.48, searchRx = 0.22, searchRy = 0.20) {
  const minX = Math.max(0, Math.floor((hintCx - searchRx) * W));
  const maxX = Math.min(W - 1, Math.ceil((hintCx + searchRx) * W));
  const minY = Math.max(0, Math.floor((hintCy - searchRy) * H));
  const maxY = Math.min(H - 1, Math.ceil((hintCy + searchRy) * H));

  let sumX = 0;
  let sumY = 0;
  let sumW = 0;
  let minTongueX = W;
  let maxTongueX = 0;
  let minTongueY = H;
  let maxTongueY = 0;

  for (let y = minY; y <= maxY; y++) {
    const rowOff = y * W * 4;
    for (let x = minX; x <= maxX; x++) {
      const i = rowOff + x * 4;
      const r = buf[i];
      const g = buf[i + 1];
      const b = buf[i + 2];
      // True Pink Tongue signature (magenta-red: r > g + 26, b close to g so yellow/golden fur is excluded!)
      if (r > 115 && r > g + 26 && b >= g - 14 && g < 165) {
        // Favor pixels closer to center (hintCx, hintCy)
        const distNorm = Math.hypot((x / W - hintCx) / searchRx, (y / H - hintCy) / searchRy);
        const spatialW = Math.max(0.2, 1.0 - distNorm * 0.6);
        const w = (r - g) * spatialW;
        sumX += x * w;
        sumY += y * w;
        sumW += w;
        if (w > 18) {
          if (x < minTongueX) minTongueX = x;
          if (x > maxTongueX) maxTongueX = x;
          if (y < minTongueY) minTongueY = y;
          if (y > maxTongueY) maxTongueY = y;
        }
      }
    }
  }

  const isVertical = H > W;
  const defaultRx = isVertical ? 0.062 : 0.036;
  const defaultRy = isVertical ? 0.028 : 0.032;

  if (sumW > 220) {
    const cx = (sumX / sumW) / W;
    const cy = (sumY / sumW) / H;
    const estRx = Math.max(defaultRx * 0.7, Math.min(defaultRx * 1.35, ((maxTongueX - minTongueX) / W) * 0.85));
    const estRy = Math.max(defaultRy * 0.7, Math.min(defaultRy * 1.35, ((maxTongueY - minTongueY) / H) * 0.75));
    return {
      cx,
      cy,
      rx: estRx || defaultRx,
      ry: estRy || defaultRy,
      baseOpen: 0.78,
      hasOpenTongue: true
    };
  }

  return {
    cx: hintCx,
    cy: hintCy,
    rx: defaultRx,
    ry: defaultRy,
    baseOpen: 0.78,
    hasOpenTongue: false
  };
}

/**
 * Strictly localized, diffeomorphic (non-folding) Lower-Jaw & Mouth Lip-Sync shader.
 * Modifies ONLY the tiny mouth/chin box -> 0.00% background distortion guaranteed!
 */
export function applyLocalizedSmoothMouthRGBA(srcBuf, W, H, mouthRig, envState) {
  const dstBuf = Buffer.from(srcBuf);

  const mCx = mouthRig.cx * W;
  const mCy = mouthRig.cy * H;
  const mRx = (mouthRig.rx || 0.062) * W;
  const mRy = (mouthRig.ry || 0.028) * H;
  const baseOpen = mouthRig.baseOpen ?? 0.78;
  const mouthOpen = envState.mouthOpen ?? baseOpen;
  const closure = (baseOpen - mouthOpen) / Math.max(0.01, baseOpen);
  const mouthSpread = envState.mouthSpread || 0;

  const boxLeft = Math.max(0, Math.floor(mCx - mRx * 1.35));
  const boxRight = Math.min(W - 1, Math.ceil(mCx + mRx * 1.35));
  const upperLipAnchorY = mCy - mRy * 0.25;
  const lowerChinLimitY = mCy + mRy * 2.10;
  const boxTop = Math.max(0, Math.floor(upperLipAnchorY - 2));
  const boxBottom = Math.min(H - 1, Math.ceil(lowerChinLimitY + 2));
  const spanY = Math.max(4, lowerChinLimitY - upperLipAnchorY);

  for (let y = boxTop; y <= boxBottom; y++) {
    for (let x = boxLeft; x <= boxRight; x++) {
      const dxM = (x - mCx) / (mRx * 1.28);
      if (Math.abs(dxM) >= 1.28) continue;

      let srcX = x;
      let srcY = y;

      if (y > upperLipAnchorY && y < lowerChinLimitY) {
        const horizM = Math.cos((dxM / 1.28) * (Math.PI / 2)) ** 2;
        const relY = (y - upperLipAnchorY) / spanY;
        const vertM = Math.sin(relY * Math.PI) ** 1.2;

        if (mouthRig.hasOpenTongue) {
          if (closure >= 0) {
            const jawLift = closure * mRy * 0.52 * horizM * vertM;
            srcY += jawLift;
          } else if (relY > 0.16) {
            const openRelY = (relY - 0.16) / 0.84;
            const dropEnv = Math.sin(openRelY * Math.PI) ** 1.25;
            const jawDrop = (-closure) * mRy * 0.75 * horizM * dropEnv;
            srcY -= jawDrop;
          }
        } else {
          // Initially closed mouth: gently drop lower jaw on vowels
          if (mouthOpen > 0.10 && relY > 0.12) {
            const openRelY = (relY - 0.12) / 0.88;
            const dropEnv = Math.sin(openRelY * Math.PI) ** 1.25;
            srcY -= mouthOpen * mRy * 0.65 * horizM * dropEnv;
          }
        }

        const spreadFactor = mouthSpread * 0.14 * horizM * vertM;
        srcX -= (x - mCx) * spreadFactor;
      }

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

      if (mouthRig.hasOpenTongue) {
        const openRatio = Math.min(1.0, Math.max(0.0, mouthOpen / baseOpen));
        if (openRatio < 0.94) {
          const dxLip = (x - mCx) / (mRx * 1.04);
          const dyLip = (y - (mCy + mRy * 0.05)) / (mRy * 1.12);
          const inMouthEllipse = dxLip * dxLip + dyLip * dyLip;

          if (inMouthEllipse < 1.08 && Math.abs(dxLip) < 0.98) {
            const topSmileY = mCy - mRy * 0.18 + 0.18 * mRy * (1.0 - dxLip * dxLip);
            const bottomOpenY = mCy + mRy * 0.92;
            const currentLowerLipY = topSmileY + (bottomOpenY - topSmileY) * (0.05 + 0.95 * openRatio);

            const isTruePinkTongue = (r > 105 && r > g + 22 && b >= g - 14);
            const isTrueDarkInnerMouth = (r < 85 && g < 72 && b < 72 && Math.abs(dxLip) < 0.85);

            if ((isTruePinkTongue || isTrueDarkInnerMouth) && y >= currentLowerLipY - mRy * 0.12) {
              const distBelowLip = (y - currentLowerLipY) / mRy;
              const horizSoft = Math.cos((dxLip / 0.98) * (Math.PI / 2)) ** 1.4;
              const radialFade = Math.min(1.0, (1.08 - inMouthEllipse) * 2.8) * horizSoft;

              if (distBelowLip < 0.15) {
                const lipEdgeW = Math.min(0.95, (1.0 - openRatio * 0.45) * radialFade);
                r = r * (1 - lipEdgeW) + 32 * lipEdgeW;
                g = g * (1 - lipEdgeW) + 24 * lipEdgeW;
                b = b * (1 - lipEdgeW) + 24 * lipEdgeW;
              } else {
                const leftSampleX = Math.max(0, Math.min(W - 1, Math.round(mCx - mRx * 1.38 - Math.abs(x - mCx) * 0.15)));
                const rightSampleX = Math.max(0, Math.min(W - 1, Math.round(mCx + mRx * 1.38 + Math.abs(x - mCx) * 0.15)));
                const cheekSampleY = Math.max(0, Math.min(H - 1, Math.round(y + mRy * 0.25)));
                const lIdx = (cheekSampleY * W + leftSampleX) * 4;
                const rIdx = (cheekSampleY * W + rightSampleX) * 4;
                const rightWeight = Math.min(1, Math.max(0, (dxLip + 1.0) * 0.5));
                const furR = srcBuf[lIdx] * (1 - rightWeight) + srcBuf[rIdx] * rightWeight;
                const furG = srcBuf[lIdx + 1] * (1 - rightWeight) + srcBuf[rIdx + 1] * rightWeight;
                const furB = srcBuf[lIdx + 2] * (1 - rightWeight) + srcBuf[rIdx + 2] * rightWeight;

                const coverW = Math.min(0.96, Math.min(1.0, (distBelowLip - 0.15) * 4.2 + 0.65) * radialFade);
                r = r * (1 - coverW) + furR * coverW;
                g = g * (1 - coverW) + furG * coverW;
                b = b * (1 - coverW) + furB * coverW;
              }
            }
          }
        }
      }

      const dstIdx = (y * W + x) * 4;
      dstBuf[dstIdx] = Math.round(r);
      dstBuf[dstIdx + 1] = Math.round(g);
      dstBuf[dstIdx + 2] = Math.round(b);
    }
  }

  return dstBuf;
}

export function deformCharacterMultiFaceRGBA(srcBuf) {
  return srcBuf;
}

/**
 * Official Standard 30fps Scene Renderer:
 * - Works directly on 100% integrated full-scene 3D images or 3D video clips (Wan 2.2 / Google Vids 3D)
 * - ZERO floating cutouts, ZERO fake counter bars, ZERO background distortion!
 * - Smooth, natural, syllable-accurate lower-jaw & mouth Lip-Sync movement ("a cereja do bolo")!
 */
export async function renderLipSyncSceneClip({
  character,
  sceneIndex = 0,
  backgroundPath,
  voiceAudioPath,
  outputClipPath,
  durationSec = 6.0,
  fps = 30,
  width = 1920,
  height = 1080
}) {
  const totalFrames = Math.ceil(durationSec * fps);
  const smoothEnv = extractAudioLipSyncEnvelope(voiceAudioPath, totalFrames, fps);

  // Check if a real 3D video clip exists for this scene (e.g. clips/scene_XX.mp4 or Wan 2.2 clip)
  const isVideoSource = backgroundPath && /\.(mp4|webm|mov)$/i.test(backgroundPath) && fs.existsSync(backgroundPath);

  // Render at efficient internal resolution (720p equivalent) and let FFmpeg scale cleanly if needed
  const isVertical = height > width;
  const renderW = isVertical ? 720 : 1280;
  const renderH = isVertical ? 1280 : 720;

  if (isVideoSource) {
    const rawFramesBuf = execFileSync(ffmpegPath, [
      '-i', backgroundPath,
      '-vf', `fps=20,scale=${renderW}:${renderH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${renderW}:${renderH}`,
      '-t', '2.5',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 350 * 1024 * 1024 });

    const frameSize = renderW * renderH * 4;
    const numSourceFrames = Math.max(1, Math.floor(rawFramesBuf.length / frameSize));
    const initialFrame = rawFramesBuf.subarray(0, frameSize);
    let mouthRig = detectMouthInSceneRGBA(initialFrame, renderW, renderH);

    await new Promise((resolve, reject) => {
      const ff = spawn(ffmpegPath, [
        '-y',
        '-f', 'rawvideo',
        '-pix_fmt', 'rgba',
        '-s', `${renderW}x${renderH}`,
        '-r', String(fps),
        '-i', 'pipe:0',
        '-vf', `scale=${width}:${height}:flags=lanczos`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '18',
        '-pix_fmt', 'yuv420p',
        outputClipPath
      ], { stdio: ['pipe', 'ignore', 'ignore'] });

      ff.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
      ff.on('error', reject);

      (async () => {
        const cycleLen = Math.max(1, (numSourceFrames - 1) * 2);
        for (let f = 0; f < totalFrames; f++) {
          const cPos = Math.floor(f * 0.65) % cycleLen;
          const srcIdx = cPos < numSourceFrames ? cPos : cycleLen - cPos;
          const frameSlice = rawFramesBuf.subarray(srcIdx * frameSize, (srcIdx + 1) * frameSize);
          const tracked = detectMouthInSceneRGBA(frameSlice, renderW, renderH, mouthRig.cx, mouthRig.cy, 0.06, 0.045);
          if (tracked.hasOpenTongue) {
            mouthRig.cx = mouthRig.cx * 0.72 + tracked.cx * 0.28;
            mouthRig.cy = mouthRig.cy * 0.72 + tracked.cy * 0.28;
          }
          const env = smoothEnv[f] || { mouthOpen: 0, mouthSpread: 0 };
          const outFrame = applyLocalizedSmoothMouthRGBA(frameSlice, renderW, renderH, mouthRig, env);
          if (!ff.stdin.write(outFrame)) {
            await new Promise(r => ff.stdin.once('drain', r));
          }
        }
        ff.stdin.end();
      })().catch(reject);
    });

    return outputClipPath;
  }

  // Full-scene integrated 3D photograph: oversized canvas for gentle cinema camera motion + localized smooth mouth Lip-Sync (0% background distortion)
  const padX = 36;
  const padY = 36;
  const canvasW = renderW + padX;
  const canvasH = renderH + padY;

  const { data: srcCanvasRaw } = await sharp(backgroundPath)
    .resize(canvasW, canvasH, { fit: 'cover', position: 'center' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mouthRig = detectMouthInSceneRGBA(srcCanvasRaw, canvasW, canvasH, 0.50, isVertical ? 0.46 : 0.45);
  const panDir = sceneIndex % 2 === 0 ? 1 : -1;

  await new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      '-y',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', `${renderW}x${renderH}`,
      '-r', String(fps),
      '-i', 'pipe:0',
      '-vf', `scale=${width}:${height}:flags=lanczos`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      outputClipPath
    ], { stdio: ['pipe', 'ignore', 'ignore'] });

    ff.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
    ff.on('error', reject);

    (async () => {
      const cropBuf = Buffer.allocUnsafe(renderW * renderH * 4);
      for (let f = 0; f < totalFrames; f++) {
        const t = f / fps;
        const progress = f / Math.max(1, totalFrames - 1);
        const env = smoothEnv[f] || { mouthOpen: 0, mouthSpread: 0 };

        // Apply localized smooth mouth movement on the full canvas (0% background distortion!)
        const frameWithMouth = applyLocalizedSmoothMouthRGBA(srcCanvasRaw, canvasW, canvasH, mouthRig, env);

        // Smooth handheld cinema camera drift across the oversized canvas
        const camX = Math.round((padX / 2) + panDir * (progress - 0.5) * padX * 0.78);
        const camY = Math.round((padY / 2) + Math.sin(t * 0.85) * (padY * 0.35));

        for (let y = 0; y < renderH; y++) {
          const srcStart = ((y + camY) * canvasW + camX) * 4;
          const dstStart = y * renderW * 4;
          frameWithMouth.copy(cropBuf, dstStart, srcStart, srcStart + renderW * 4);
        }

        if (!ff.stdin.write(cropBuf)) {
          await new Promise(r => ff.stdin.once('drain', r));
        }
      }
      ff.stdin.end();
    })().catch(reject);
  });

  return outputClipPath;
}
