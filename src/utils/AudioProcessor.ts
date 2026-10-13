import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export type ExportFormat = 'mp3' | 'wav';

export interface TrimOptions {
  file: File;
  startTime: number;
  endTime: number;
  fadeIn: boolean;
  fadeOut: boolean;
  fadeDuration?: number;
  outputFormat?: ExportFormat;
  onStatusChange?: (stage: 'loading-core' | 'processing' | 'done') => void;
  onProgress?: (progress: number) => void;
}

export interface TrimResult {
  blob: Blob;
  filename: string;
  duration: number;
  engine: 'ffmpeg-wasm' | 'webaudio-fallback';
}

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadingPromise: Promise<FFmpeg> | null = null;

const CORE_VERSION = '0.12.6';
const CDN_BASES = [
  `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
  `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`,
];

/**
 * Lazily loads and initializes the single-threaded FFmpeg.wasm core.
 * Compatible with GitHub Pages without requiring SharedArrayBuffer headers.
 */
export async function loadFFmpegCore(
  onProgress?: (progress: number) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  if (ffmpegLoadingPromise) {
    return ffmpegLoadingPromise;
  }

  ffmpegLoadingPromise = (async () => {
    const ffmpeg = new FFmpeg();

    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        const clamped = Math.max(0, Math.min(1, progress || 0));
        onProgress(Math.round(clamped * 100));
      });
    }

    let lastError: unknown = null;
    for (const baseURL of CDN_BASES) {
      try {
        const [coreURL, wasmURL] = await Promise.all([
          toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        ]);

        await ffmpeg.load({ coreURL, wasmURL });
        ffmpegInstance = ffmpeg;
        return ffmpeg;
      } catch (err) {
        lastError = err;
      }
    }

    ffmpegLoadingPromise = null;
    throw lastError || new Error('Failed to load FFmpeg.wasm core from CDN.');
  })();

  return ffmpegLoadingPromise;
}

/**
 * Slices an audio file between startTime and endTime, applies optional Fade In / Fade Out,
 * and returns a downloadable Blob using FFmpeg.wasm (with Web Audio API fallback).
 */
export async function processAndTrimAudio(options: TrimOptions): Promise<TrimResult> {
  const {
    file,
    startTime,
    endTime,
    fadeIn,
    fadeOut,
    fadeDuration = 1.5,
    outputFormat = 'mp3',
    onStatusChange,
    onProgress,
  } = options;

  const safeStart = Math.max(0, Math.min(startTime, endTime));
  const safeEnd = Math.max(safeStart + 0.05, endTime);
  const clipDuration = safeEnd - safeStart;

  // Cap fade duration so fade-in + fade-out never exceed half of a very short clip
  const effectiveFade = Math.min(fadeDuration, Number((clipDuration * 0.45).toFixed(2)));

  const baseName = file.name.replace(/\.[^/.]+$/, '') || 'audio';
  const outputFilename = `${baseName}_trimmed_${formatSecondsForFilename(safeStart)}-${formatSecondsForFilename(safeEnd)}.${outputFormat}`;

  try {
    onStatusChange?.('loading-core');
    const ffmpeg = await loadFFmpegCore(onProgress);

    onStatusChange?.('processing');
    onProgress?.(5);

    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const inputExt = extMatch ? extMatch[1].toLowerCase() : 'mp3';
    const inputVirtualName = `input_${Date.now()}.${inputExt}`;
    const outputVirtualName = `output_${Date.now()}.${outputFormat}`;

    await ffmpeg.writeFile(inputVirtualName, await fetchFile(file));

    const filterChain: string[] = [];
    if (fadeIn && effectiveFade > 0.05) {
      filterChain.push(`afade=t=in:st=0:d=${effectiveFade.toFixed(3)}`);
    }
    if (fadeOut && effectiveFade > 0.05) {
      const fadeOutStart = Math.max(0, clipDuration - effectiveFade);
      filterChain.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${effectiveFade.toFixed(3)}`);
    }

    const args: string[] = [
      '-ss',
      safeStart.toFixed(3),
      '-t',
      clipDuration.toFixed(3),
      '-i',
      inputVirtualName,
    ];

    if (filterChain.length > 0) {
      args.push('-af', filterChain.join(','));
    }

    if (outputFormat === 'mp3') {
      args.push('-vn', '-acodec', 'libmp3lame', '-q:a', '2', outputVirtualName);
    } else {
      args.push('-vn', '-acodec', 'pcm_s16le', outputVirtualName);
    }

    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) {
      throw new Error(`FFmpeg exited with code ${exitCode}`);
    }

    const data = await ffmpeg.readFile(outputVirtualName);

    // Clean up virtual FS
    await ffmpeg.deleteFile(inputVirtualName).catch(() => {});
    await ffmpeg.deleteFile(outputVirtualName).catch(() => {});

    const uint8 = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const mimeType = outputFormat === 'mp3' ? 'audio/mpeg' : 'audio/wav';
    const blob = new Blob([uint8.buffer as ArrayBuffer], { type: mimeType });

    onProgress?.(100);
    onStatusChange?.('done');

    return {
      blob,
      filename: outputFilename,
      duration: clipDuration,
      engine: 'ffmpeg-wasm',
    };
  } catch (ffmpegError) {
    console.warn('FFmpeg.wasm unavailable or failed, using Web Audio API fallback:', ffmpegError);
    onStatusChange?.('processing');
    onProgress?.(35);

    const wavBlob = await sliceWithWebAudioFallback(
      file,
      safeStart,
      safeEnd,
      fadeIn,
      fadeOut,
      effectiveFade
    );

    const fallbackFilename = `${baseName}_trimmed_${formatSecondsForFilename(safeStart)}-${formatSecondsForFilename(safeEnd)}.wav`;
    onProgress?.(100);
    onStatusChange?.('done');

    return {
      blob: wavBlob,
      filename: fallbackFilename,
      duration: clipDuration,
      engine: 'webaudio-fallback',
    };
  }
}

