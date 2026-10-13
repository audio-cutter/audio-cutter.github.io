import React, { useState, useRef, useEffect, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import {
  Upload,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Scissors,
  Download,
  Sparkles,
  Repeat,
  FileAudio,
  CheckCircle2,
  Loader2,
  Sliders,
} from 'lucide-react';
import {
  processAndTrimAudio,
  triggerAudioDownload,
  generateDemoAudioFile,
  type ExportFormat,
} from '../utils/AudioProcessor';
import type { TranslationDictionary } from '../i18n/translations';

interface AudioEditorProps {
  t: TranslationDictionary;
}

function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const minsStr = String(mins).padStart(2, '0');
  const secsStr = secs.toFixed(2).padStart(5, '0');
  return `${minsStr}:${secsStr}`;
}

function parseTimestampInput(value: string, fallback: number): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const mins = parseFloat(parts[0]) || 0;
      const secs = parseFloat(parts[1]) || 0;
      return Math.max(0, mins * 60 + secs);
    }
  }

  const num = parseFloat(trimmed);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Injects high-visibility selection & bold handle styles directly into Wavesurfer's Shadow DOM
 * and customizes the Region element so the selected area and both side lines are unmistakable.
 */
function enhanceRegionVisuals(ws: WaveSurfer, region: Region) {
  const wrapper = ws.getWrapper();
  const rootNode = wrapper?.getRootNode() as ShadowRoot | Document | undefined;

  if (rootNode && 'querySelector' in rootNode && !rootNode.querySelector('#audiocutter-shadow-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'audiocutter-shadow-styles';
    styleEl.textContent = `
      [part="regions-container"] {
        overflow: hidden !important;
        border-radius: 10px;
      }
      [part*="region"] {
        background: linear-gradient(180deg, rgba(245, 158, 11, 0.30) 0%, rgba(16, 185, 129, 0.26) 100%) !important;
        border-top: 3px solid #790D16 !important;
        border-bottom: 3px solid #790D16 !important;
        box-shadow: 0 0 0 9999px rgba(18, 19, 22, 0.32), inset 0 0 18px rgba(245, 158, 11, 0.22) !important;
        box-sizing: border-box !important;
        z-index: 4 !important;
      }
      [part*="region-handle"] {
        width: 10px !important;
        background-color: #790D16 !important;
        border: none !important;
        opacity: 1 !important;
        z-index: 10 !important;
        box-shadow: 0 0 10px rgba(121, 13, 22, 0.55) !important;
        transition: background-color 0.15s ease, width 0.15s ease !important;
      }
      [part*="region-handle"]:hover,
      [part*="region-handle"]:active {
        width: 12px !important;
        background-color: #96121D !important;
      }
      [part*="region-handle"]::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 18px;
        height: 36px;
        background-color: #790D16;
        border: 2px solid #F5EFE1;
        border-radius: 6px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      }
      [part*="region-handle"]::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 4px;
        height: 14px;
        border-left: 1.5px solid #F5EFE1;
        border-right: 1.5px solid #F5EFE1;
      }
    `;
    rootNode.appendChild(styleEl);
  }

  if (region.element) {
    region.element.style.borderTop = '3px solid #790D16';
    region.element.style.borderBottom = '3px solid #790D16';
    region.element.style.background =
      'linear-gradient(180deg, rgba(245, 158, 11, 0.30) 0%, rgba(16, 185, 129, 0.26) 100%)';
    region.element.style.boxShadow =
      '0 0 0 9999px rgba(18, 19, 22, 0.32), inset 0 0 18px rgba(245, 158, 11, 0.22)';

    const leftHandle = region.element.querySelector('[part*="region-handle-left"]') as HTMLElement | null;
    const rightHandle = region.element.querySelector('[part*="region-handle-right"]') as HTMLElement | null;

    [leftHandle, rightHandle].forEach((handle) => {
      if (handle) {
        handle.style.width = '10px';
        handle.style.backgroundColor = '#790D16';
        handle.style.border = 'none';
        handle.style.opacity = '1';
      }
    });
  }
}

export default function AudioEditor({ t }: AudioEditorProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isWaveReady, setIsWaveReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loopRegion, setLoopRegion] = useState(true);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  const [startInput, setStartInput] = useState('00:00.00');
  const [endInput, setEndInput] = useState('00:00.00');

  const [zoomLevel, setZoomLevel] = useState(1);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [outputFormat, setOutputFormat] = useState<ExportFormat>('mp3');

  const [isExporting, setIsExporting] = useState(false);
  const [exportStage, setExportStage] = useState<'loading-core' | 'processing' | 'done' | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  const waveformContainerRef = useRef<HTMLDivElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  const activeRegionRef = useRef<Region | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startTimeRef = useRef(0);
  const endTimeRef = useRef(0);
  const loopRegionRef = useRef(true);
  const fadeInRef = useRef(false);
  const fadeOutRef = useRef(false);
  const isMutedRef = useRef(false);

  useEffect(() => {
    startTimeRef.current = startTime;
    endTimeRef.current = endTime;
  }, [startTime, endTime]);

  useEffect(() => {
    loopRegionRef.current = loopRegion;
  }, [loopRegion]);

  useEffect(() => {
    fadeInRef.current = fadeIn;
    fadeOutRef.current = fadeOut;
  }, [fadeIn, fadeOut]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const handleFileSelection = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      setErrorMsg(null);
      setExportSuccessMessage(null);

      const validTypes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/x-wav',
        'audio/wave',
        'audio/flac',
        'audio/ogg',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/webm',
      ];
      const validExt = /\.(mp3|wav|flac|ogg|m4a|aac|opus|webm)$/i.test(file.name);

      if (!validTypes.includes(file.type) && !validExt) {
        setErrorMsg(t.dropzone.errorUnsupported);
        return;
      }

      setIsWaveReady(false);
      setIsPlaying(false);
      setZoomLevel(1);
      setAudioFile(file);
    },
    [t.dropzone.errorUnsupported]
  );

  const handleLoadDemo = useCallback(() => {
    setErrorMsg(null);
    setExportSuccessMessage(null);
    const demoFile = generateDemoAudioFile();
    setIsWaveReady(false);
    setIsPlaying(false);
    setZoomLevel(1);
    setAudioFile(demoFile);
  }, []);

  useEffect(() => {
    if (!audioFile || !waveformContainerRef.current) return;

    let isCancelled = false;
    const objectUrl = URL.createObjectURL(audioFile);

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    const regions = RegionsPlugin.create();
    regionsPluginRef.current = regions;

    const ws = WaveSurfer.create({
      container: waveformContainerRef.current,
      waveColor: '#AEC4D4',
      progressColor: '#AEC4D4',
      cursorColor: '#231F20',
      cursorWidth: 2,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      height: 196,
      normalize: true,
      minPxPerSec: 1,
      autoScroll: true,
      autoCenter: true,
      plugins: [regions],
    });

    wavesurferRef.current = ws;

    ws.on('ready', () => {
      if (isCancelled) return;
      const totalDur = ws.getDuration();
      setDuration(totalDur);
      setCurrentTime(0);

      const initialStart = totalDur > 4 ? Number((totalDur * 0.15).toFixed(2)) : 0;
      const initialEnd = totalDur > 4 ? Number((totalDur * 0.85).toFixed(2)) : Number(totalDur.toFixed(2));

      setStartTime(initialStart);
      setEndTime(initialEnd);
      setStartInput(formatTimestamp(initialStart));
      setEndInput(formatTimestamp(initialEnd));

      regions.clearRegions();
      const region = regions.addRegion({
        start: initialStart,
        end: initialEnd,
        color: 'rgba(245, 158, 11, 0.28)',
        drag: true,
        resize: true,
      });

      enhanceRegionVisuals(ws, region);

      activeRegionRef.current = region;
      ws.setTime(initialStart);
      setIsWaveReady(true);
    });

    regions.on('region-updated', (region: Region) => {
      if (isCancelled) return;
      const newStart = Math.max(0, Number(region.start.toFixed(2)));
      const newEnd = Math.max(newStart + 0.05, Number(region.end.toFixed(2)));
      setStartTime(newStart);
      setEndTime(newEnd);
      setStartInput(formatTimestamp(newStart));
      setEndInput(formatTimestamp(newEnd));
    });

    ws.on('timeupdate', (time: number) => {
      if (isCancelled) return;
      setCurrentTime(time);

      const s = startTimeRef.current;
      const e = endTimeRef.current;
      const clipLen = Math.max(0.1, e - s);
      const fadeDur = Math.min(1.5, clipLen * 0.45);

      if (!isMutedRef.current && ws.isPlaying() && time >= s && time <= e) {
        let gain = 1;
        if (fadeInRef.current && time - s < fadeDur) {
          gain = Math.max(0.05, (time - s) / fadeDur);
        } else if (fadeOutRef.current && e - time < fadeDur) {
          gain = Math.max(0.05, (e - time) / fadeDur);
        }
        ws.setVolume(gain);
      } else if (!isMutedRef.current) {
        ws.setVolume(1);
      }

      if (ws.isPlaying() && e > s && time >= e) {
        if (loopRegionRef.current) {
          ws.setTime(s);
        } else {
          ws.pause();
          ws.setTime(s);
        }
      }
    });

    ws.on('play', () => {
      if (!isCancelled) setIsPlaying(true);
    });

    ws.on('pause', () => {
      if (!isCancelled) setIsPlaying(false);
    });

    ws.on('finish', () => {
      if (!isCancelled) setIsPlaying(false);
    });

    ws.load(objectUrl);

    return () => {
      isCancelled = true;
      ws.destroy();
      URL.revokeObjectURL(objectUrl);
    };
  }, [audioFile]);

  const applyNewBounds = useCallback(
    (rawStart: number, rawEnd: number) => {
      if (!duration) return;
      const clampedStart = Math.max(0, Math.min(rawStart, duration - 0.05));
      const clampedEnd = Math.max(clampedStart + 0.05, Math.min(rawEnd, duration));

      const roundedStart = Number(clampedStart.toFixed(2));
      const roundedEnd = Number(clampedEnd.toFixed(2));

      setStartTime(roundedStart);
      setEndTime(roundedEnd);
      setStartInput(formatTimestamp(roundedStart));
      setEndInput(formatTimestamp(roundedEnd));

      if (activeRegionRef.current) {
        activeRegionRef.current.setOptions({
          start: roundedStart,
          end: roundedEnd,
        });
      }
    },
    [duration]
  );

  const handleTogglePlayRegion = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isWaveReady) return;

    if (ws.isPlaying()) {
      ws.pause();
    } else {
      const current = ws.getCurrentTime();
      if (current < startTime || current >= endTime - 0.05) {
        ws.setTime(startTime);
      }
      ws.play();
    }
  }, [isWaveReady, startTime, endTime]);

  const handlePlayFromRegionStart = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isWaveReady) return;
    ws.setTime(startTime);
    ws.play();
  }, [isWaveReady, startTime]);

  const handleResetRegion = useCallback(() => {
    if (!duration) return;
    applyNewBounds(0, duration);
    wavesurferRef.current?.setTime(0);
  }, [duration, applyNewBounds]);

  const handleToggleMute = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    ws.setMuted(nextMute);
  }, [isMuted]);

  const handleZoomChange = useCallback(
    (nextZoom: number) => {
      const clamped = Math.max(1, Math.min(150, nextZoom));
      setZoomLevel(clamped);
      if (wavesurferRef.current && isWaveReady) {
        wavesurferRef.current.zoom(clamped);
      }
    },
    [isWaveReady]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isWaveReady) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlayRegion();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isWaveReady, handleTogglePlayRegion]);

  const handleExport = async () => {
    if (!audioFile || isExporting) return;
    setIsExporting(true);
    setExportProgress(0);
    setExportStage('loading-core');
    setExportSuccessMessage(null);
    setErrorMsg(null);

    if (wavesurferRef.current?.isPlaying()) {
      wavesurferRef.current.pause();
    }

    try {
      const result = await processAndTrimAudio({
        file: audioFile,
        startTime,
        endTime,
        fadeIn,
        fadeOut,
        fadeDuration: 1.5,
        outputFormat,
        onStatusChange: (stage) => setExportStage(stage),
        onProgress: (pct) => setExportProgress(pct),
      });

      triggerAudioDownload(result.blob, result.filename);
      setExportSuccessMessage(`${t.editor.exportSuccess} (${result.filename})`);
    } catch (err) {
      console.error('Audio export error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
      setExportStage(null);
    }
  };

  const clipDuration = Math.max(0, endTime - startTime);

  return (
    <div className="w-full">
      {/* Hidden HTML5 File Input with explicit ARIA label */}
      <input
        ref={fileInputRef}
        id="audio-file-upload-input"
        type="file"
        aria-label={t.dropzone.browseButton}
        accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelection(file);
          e.target.value = '';
        }}
      />

      {!audioFile ? (
        /* STEP 1: Minimalist File Ingestion Dropzone */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile) handleFileSelection(droppedFile);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={`${t.dropzone.title} — ${t.dropzone.subtitle}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`group relative cursor-pointer rounded-3xl border-2 border-dashed p-8 sm:p-14 text-center transition-all duration-200 ${
            isDraggingOver
              ? 'border-deep-burgundy bg-tan-beige/70 dark:bg-charcoal-elevated scale-[1.01]'
              : 'border-deep-burgundy/35 dark:border-slate-blue/35 bg-tan-beige/45 dark:bg-charcoal-surface hover:border-deep-burgundy dark:hover:border-slate-blue hover:bg-tan-beige/65 dark:hover:bg-charcoal-elevated/90'
          } shadow-minimal dark:shadow-minimal-dark`}
        >
          <div className="mx-auto flex max-w-md flex-col items-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-deep-burgundy text-cream-white shadow-md transition-transform duration-200 group-hover:scale-105">
              <Upload className="h-7 w-7" aria-hidden="true" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#231F20] dark:text-cream-white">
              {t.dropzone.title}
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-[#231F20]/70 dark:text-cream-white/70">
              {t.dropzone.subtitle}
            </p>

            {/* Primary Browse + Instant Demo Buttons */}
            <div
              className="mt-7 flex flex-wrap items-center justify-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label={t.dropzone.browseButton}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-deep-burgundy hover:bg-burgundy-hover px-6 py-3 text-sm font-semibold text-cream-white shadow-sm transition-all duration-150 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-burgundy focus-visible:ring-offset-2"
              >
                <FileAudio className="h-4 w-4" aria-hidden="true" />
                <span>{t.dropzone.browseButton}</span>
              </button>

              <button
                type="button"
                aria-label={t.dropzone.sampleButton}
                onClick={handleLoadDemo}
                className="inline-flex items-center gap-2 rounded-xl border border-deep-burgundy/30 dark:border-slate-blue/35 bg-cream-white dark:bg-charcoal px-4 py-3 text-sm font-semibold text-[#231F20] dark:text-cream-white hover:bg-tan-beige dark:hover:bg-charcoal-elevated transition-colors"
              >
                <Sparkles className="h-4 w-4 text-deep-burgundy dark:text-slate-blue" aria-hidden="true" />
                <span>{t.dropzone.sampleButton}</span>
              </button>
            </div>

            <p className="mt-6 text-xs font-medium text-[#231F20]/60 dark:text-cream-white/55">
              {t.dropzone.formats}
            </p>

            {errorMsg && (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-4 rounded-xl bg-deep-burgundy/10 dark:bg-deep-burgundy/25 px-4 py-2.5 text-xs font-semibold text-deep-burgundy dark:text-cream-white"
              >
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STEP 2: Full-Width Waveform Above + Horizontal Trim & Fade Control Bar Below */
        <div className="space-y-5">
          {/* Top File Metadata & Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-tan-beige dark:border-charcoal-border bg-tan-beige/55 dark:bg-charcoal-surface px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-deep-burgundy text-cream-white">
                <FileAudio className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#231F20] dark:text-cream-white">
                  {audioFile.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#231F20]/65 dark:text-cream-white/60 font-mono">
                  <span>{formatFileSize(audioFile.size)}</span>
                  <span aria-hidden="true">•</span>
                  <span>
                    {t.editor.totalLength}: {formatTimestamp(duration)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t.editor.replaceFile}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-deep-burgundy/25 dark:border-charcoal-border bg-cream-white dark:bg-charcoal px-3.5 py-2 text-xs font-semibold text-[#231F20] dark:text-cream-white hover:bg-tan-beige dark:hover:bg-charcoal-elevated transition-colors"
              >
                <Upload className="h-3.5 w-3.5 text-deep-burgundy dark:text-slate-blue" aria-hidden="true" />
                <span>{t.editor.replaceFile}</span>
              </button>
            </div>
          </div>

          {/* 1. FULL-WIDTH MAIN AUDIO CUTTER WAVEFORM CARD */}
          <div className="w-full flex flex-col rounded-3xl border border-tan-beige dark:border-charcoal-border bg-tan-beige/40 dark:bg-charcoal-surface p-4 sm:p-6 shadow-minimal dark:shadow-minimal-dark">
            {/* Waveform Status Header */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-cream-white dark:bg-charcoal px-3 py-1 font-semibold text-[#231F20] dark:text-cream-white border border-tan-beige dark:border-charcoal-border">
                  <span className="h-2 w-2 rounded-full bg-deep-burgundy animate-pulse" aria-hidden="true" />
                  {t.editor.currentCursor}: {formatTimestamp(currentTime)}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 dark:bg-amber-400/15 border border-deep-burgundy/30 px-3 py-1 text-[11px] font-bold text-deep-burgundy dark:text-amber-300">
                  {formatTimestamp(startTime)} → {formatTimestamp(endTime)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-deep-burgundy text-cream-white px-3 py-1 font-semibold">
                  {t.editor.selectionLength}: {formatTimestamp(clipDuration)}
                </span>
              </div>
            </div>

            {/* Expansive Full-Width Waveform Canvas Surface */}
            <div
              role="region"
              aria-label="Interactive Audio Waveform"
              className="relative w-full overflow-hidden rounded-2xl border border-tan-beige dark:border-charcoal-border bg-cream-white dark:bg-charcoal px-4 py-6"
            >
              {!isWaveReady && (
                <div
                  role="status"
                  aria-live="polite"
                  aria-label="Loading audio waveform"
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-cream-white/90 dark:bg-charcoal/90 backdrop-blur-xs"
                >
                  <Loader2 className="h-7 w-7 animate-spin text-deep-burgundy dark:text-slate-blue" aria-hidden="true" />
                </div>
              )}

              <div ref={waveformContainerRef} className="w-full select-none" />
            </div>

            <p className="mt-2.5 text-center text-xs text-[#231F20]/65 dark:text-cream-white/60">
              {t.editor.dragHint}
            </p>

            {/* Playback & Zoom Transport Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-tan-beige/80 dark:border-charcoal-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {/* Play / Pause Button */}
                <button
                  type="button"
                  onClick={handleTogglePlayRegion}
                  disabled={!isWaveReady}
                  aria-label={isPlaying ? t.editor.pause : t.editor.playRegion}
                  className="inline-flex items-center gap-2 rounded-xl bg-deep-burgundy hover:bg-burgundy-hover disabled:opacity-50 px-5 py-2.5 text-xs sm:text-sm font-semibold text-cream-white shadow-xs transition-all"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
                      <span>{t.editor.pause}</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                      <span>{t.editor.playRegion}</span>
                    </>
                  )}
                </button>

                {/* Replay from Selection Start */}
                <button
                  type="button"
                  onClick={handlePlayFromRegionStart}
                  disabled={!isWaveReady}
                  aria-label={`${t.editor.playRegion} (${formatTimestamp(startTime)})`}
                  title={t.editor.playRegion}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-tan-beige dark:border-charcoal-border bg-cream-white dark:bg-charcoal px-3.5 text-xs font-semibold text-[#231F20] dark:text-cream-white hover:bg-tan-beige dark:hover:bg-charcoal-elevated transition-colors"
                >
                  <Scissors className="h-3.5 w-3.5 text-deep-burgundy dark:text-slate-blue" aria-hidden="true" />
                  <span>{formatTimestamp(startTime)}</span>
                </button>

                {/* Loop Toggle */}
                <button
                  type="button"
                  onClick={() => setLoopRegion((prev) => !prev)}
                  aria-pressed={loopRegion}
                  aria-label={t.editor.loopRegion}
                  title={t.editor.loopRegion}
                  className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
                    loopRegion
                      ? 'border-deep-burgundy bg-deep-burgundy/12 dark:bg-deep-burgundy/30 text-deep-burgundy dark:text-cream-white'
                      : 'border-tan-beige dark:border-charcoal-border bg-cream-white dark:bg-charcoal text-[#231F20]/70 dark:text-cream-white/70'
                  }`}
                >
                  <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.editor.loopRegion}</span>
                </button>

                {/* Reset Trim Region */}
                <button
                  type="button"
                  onClick={handleResetRegion}
                  disabled={!isWaveReady}
                  aria-label={t.editor.resetRegion}
                  title={t.editor.resetRegion}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-tan-beige dark:border-charcoal-border bg-cream-white dark:bg-charcoal px-3.5 text-xs font-semibold text-[#231F20] dark:text-cream-white hover:bg-tan-beige dark:hover:bg-charcoal-elevated transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.editor.resetRegion}</span>
                </button>

                {/* Mute Toggle */}
                <button
                  type="button"
                  onClick={handleToggleMute}
                  disabled={!isWaveReady}
                  aria-pressed={isMuted}
                  aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-tan-beige dark:border-charcoal-border bg-cream-white dark:bg-charcoal text-[#231F20] dark:text-cream-white hover:bg-tan-beige dark:hover:bg-charcoal-elevated transition-colors"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4 text-deep-burgundy" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>

              {/* Zoom Slider */}
              <div className="flex items-center gap-2 rounded-xl border border-tan-beige dark:border-charcoal-border bg-cream-white dark:bg-charcoal px-3.5 py-1.5">
                <button
                  type="button"
                  onClick={() => handleZoomChange(zoomLevel - 15)}
                  className="text-[#231F20]/70 dark:text-cream-white/70 hover:text-deep-burgundy"
                  aria-label="Zoom Out Waveform"
                >
                  <ZoomOut className="h-4 w-4" aria-hidden="true" />
                </button>
                <input
                  type="range"
                  min={1}
                  max={150}
                  value={zoomLevel}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  aria-label={t.editor.zoom}
                  className="audio-zoom-slider w-28 sm:w-36"
                />
                <button
                  type="button"
                  onClick={() => handleZoomChange(zoomLevel + 15)}
                  className="text-[#231F20]/70 dark:text-cream-white/70 hover:text-deep-burgundy"
                  aria-label="Zoom In Waveform"
                >
                  <ZoomIn className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* 2. HORIZONTAL TRIM, FADE & EXPORT CONTROL PANEL BELOW WAVEFORM */}
          <div className="w-full rounded-3xl border border-tan-beige dark:border-charcoal-border bg-tan-beige/55 dark:bg-charcoal-surface p-5 sm:p-6 shadow-minimal dark:shadow-minimal-dark">
            <div className="mb-4 flex items-center justify-between border-b border-deep-burgundy/10 dark:border-charcoal-border pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-deep-burgundy dark:text-slate-blue" aria-hidden="true" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#231F20] dark:text-cream-white">
                  Trim & Fade Controls
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-deep-burgundy dark:text-slate-blue">
                {t.editor.selectionLength}: {clipDuration.toFixed(2)}s
              </span>
            </div>

            {/* 4-Column Horizontal Control Bar on Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-stretch">
              {/* Column 1 (3 cols): Cut From (Start) */}
              <div className="lg:col-span-3 flex flex-col justify-between rounded-2xl border border-tan-beige dark:border-charcoal-border bg-cream-white dark:bg-charcoal p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="cut-from-input"
                    className="text-xs font-bold text-[#231F20]/80 dark:text-cream-white/80"
                  >
                    {t.editor.cutFrom}
                  </label>
                  <button
                    type="button"
                    aria-label={`${t.editor.cutFrom}: ${t.editor.setAtCursor}`}
                    onClick={() => applyNewBounds(currentTime, endTime)}
                    className="text-[11px] font-semibold text-deep-burgundy dark:text-slate-blue hover:underline"
                  >
                    {t.editor.setAtCursor}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyNewBounds(startTime - 0.1, endTime)}
                    aria-label={`${t.editor.cutFrom} ${t.editor.fineTuneMinus}`}
                    title={t.editor.fineTuneMinus}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-tan-beige dark:border-charcoal-border bg-tan-beige/40 dark:bg-charcoal-surface font-mono text-xs font-bold hover:bg-tan-beige dark:hover:bg-charcoal-elevated"
                  >
                    -0.1
                  </button>
                  <input
                    id="cut-from-input"
                    type="text"
                    aria-label={t.editor.cutFrom}
                    value={startInput}
                    onChange={(e) => setStartInput(e.target.value)}
                    onBlur={() => {
                      const parsed = parseTimestampInput(startInput, startTime);
                      applyNewBounds(parsed, endTime);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const parsed = parseTimestampInput(startInput, startTime);
                        applyNewBounds(parsed, endTime);
                      }
                    }}
                    className="h-10 w-full rounded-xl border border-tan-beige dark:border-charcoal-border bg-tan-beige/25 dark:bg-charcoal-surface px-2.5 text-center font-mono text-sm font-bold text-[#231F20] dark:text-cream-white focus:border-deep-burgundy focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => applyNewBounds(startTime + 0.1, endTime)}
                    aria-label={`${t.editor.cutFrom} ${t.editor.fineTunePlus}`}
                    title={t.editor.fineTunePlus}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-tan-beige dark:border-charcoal-border bg-tan-beige/40 dark:bg-charcoal-surface font-mono text-xs font-bold hover:bg-tan-beige dark:hover:bg-charcoal-elevated"
                  >
                    +0.1
                  </button>
                </div>
              </div>

              {/* Column 2 (3 cols): To (End) */}
              <div className="lg:col-span-3 flex flex-col justify-between rounded-2xl border border-tan-beige dark:border-charcoal-border bg-cream-white dark:bg-charcoal p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="cut-to-input"
                    className="text-xs font-bold text-[#231F20]/80 dark:text-cream-white/80"
                  >
                    {t.editor.cutTo}
                  </label>
                  <button
                    type="button"
                    aria-label={`${t.editor.cutTo}: ${t.editor.setAtCursor}`}
                    onClick={() => applyNewBounds(startTime, currentTime)}
                    className="text-[11px] font-semibold text-deep-burgundy dark:text-slate-blue hover:underline"
                  >
                    {t.editor.setAtCursor}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyNewBounds(startTime, endTime - 0.1)}
                    aria-label={`${t.editor.cutTo} ${t.editor.fineTuneMinus}`}
                    title={t.editor.fineTuneMinus}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-tan-beige dark:border-charcoal-border bg-tan-beige/40 dark:bg-charcoal-surface font-mono text-xs font-bold hover:bg-tan-beige dark:hover:bg-charcoal-elevated"
                  >
                    -0.1
                  </button>
                  <input
                    id="cut-to-input"
                    type="text"
                    aria-label={t.editor.cutTo}
                    value={endInput}
                    onChange={(e) => setEndInput(e.target.value)}
                    onBlur={() => {
                      const parsed = parseTimestampInput(endInput, endTime);
                      applyNewBounds(startTime, parsed);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const parsed = parseTimestampInput(endInput, endTime);
                        applyNewBounds(startTime, parsed);
                      }
                    }}
                    className="h-10 w-full rounded-xl border border-tan-beige dark:border-charcoal-border bg-tan-beige/25 dark:bg-charcoal-surface px-2.5 text-center font-mono text-sm font-bold text-[#231F20] dark:text-cream-white focus:border-deep-burgundy focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => applyNewBounds(startTime, endTime + 0.1)}
                    aria-label={`${t.editor.cutTo} ${t.editor.fineTunePlus}`}
                    title={t.editor.fineTunePlus}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-tan-beige dark:border-charcoal-border bg-tan-beige/40 dark:bg-charcoal-surface font-mono text-xs font-bold hover:bg-tan-beige dark:hover:bg-charcoal-elevated"
                  >
                    +0.1
                  </button>
                </div>
              </div>

              {/* Column 3 (3 cols): Fade In & Fade Out Toggles */}
              <div className="lg:col-span-3 flex flex-col justify-center gap-2 rounded-2xl border border-tan-beige dark:border-charcoal-border bg-cream-white dark:bg-charcoal p-3.5">
                <label className="flex cursor-pointer items-center justify-between rounded-lg px-1.5 py-1 hover:bg-tan-beige/35 dark:hover:bg-charcoal-surface transition-colors">
                  <div>
                    <span className="block text-xs font-bold text-[#231F20] dark:text-cream-white">
                      {t.editor.fadeIn}
                    </span>
                    <span className="text-[10px] text-[#231F20]/60 dark:text-cream-white/55">
                      {t.editor.fadeSeconds}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    aria-label={t.editor.fadeIn}
                    checked={fadeIn}
                    onChange={(e) => setFadeIn(e.target.checked)}
                    className="h-4 w-4 rounded border-tan-beige accent-deep-burgundy cursor-pointer"
                  />
                </label>

                <div className="h-px bg-tan-beige/60 dark:bg-charcoal-border" aria-hidden="true" />

                <label className="flex cursor-pointer items-center justify-between rounded-lg px-1.5 py-1 hover:bg-tan-beige/35 dark:hover:bg-charcoal-surface transition-colors">
                  <div>
                    <span className="block text-xs font-bold text-[#231F20] dark:text-cream-white">
                      {t.editor.fadeOut}
                    </span>
                    <span className="text-[10px] text-[#231F20]/60 dark:text-cream-white/55">
                      {t.editor.fadeSeconds}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    aria-label={t.editor.fadeOut}
                    checked={fadeOut}
                    onChange={(e) => setFadeOut(e.target.checked)}
                    className="h-4 w-4 rounded border-tan-beige accent-deep-burgundy cursor-pointer"
                  />
                </label>
              </div>

              {/* Column 4 (3 cols): Export Format + Export CTA Button */}
              <div className="lg:col-span-3 flex flex-col justify-between gap-2.5">
                <div
                  role="group"
                  aria-label={t.editor.outputFormat}
                  className="flex items-center justify-between rounded-2xl border border-tan-beige dark:border-charcoal-border bg-cream-white dark:bg-charcoal px-3.5 py-2"
                >
                  <span className="text-xs font-bold text-[#231F20] dark:text-cream-white">
                    {t.editor.outputFormat}
                  </span>
                  <div className="inline-flex rounded-xl bg-tan-beige/55 dark:bg-charcoal-surface p-0.5">
                    {(['mp3', 'wav'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        aria-pressed={outputFormat === fmt}
                        aria-label={`${t.editor.outputFormat}: ${fmt.toUpperCase()}`}
                        onClick={() => setOutputFormat(fmt)}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold uppercase transition-colors ${
                          outputFormat === fmt
                            ? 'bg-deep-burgundy text-cream-white shadow-xs'
                            : 'text-[#231F20]/75 dark:text-cream-white/75 hover:text-[#231F20] dark:hover:text-cream-white'
                        }`}
                      >
                        .{fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={t.editor.exportButton}
                  onClick={handleExport}
                  disabled={!isWaveReady || isExporting}
                  className="flex flex-1 min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl bg-deep-burgundy hover:bg-burgundy-hover disabled:opacity-60 px-5 py-3 text-sm sm:text-base font-bold text-cream-white shadow-md transition-all duration-150 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-burgundy focus-visible:ring-offset-2"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span className="truncate text-xs sm:text-sm">
                        {exportStage === 'loading-core'
                          ? t.editor.loadingFfmpeg
                          : `${t.editor.encodingProgress} (${exportProgress}%)`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" aria-hidden="true" />
                      <span>{t.editor.exportButton}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {exportSuccessMessage && (
              <div
                role="status"
                aria-live="polite"
                className="mt-4 flex items-center gap-2 rounded-xl bg-deep-burgundy/10 dark:bg-slate-blue/15 px-4 py-3 text-xs font-semibold text-deep-burgundy dark:text-slate-blue"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="break-all">{exportSuccessMessage}</span>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                aria-live="assertive"
                className="mt-4 rounded-xl bg-deep-burgundy/15 px-4 py-3 text-xs font-semibold text-deep-burgundy dark:text-cream-white"
              >
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
