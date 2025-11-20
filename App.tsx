
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileUploader } from './components/FileUploader';
import { Icon } from './components/Icon';
import { VideoSource, AudioSource, CropArea, VideoClip } from './types';
import { logAction, CATEGORIES, ACTIONS } from './actions';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 450;

const VIDEO_FILTERS = [
  { name: 'None', value: 'none' },
  { name: 'Grayscale', value: 'grayscale(100%)' },
  { name: 'Sepia', value: 'sepia(100%)' },
  { name: 'Invert', value: 'invert(100%)' },
  { name: 'Blur', value: 'blur(4px)' },
  { name: 'Brightness', value: 'brightness(1.2)' },
  { name: 'Contrast', value: 'contrast(1.5)' },
  { name: 'Hue Rotate', value: 'hue-rotate(90deg)' },
];

export default function App() {
  // --- State ---
  
  // Main Track is now a Playlist
  const [playlist, setPlaylist] = useState<VideoClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const [overlayVideo, setOverlayVideo] = useState<VideoSource | null>(null);
  const [audioTrack, setAudioTrack] = useState<AudioSource | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Global editing params (Canvas level)
  const [enableCrop, setEnableCrop] = useState(false);
  const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  const [activeFilter, setActiveFilter] = useState<string>('none');
  
  // Overlay configuration
  const [overlayConfig, setOverlayConfig] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const [mainVol, setMainVol] = useState(1);
  const [overlayVol, setOverlayVol] = useState(1);
  const [extAudioVol, setExtAudioVol] = useState(1);

  // Timeline State
  const [isScrubbing, setIsScrubbing] = useState(false);
  const wasPlayingRef = useRef(false);

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // We use a Map to store refs to multiple video elements for the playlist
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  
  const overlayVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  
  // Source nodes need to be dynamic or pooled. For simplicity, we'll create them on demand or store in map
  const sourceNodesRef = useRef<Map<string, MediaElementAudioSourceNode>>(new Map());
  const overlaySourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const extAudioSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const mainGainRef = useRef<GainNode | null>(null);
  const overlayGainRef = useRef<GainNode | null>(null);
  const extAudioGainRef = useRef<GainNode | null>(null);
  
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // --- Computed ---

  // Calculate total project duration based on trimmed clips
  const totalDuration = useMemo(() => {
      return playlist.reduce((acc, clip) => acc + (clip.trimEnd - clip.trimStart), 0);
  }, [playlist]);

  const activeClip = useMemo(() => {
      return playlist.find(c => c.id === selectedClipId) || playlist[0] || null;
  }, [playlist, selectedClipId]);

  // --- Helpers ---
  const safeSetCurrentTime = (element: HTMLMediaElement | null, time: number) => {
    if (element && Number.isFinite(time)) {
        // Clamp to safe ranges to avoid seeking errors
        const t = Math.max(0, Math.min(time, element.duration || 0));
        element.currentTime = t;
    }
  };

  const assignVideoRef = (element: HTMLVideoElement | null, id: string) => {
      if (element) videoRefs.current.set(id, element);
      else videoRefs.current.delete(id);
  };

  // --- Initialization ---

  useEffect(() => {
      logAction(CATEGORIES.PROJECT, ACTIONS.APP_OPENED);
  }, []);

  const initAudioContext = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctx();
      destNodeRef.current = audioCtxRef.current.createMediaStreamDestination();
      
      // Global Gains
      mainGainRef.current = audioCtxRef.current.createGain();
      overlayGainRef.current = audioCtxRef.current.createGain();
      extAudioGainRef.current = audioCtxRef.current.createGain();

      mainGainRef.current.connect(destNodeRef.current);
      mainGainRef.current.connect(audioCtxRef.current.destination);
      
      overlayGainRef.current.connect(destNodeRef.current);
      overlayGainRef.current.connect(audioCtxRef.current.destination);
      
      extAudioGainRef.current.connect(destNodeRef.current);
      extAudioGainRef.current.connect(audioCtxRef.current.destination);
    }
    return { ctx: audioCtxRef.current, dest: destNodeRef.current! };
  };

  const connectAudioNode = (
      element: HTMLMediaElement, 
      id: string, 
      targetGain: GainNode, 
      ctx: AudioContext
  ) => {
      // For playlist items, we map ID -> SourceNode
      if (!sourceNodesRef.current.has(id)) {
          const source = ctx.createMediaElementSource(element);
          source.connect(targetGain);
          sourceNodesRef.current.set(id, source);
      }
  };

  useEffect(() => {
    if (mainGainRef.current) mainGainRef.current.gain.value = mainVol;
    if (overlayGainRef.current) overlayGainRef.current.gain.value = overlayVol;
    if (extAudioGainRef.current) extAudioGainRef.current.gain.value = extAudioVol;
  }, [mainVol, overlayVol, extAudioVol]);


  // --- File Handling ---

  const addClip = (file: File) => {
    logAction(CATEGORIES.PLAYLIST, ACTIONS.ADD_CLIP, { name: file.name, size: file.size });
    const url = URL.createObjectURL(file);
    const id = Date.now().toString();
    // Create a temporary video to get duration
    const tempVid = document.createElement('video');
    tempVid.src = url;
    tempVid.onloadedmetadata = () => {
        const duration = Number.isFinite(tempVid.duration) ? tempVid.duration : 0;
        const newClip: VideoClip = {
            id,
            url,
            file,
            duration,
            trimStart: 0,
            trimEnd: duration
        };
        
        setPlaylist(prev => {
            const newVal = [...prev, newClip];
            // If this is the first clip, set crop defaults based on it? 
            // For now we keep crop generic or manual.
            return newVal;
        });

        if (playlist.length === 0) {
            setSelectedClipId(id);
            logAction(CATEGORIES.PLAYLIST, ACTIONS.SELECT_CLIP, { id });
        }
    };
  };

  const removeClip = (id: string) => {
      logAction(CATEGORIES.PLAYLIST, ACTIONS.REMOVE_CLIP, { id });
      setPlaylist(prev => prev.filter(c => c.id !== id));
      if (selectedClipId === id) setSelectedClipId(null);
  };

  const handleOverlayVideo = (file: File) => {
    logAction(CATEGORIES.LAYERS, ACTIONS.ADD_OVERLAY, { name: file.name });
    const url = URL.createObjectURL(file);
    setOverlayVideo({ id: 'overlay', url, file, duration: 0 });
    if (overlayVideoRef.current) {
        overlayVideoRef.current.src = url;
        overlayVideoRef.current.onloadedmetadata = () => {
            const v = overlayVideoRef.current;
            if (!v) return;
            const w = CANVAS_WIDTH * 0.3;
            const h = (v.videoHeight / v.videoWidth) * w;
            setOverlayConfig({
                x: CANVAS_WIDTH - w - 20,
                y: 20,
                width: w,
                height: h
            });
        };
    }
  };

  const handleAudioTrack = (file: File) => {
    logAction(CATEGORIES.AUDIO, ACTIONS.ADD_AUDIO, { name: file.name });
    const url = URL.createObjectURL(file);
    setAudioTrack({ id: 'audio', url, file });
    if (audioRef.current) audioRef.current.src = url;
  };

  // --- Canvas & Playback Loop ---

  const getActiveClipAtTime = (globalTime: number) => {
      let elapsed = 0;
      for (const clip of playlist) {
          const clipDuration = clip.trimEnd - clip.trimStart;
          if (globalTime < elapsed + clipDuration) {
              return { clip, offset: globalTime - elapsed };
          }
          elapsed += clipDuration;
      }
      // If past end, return last clip roughly
      return null;
  };

  const draw = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Determine which clip to play/draw based on current time logic
    // We need to derive "Current Global Time".
    // If playing, we can trust the active video's time + offset?
    // It is safer to find the active clip, check its video element time, and calculate global time back.
    
    let currentGlobalTime = currentTime; // Default to state
    let activeVidElement: HTMLVideoElement | null = null;

    // Find active clip info from playlist based on state currentTime
    // (This is prediction for drawing. The actual playback logic handles switching)
    let timeWalker = 0;
    let currentClipData: { clip: VideoClip, startTime: number } | null = null;

    for (const clip of playlist) {
        const dur = clip.trimEnd - clip.trimStart;
        if (currentTime >= timeWalker && currentTime < timeWalker + dur) {
            currentClipData = { clip, startTime: timeWalker };
            break;
        }
        timeWalker += dur;
    }
    
    // If we are effectively at the end or rounding error
    if (!currentClipData && playlist.length > 0 && currentTime >= totalDuration - 0.1) {
        // Show last frame of last clip
        const last = playlist[playlist.length - 1];
        currentClipData = { clip: last, startTime: totalDuration - (last.trimEnd - last.trimStart) };
    }


    if (currentClipData) {
        const { clip, startTime } = currentClipData;
        const vid = videoRefs.current.get(clip.id);
        
        if (vid && vid.readyState >= 2) {
            activeVidElement = vid;
            
            // Update global time from video actual time if playing (sync source)
            // But only if we are not scrubbing.
            if (isPlaying && !isScrubbing) {
                 const actualTimeInClip = vid.currentTime;
                 // Correct global time
                 const calculatedGlobal = startTime + (actualTimeInClip - clip.trimStart);
                 
                 // Auto-Switch Logic
                 if (actualTimeInClip >= clip.trimEnd) {
                     // Check if there is a next clip
                     const idx = playlist.findIndex(c => c.id === clip.id);
                     if (idx < playlist.length - 1) {
                         const nextClip = playlist[idx + 1];
                         // Switch!
                         vid.pause();
                         const nextVid = videoRefs.current.get(nextClip.id);
                         if (nextVid) {
                             safeSetCurrentTime(nextVid, nextClip.trimStart);
                             safePlay(nextVid);
                         }
                         // We update currentTime to start of next
                         currentGlobalTime = startTime + (clip.trimEnd - clip.trimStart) + 0.01;
                     } else {
                         // End of timeline
                         pauseAll();
                         currentGlobalTime = totalDuration;
                     }
                 } else {
                     currentGlobalTime = calculatedGlobal;
                 }
                 setCurrentTime(currentGlobalTime);
            }

            // DRAW
            ctx.filter = activeFilter;
            if (enableCrop) {
                const scaleX = vid.videoWidth / CANVAS_WIDTH;
                const scaleY = vid.videoHeight / CANVAS_HEIGHT;
                ctx.drawImage(
                    vid, 
                    crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 
                    0, 0, CANVAS_WIDTH, CANVAS_HEIGHT
                );
            } else {
                ctx.drawImage(vid, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            }
            ctx.filter = 'none';
        }
    } else if (playlist.length === 0) {
        // No video
    }


    // 2. Draw Overlay
    const ovV = overlayVideoRef.current;
    if (ovV && ovV.readyState >= 2 && overlayConfig.width > 0) {
         ctx.strokeStyle = 'white';
         ctx.lineWidth = 2;
         ctx.strokeRect(overlayConfig.x, overlayConfig.y, overlayConfig.width, overlayConfig.height);
         ctx.drawImage(ovV, overlayConfig.x, overlayConfig.y, overlayConfig.width, overlayConfig.height);
    }
    
    // Auto-stop recording if at end
    if (isRecording && currentGlobalTime >= totalDuration) {
        stopRecording();
    }

    animationFrameRef.current = requestAnimationFrame(draw);
  }, [enableCrop, crop, isRecording, isPlaying, totalDuration, playlist, isScrubbing, overlayConfig, activeFilter, currentTime]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(draw);
    return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  }, [draw]);


  // --- Controls ---

  const safePlay = async (element: HTMLMediaElement | null) => {
    if (!element) return;
    try {
      await element.play();
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error('Playback failed', err);
    }
  };

  const playAll = async () => {
    const { ctx } = initAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    
    // Connect ALL playlist clips to audio
    if (mainGainRef.current) {
        playlist.forEach(clip => {
            const vid = videoRefs.current.get(clip.id);
            if (vid) connectAudioNode(vid, clip.id, mainGainRef.current!, ctx);
        });
    }

    // Connect Overlay
    if (overlayVideoRef.current && overlayGainRef.current) {
        if (!overlaySourceNodeRef.current) {
            const s = ctx.createMediaElementSource(overlayVideoRef.current);
            s.connect(overlayGainRef.current);
            overlaySourceNodeRef.current = s;
        }
    }

    // Connect Audio
    if (audioRef.current && extAudioGainRef.current) {
        if (!extAudioSourceNodeRef.current) {
             const s = ctx.createMediaElementSource(audioRef.current);
             s.connect(extAudioGainRef.current);
             extAudioSourceNodeRef.current = s;
        }
    }

    // Sync Logic
    // Find which clip should be playing at currentTime
    let timeWalker = 0;
    let activeVid: HTMLVideoElement | null = null;
    
    for (const clip of playlist) {
        const dur = clip.trimEnd - clip.trimStart;
        if (currentTime >= timeWalker && currentTime < timeWalker + dur) {
            const offset = currentTime - timeWalker;
            const vid = videoRefs.current.get(clip.id);
            if (vid) {
                safeSetCurrentTime(vid, clip.trimStart + offset);
                activeVid = vid;
            }
            break;
        }
        timeWalker += dur;
    }

    // If no active vid found (end of timeline), restart first
    if (!activeVid && playlist.length > 0) {
        const first = playlist[0];
        const vid = videoRefs.current.get(first.id);
        if (vid) {
            safeSetCurrentTime(vid, first.trimStart);
            activeVid = vid;
            setCurrentTime(0);
            // Also reset others
        }
    }

    // Sync Overlay & Audio
    if (overlayVideoRef.current) {
        const t = currentTime % (overlayVideoRef.current.duration || 1);
        safeSetCurrentTime(overlayVideoRef.current, t);
        safePlay(overlayVideoRef.current);
    }
    if (audioRef.current) {
        safeSetCurrentTime(audioRef.current, currentTime);
        safePlay(audioRef.current);
    }

    // Play the active clip
    if (activeVid) safePlay(activeVid);
    setIsPlaying(true);
  };

  const pauseAll = () => {
    playlist.forEach(clip => {
        videoRefs.current.get(clip.id)?.pause();
    });
    overlayVideoRef.current?.pause();
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
        logAction(CATEGORIES.PLAYBACK, ACTIONS.PAUSE, { at: currentTime });
        pauseAll();
    } else {
        logAction(CATEGORIES.PLAYBACK, ACTIONS.PLAY, { at: currentTime });
        if (currentTime >= totalDuration - 0.1) {
            seek(0);
        }
        playAll();
    }
  };

  const seek = (time: number) => {
    if (!Number.isFinite(time)) return;
    const clamped = Math.max(0, Math.min(time, totalDuration));
    setCurrentTime(clamped);

    // Update all video elements to correct state
    let timeWalker = 0;
    playlist.forEach(clip => {
        const vid = videoRefs.current.get(clip.id);
        if (!vid) return;
        const dur = clip.trimEnd - clip.trimStart;
        
        // If this clip is the one active at 'time'
        if (time >= timeWalker && time < timeWalker + dur) {
            const offset = time - timeWalker;
            safeSetCurrentTime(vid, clip.trimStart + offset);
            // If we are currently "playing", this one should play? 
            // Usually seek pauses or continues playing. If playing, we might need to ensure this one plays and others pause.
            // But simpler to let playAll handle it if we call it, or just set Time.
        } else {
            // Reset others to start or keep them paused
            vid.pause();
            safeSetCurrentTime(vid, clip.trimStart); 
        }
        timeWalker += dur;
    });

    // Sync extras
    if (overlayVideoRef.current) {
        const d = overlayVideoRef.current.duration || 1;
        safeSetCurrentTime(overlayVideoRef.current, time % d);
    }
    if (audioRef.current) {
        safeSetCurrentTime(audioRef.current, time);
    }
  };

  const handleTrimChange = (type: 'start' | 'end', val: number) => {
      if (!selectedClipId) return;
      logAction(CATEGORIES.EDITING, type === 'start' ? ACTIONS.TRIM_START : ACTIONS.TRIM_END, { clipId: selectedClipId, value: val });
      
      setPlaylist(prev => prev.map(clip => {
          if (clip.id !== selectedClipId) return clip;
          
          let newStart = clip.trimStart;
          let newEnd = clip.trimEnd;

          if (type === 'start') {
              newStart = Math.max(0, Math.min(val, newEnd - 0.5)); // Min 0.5s duration
          } else {
              newEnd = Math.min(clip.duration, Math.max(val, newStart + 0.5));
          }
          return { ...clip, trimStart: newStart, trimEnd: newEnd };
      }));
  };

  // --- Timeline Interaction ---
  
  const handleTimelineMouseDown = (e: React.MouseEvent) => {
      if (!timelineRef.current || totalDuration === 0) return;
      logAction(CATEGORIES.PLAYBACK, ACTIONS.SCRUB);
      setIsScrubbing(true);
      wasPlayingRef.current = isPlaying;
      pauseAll();

      calculateScrub(e.clientX);
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handleWindowMouseMove = useCallback((e: MouseEvent) => {
      calculateScrub(e.clientX);
  }, [totalDuration]); 

  const handleWindowMouseUp = useCallback(() => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      if (wasPlayingRef.current) playAll();
  }, [handleWindowMouseMove]); 

  const calculateScrub = (clientX: number) => {
      if (!timelineRef.current || totalDuration === 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, x / rect.width));
      const newTime = ratio * totalDuration;
      seek(newTime);
  };
  
  // --- Recording ---
  // (Simplified for playlist: just record canvas stream)

  const startRecording = async () => {
    logAction(CATEGORIES.EXPORT, ACTIONS.START_RECORDING);
    if (!canvasRef.current) return;
    const { ctx, dest } = initAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    
    // Ensure all connected
    if (mainGainRef.current) {
        playlist.forEach(clip => {
            const vid = videoRefs.current.get(clip.id);
            if (vid) connectAudioNode(vid, clip.id, mainGainRef.current!, ctx);
        });
    }
    // ... (re-connect others similar to playAll) ...
    // For brevity, assuming playAll logic handles connection on playback start, 
    // but for recording we force a play.

    seek(0);

    const canvasStream = canvasRef.current.captureStream(30);
    const finalStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
    ]);

    const options = { mimeType: 'video/webm; codecs=vp9' };
    try {
        recorderRef.current = new MediaRecorder(finalStream, MediaRecorder.isTypeSupported(options.mimeType) ? options : { mimeType: 'video/webm' });
    } catch (e) {
        alert("MediaRecorder not supported.");
        return;
    }

    chunksRef.current = [];
    recorderRef.current.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edited-video-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setIsRecording(false);
        pauseAll();
        logAction(CATEGORIES.EXPORT, ACTIONS.EXPORT_COMPLETE, { size: blob.size });
    };

    setIsRecording(true);
    recorderRef.current.start();
    playAll();
  };

  const stopRecording = () => {
    logAction(CATEGORIES.EXPORT, ACTIONS.STOP_RECORDING);
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
  };

  // --- Drag Interactions ---
  const stageRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<'none' | 'crop-move' | 'crop-resize' | 'overlay-move'>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialCrop, setInitialCrop] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 });
  const [initialOverlayPos, setInitialOverlayPos] = useState({ x: 0, y: 0 });

  const startDrag = (e: React.MouseEvent, mode: typeof dragMode) => {
      e.preventDefault(); e.stopPropagation();
      setDragMode(mode);
      setDragStart({ x: e.clientX, y: e.clientY });
      if (mode.startsWith('crop')) {
          logAction(CATEGORIES.EDITING, mode === 'crop-move' ? ACTIONS.CROP_MOVE : ACTIONS.CROP_RESIZE);
          setInitialCrop(crop);
      }
      else if (mode.startsWith('overlay')) {
          logAction(CATEGORIES.LAYERS, ACTIONS.MOVE_OVERLAY);
          setInitialOverlayPos({ x: overlayConfig.x, y: overlayConfig.y });
      }
  };

  const handleStageInteract = (e: React.MouseEvent) => {
      if (dragMode === 'none' || !stageRef.current) return;
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      if (dragMode === 'crop-move') {
          setCrop(prev => ({ 
              ...prev, 
              x: Math.max(0, Math.min(initialCrop.x + deltaX, CANVAS_WIDTH - initialCrop.width)), 
              y: Math.max(0, Math.min(initialCrop.y + deltaY, CANVAS_HEIGHT - initialCrop.height)) 
          }));
      } else if (dragMode === 'crop-resize') {
          let newW = Math.max(50, initialCrop.width + deltaX);
          let newH = Math.max(50, initialCrop.height + deltaY);
          if (initialCrop.x + newW > CANVAS_WIDTH) newW = CANVAS_WIDTH - initialCrop.x;
          if (initialCrop.y + newH > CANVAS_HEIGHT) newH = CANVAS_HEIGHT - initialCrop.y;
          setCrop(prev => ({ ...prev, width: newW, height: newH }));
      } else if (dragMode === 'overlay-move') {
           setOverlayConfig(prev => ({ 
               ...prev, 
               x: Math.max(0, Math.min(initialOverlayPos.x + deltaX, CANVAS_WIDTH - overlayConfig.width)), 
               y: Math.max(0, Math.min(initialOverlayPos.y + deltaY, CANVAS_HEIGHT - overlayConfig.height)) 
           }));
      }
  };

  const handleFilterChange = (filter: string) => {
      setActiveFilter(filter);
      logAction(CATEGORIES.EFFECTS, ACTIONS.APPLY_FILTER, { filter });
  };

  return (
    <div 
        className="min-h-screen bg-gray-950 flex flex-col" 
        onMouseUp={() => setDragMode('none')} 
        onMouseMove={handleStageInteract}
    >
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded text-white"><Icon icon="Layers" /></div>
            <h1 className="text-xl font-bold tracking-tight text-white">WebM <span className="text-blue-500">Studio</span></h1>
        </div>
        <button 
            onClick={isRecording ? stopRecording : startRecording}
            disabled={playlist.length === 0}
            className={`
                flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-colors
                ${isRecording 
                    ? 'bg-red-600 animate-pulse hover:bg-red-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'}
            `}
        >
            {isRecording ? "Stop Recording" : "Export WebM"}
        </button>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-80 bg-gray-900 border-r border-gray-800 p-5 flex flex-col gap-6 overflow-y-auto z-10 shadow-xl">
            
            {/* Playlist Section */}
            <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Main Track Playlist</h3>
                <div className="space-y-2 mb-4">
                    {playlist.map((clip, idx) => (
                        <div 
                            key={clip.id}
                            onClick={() => { setSelectedClipId(clip.id); logAction(CATEGORIES.PLAYLIST, ACTIONS.SELECT_CLIP, { id: clip.id }); }}
                            className={`
                                flex items-center justify-between p-2 rounded border cursor-pointer
                                ${selectedClipId === clip.id ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}
                            `}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-xs font-mono text-gray-500">{idx + 1}</span>
                                <span className="text-sm truncate max-w-[120px]">{clip.file.name}</span>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeClip(clip.id); }}
                                className="text-gray-500 hover:text-red-400"
                            >
                                <Icon icon="Trash" size={14} />
                            </button>
                        </div>
                    ))}
                    {playlist.length === 0 && <p className="text-sm text-gray-600 italic">No clips added.</p>}
                </div>
                <FileUploader 
                    label="Add Video Clip" 
                    accept="video/*" 
                    icon="Upload" 
                    onFileSelect={addClip}
                />
            </section>

            <hr className="border-gray-800" />

            {/* Other Assets */}
            <section>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Layers</h3>
                <div className="flex flex-col gap-3">
                    <FileUploader 
                        label={overlayVideo ? "Replace Overlay" : "Add Overlay Video"} 
                        accept="video/*" 
                        icon="Layers" 
                        onFileSelect={handleOverlayVideo}
                        disabled={playlist.length === 0}
                    />
                    <FileUploader 
                        label={audioTrack ? "Replace Audio Track" : "Add Audio Track"} 
                        accept="audio/*" 
                        icon="Volume2" 
                        onFileSelect={handleAudioTrack}
                        disabled={playlist.length === 0}
                    />
                </div>
            </section>

            {/* Video Effects */}
            {playlist.length > 0 && (
                <section>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Video Effects</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {VIDEO_FILTERS.map(filter => (
                            <button
                                key={filter.value}
                                onClick={() => handleFilterChange(filter.value)}
                                className={`
                                    px-2 py-2 text-xs rounded-md border transition-all
                                    ${activeFilter === filter.value 
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg' 
                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}
                                `}
                            >
                                {filter.name}
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Tools */}
            {playlist.length > 0 && (
                <section>
                    <button 
                        onClick={() => { 
                            const newState = !enableCrop;
                            setEnableCrop(newState);
                            logAction(CATEGORIES.EDITING, newState ? ACTIONS.CROP_ENABLE : ACTIONS.CROP_DISABLE);
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${enableCrop ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                    >
                        <span className="flex items-center gap-2"><Icon icon="Crop" size={18} /> Crop Canvas</span>
                        <div className={`w-3 h-3 rounded-full ${enableCrop ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                    </button>
                </section>
            )}
        </aside>

        {/* Center Stage */}
        <section className="flex-1 bg-gray-950 flex flex-col items-center justify-center relative p-8 overflow-hidden">
             
             {/* Canvas */}
             <div 
                className="relative shadow-2xl select-none" 
                ref={stageRef} 
                style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
            >
                 <canvas 
                    ref={canvasRef} 
                    width={CANVAS_WIDTH} 
                    height={CANVAS_HEIGHT}
                    className="bg-black rounded-lg shadow-2xl"
                 />
                 
                 {/* Crop UI */}
                 {enableCrop && (
                     <div 
                        className="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move group"
                        style={{ left: crop.x, top: crop.y, width: crop.width, height: crop.height }}
                        onMouseDown={(e) => startDrag(e, 'crop-move')}
                     >
                        <div 
                            className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 cursor-nwse-resize flex items-center justify-center z-50"
                            onMouseDown={(e) => startDrag(e, 'crop-resize')}
                        />
                     </div>
                 )}
                 
                 {/* Overlay UI */}
                 {overlayVideo && !enableCrop && (
                     <div 
                        className="absolute border-2 border-white/50 hover:border-white hover:bg-white/5 cursor-move"
                        style={{ left: overlayConfig.x, top: overlayConfig.y, width: overlayConfig.width, height: overlayConfig.height }}
                        onMouseDown={(e) => startDrag(e, 'overlay-move')}
                     />
                 )}

                 {playlist.length === 0 && (
                     <div className="absolute inset-0 flex items-center justify-center flex-col text-gray-600 pointer-events-none">
                         <Icon icon="Upload" size={48} className="mb-4 opacity-50" />
                         <p>Add clips to start editing</p>
                     </div>
                 )}
             </div>

             {/* Timeline */}
             {playlist.length > 0 && (
                 <div className="w-[800px] mt-6 bg-gray-900 p-4 rounded-xl border border-gray-800">
                    
                    {/* Ruler */}
                    <div className="flex items-center text-xs text-gray-500 font-mono mb-1 pl-24">
                        <span className="flex-1">00:00</span>
                        <span className="text-center flex-1">{totalDuration > 0 ? (totalDuration / 2).toFixed(1) : '--'}s</span>
                        <span className="text-right flex-1">{totalDuration.toFixed(1)}s</span>
                    </div>

                    {/* Tracks */}
                    <div className="relative select-none cursor-pointer" onMouseDown={handleTimelineMouseDown}>
                        {/* Playhead */}
                        <div 
                            className="absolute top-0 bottom-0 z-40 pointer-events-none"
                            style={{ left: `calc(6rem + ${totalDuration > 0 ? (currentTime / totalDuration) * (100 - 12.5) : 0}%)` }}
                        >
                            <div className="w-0.5 h-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]"></div>
                            <div className="absolute -top-2 -translate-x-[4px] w-0 h-0 border-t-[6px] border-t-red-500 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent"></div>
                        </div>

                        {/* Main Track (Multi-Clip) */}
                        <div className="flex h-12 bg-gray-950 rounded border border-gray-800 overflow-hidden mb-1">
                            <div className="w-24 flex-shrink-0 bg-gray-800 flex items-center justify-center border-r border-gray-700">
                                <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><Icon icon="Play" size={12} /> Track 1</span>
                            </div>
                            <div className="flex-1 relative flex bg-black" ref={timelineRef}>
                                {playlist.map((clip, idx) => {
                                    const clipDur = clip.trimEnd - clip.trimStart;
                                    const widthPct = (clipDur / totalDuration) * 100;
                                    return (
                                        <div 
                                            key={clip.id} 
                                            style={{ width: `${widthPct}%` }}
                                            className={`
                                                relative h-full border-r border-black/50 overflow-hidden group
                                                ${selectedClipId === clip.id ? 'bg-blue-800' : 'bg-blue-900'}
                                            `}
                                            onMouseDown={(e) => { 
                                                // Allow selection but propagate for scrub
                                                // Note: If we stopProp here, drag scrub won't work well. 
                                                // We can just detect click in parent.
                                                // Better: just visual change, click handled by scrub logic setting time.
                                            }}
                                        >
                                            <span className="absolute top-1 left-1 text-[10px] text-white/50 truncate px-1 z-10 pointer-events-none">{idx + 1}. {clip.file.name}</span>
                                            {/* Visual trim indicators inside block? No, trim is "pre-applied" to width here */}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Overlay Track */}
                        {overlayVideo && (
                            <div className="flex h-10 bg-gray-950 rounded border border-gray-800 overflow-hidden mb-1">
                                <div className="w-24 flex-shrink-0 bg-gray-800 flex items-center justify-center border-r border-gray-700">
                                    <span className="text-xs font-bold text-purple-400 flex items-center gap-1"><Icon icon="Layers" size={12} /> Overlay</span>
                                </div>
                                <div className="flex-1 relative bg-purple-900/20">
                                    <div className="absolute inset-0 bg-purple-600/30 w-full h-full"></div>
                                </div>
                            </div>
                        )}

                        {/* Audio Track */}
                        {audioTrack && (
                            <div className="flex h-8 bg-gray-950 rounded border border-gray-800 overflow-hidden">
                                <div className="w-24 flex-shrink-0 bg-gray-800 flex items-center justify-center border-r border-gray-700">
                                    <span className="text-xs font-bold text-green-400 flex items-center gap-1"><Icon icon="Volume2" size={12} /> Audio</span>
                                </div>
                                <div className="flex-1 relative bg-green-900/20">
                                    <div className="absolute inset-0 bg-green-600/30 w-full h-full"></div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-gray-800">
                         <button onClick={togglePlay} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-200">
                            <Icon icon={isPlaying ? "Pause" : "Play"} fill="currentColor" />
                         </button>

                         {/* Trimmer for Selected Clip */}
                         {activeClip ? (
                             <div className="flex items-center gap-4 bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
                                <div className="text-xs text-gray-400 mr-2 font-bold uppercase">
                                    Clip {playlist.findIndex(c => c.id === activeClip.id) + 1} Trim
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Start</label>
                                    <input 
                                        type="number" className="bg-transparent text-yellow-500 font-mono text-sm w-16 focus:outline-none"
                                        value={activeClip.trimStart.toFixed(2)} step="0.1"
                                        onChange={(e) => handleTrimChange('start', parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="w-px h-8 bg-gray-700"></div>
                                <div className="flex flex-col text-right">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold">End</label>
                                    <input 
                                        type="number" className="bg-transparent text-yellow-500 font-mono text-sm w-16 text-right focus:outline-none"
                                        value={activeClip.trimEnd.toFixed(2)} step="0.1"
                                        onChange={(e) => handleTrimChange('end', parseFloat(e.target.value))}
                                    />
                                </div>
                             </div>
                         ) : (
                             <div className="text-xs text-gray-600">Select a clip to trim</div>
                         )}
                    </div>
                 </div>
             )}
        </section>
      </main>

      <div className="hidden">
        {playlist.map(clip => (
            <video
                key={clip.id}
                ref={(el) => assignVideoRef(el, clip.id)}
                src={clip.url}
                crossOrigin="anonymous" playsInline muted
                preload="auto"
            />
        ))}
        <video ref={overlayVideoRef} crossOrigin="anonymous" playsInline muted loop />
        <audio ref={audioRef} crossOrigin="anonymous" />
      </div>

      {/* Logo HSH en bas à droite */}
      <div className="fixed bottom-4 right-4 opacity-50 hover:opacity-100 transition-opacity">
        <img src="/favicon.svg" alt="HSH" width="48" height="48" />
      </div>
    </div>
  );
}