/**
 * Triggers an immediate browser download for a processed audio Blob.
 */
export function triggerAudioDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/**
 * High-precision Web Audio API fallback slicer & WAV encoder.
 */
async function sliceWithWebAudioFallback(
  file: File,
  startTime: number,
  endTime: number,
  fadeIn: boolean,
  fadeOut: boolean,
  fadeDuration: number
): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const sampleRate = decodedBuffer.sampleRate;
    const channels = decodedBuffer.numberOfChannels;

    const startSample = Math.max(0, Math.floor(startTime * sampleRate));
    const endSample = Math.min(decodedBuffer.length, Math.ceil(endTime * sampleRate));
    const frameCount = Math.max(1, endSample - startSample);

    const fadeSamples = Math.min(Math.floor(fadeDuration * sampleRate), Math.floor(frameCount * 0.45));

    const trimmedChannels: Float32Array[] = [];
    for (let ch = 0; ch < channels; ch++) {
      const sourceData = decodedBuffer.getChannelData(ch);
      const slice = new Float32Array(frameCount);
      for (let i = 0; i < frameCount; i++) {
        let sample = sourceData[startSample + i] || 0;

        if (fadeIn && fadeSamples > 0 && i < fadeSamples) {
          const gain = i / fadeSamples;
          sample *= gain;
        }
        if (fadeOut && fadeSamples > 0 && i >= frameCount - fadeSamples) {
          const remaining = frameCount - 1 - i;
          const gain = Math.max(0, remaining / fadeSamples);
          sample *= gain;
        }

        slice[i] = sample;
      }
      trimmedChannels.push(slice);
    }

    return encodeWavFromChannels(trimmedChannels, sampleRate);
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

/**
 * Encodes Float32Array channel buffers into a standard 16-bit PCM WAV Blob.
 */
export function encodeWavFromChannels(channels: Float32Array[], sampleRate: number): Blob {
  const numChannels = channels.length;
  const numFrames = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const clamped = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function formatSecondsForFilename(sec: number): string {
  const mins = Math.floor(sec / 60);
  const rem = (sec % 60).toFixed(1).padStart(4, '0');
  return `${mins}m${rem}s`.replace('.', '_');
}

/**
 * Generates an engaging musical stereo synth progression in-memory so users can test
 * AudioCutter's waveform, regions, fades, and FFmpeg export immediately without uploading a file.
 */
export function generateDemoAudioFile(): File {
  const sampleRate = 44100;
  const durationSeconds = 12;
  const totalSamples = sampleRate * durationSeconds;
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  // Warm ambient chord progression (Fmaj7 -> Em7 -> Dm7 -> Cmaj7)
  const chords = [
    [174.61, 220.0, 261.63, 329.63, 392.0],
    [164.81, 196.0, 246.94, 293.66, 392.0],
    [146.83, 174.61, 220.0, 261.63, 349.23],
    [130.81, 164.81, 196.0, 246.94, 329.63],
  ];

  // Melodic pluck notes
  const arpNotes = [523.25, 659.25, 783.99, 659.25, 587.33, 493.88, 440.0, 392.0];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.min(chords.length - 1, Math.floor(t / 3));
    const chord = chords[chordIdx];
    const localChordTime = t % 3;

    // Envelope for chord swell
    const chordEnv =
      Math.min(1, localChordTime / 0.25) * Math.exp(-localChordTime * 0.45);

    let padL = 0;
    let padR = 0;
    for (let n = 0; n < chord.length; n++) {
      const freq = chord[n];
      const detune = n % 2 === 0 ? 1.002 : 0.998;
      padL += Math.sin(2 * Math.PI * freq * t) * 0.11;
      padR += Math.sin(2 * Math.PI * freq * detune * t + 0.3) * 0.11;
    }

    // Rhythmic pulse / melodic pluck every 0.375s
    const stepDuration = 0.375;
    const stepIdx = Math.floor(t / stepDuration);
    const stepTime = t % stepDuration;
    const arpFreq = arpNotes[stepIdx % arpNotes.length];
    const pluckEnv = Math.exp(-stepTime * 11);
    const pluck =
      (Math.sin(2 * Math.PI * arpFreq * t) +
        0.4 * Math.sin(2 * Math.PI * arpFreq * 2 * t)) *
      pluckEnv *
      0.24;

    // Gentle percussion transient on beats
    const beatTime = t % 0.75;
    const kickEnv = Math.exp(-beatTime * 28);
    const kickFreq = 55 + 90 * Math.exp(-beatTime * 40);
    const kick = Math.sin(2 * Math.PI * kickFreq * beatTime) * kickEnv * 0.28;

    left[i] = Math.tanh((padL * chordEnv + pluck * 0.9 + kick) * 1.1);
    right[i] = Math.tanh((padR * chordEnv + pluck * 1.1 + kick) * 1.1);
  }

  const wavBlob = encodeWavFromChannels([left, right], sampleRate);
  return new File([wavBlob], 'AudioCutter_Studio_Demo.wav', { type: 'audio/wav' });
}
