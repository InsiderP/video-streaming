import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Settings, Maximize, SkipBack, SkipForward } from 'lucide-react';
import { useVideoStore } from '../../store/video.store';
import LoadingSpinner from '../common/LoadingSpinner';

const VideoPlayer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const controlsTimeoutRef = useRef<number | null>(null);

  const { currentVideo, getVideo, trackAnalytics } = useVideoStore();

  useEffect(() => {
    if (id) {
      getVideo(id);
    }
  }, [id, getVideo]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (currentVideo && currentVideo.status === 'ready') {
      initializePlayer();
    }
  }, [currentVideo]);

  const initializePlayer = async () => {
    if (!videoRef.current || !currentVideo) return;

    try {
      setIsLoading(true);
      setError(null);

      // Get HLS manifest URL
      const manifestUrl = `/api/stream/${currentVideo.id}/manifest.m3u8`;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
        });

        hls.loadSource(manifestUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event) => {
          setIsLoading(false);
          
          // Get available quality levels
          const levels = hls.levels;
          const qualities = levels.map(level => `${level.height}p`);
          setAvailableQualities(['auto', ...qualities]);
          
          // Track play event
          trackAnalytics(currentVideo.id, 'play');
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          const quality = data.level !== -1 ? `${hls.levels[data.level].height}p` : 'auto';
          setCurrentQuality(quality);
          
          // Track quality change
          trackAnalytics(currentVideo.id, 'quality_change', { quality });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            setError('Video playback failed');
            setIsLoading(false);
          }
        });

        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        videoRef.current.src = manifestUrl;
        setIsLoading(false);
      } else {
        setError('HLS is not supported in this browser');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Failed to initialize player:', error);
      setError('Failed to load video');
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      trackAnalytics(currentVideo?.id || '', 'pause');
    } else {
      videoRef.current.play();
      trackAnalytics(currentVideo?.id || '', 'play');
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    trackAnalytics(currentVideo?.id || '', 'seek', { seekPosition: time });
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    if (!videoRef.current) return;
    
    if (isMuted) {
      videoRef.current.volume = volume;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleQualityChange = (quality: string) => {
    if (!hlsRef.current) return;
    
    setCurrentQuality(quality);
    
    if (quality === 'auto') {
      hlsRef.current.currentLevel = -1;
    } else {
      const levelIndex = availableQualities.indexOf(quality) - 1; // -1 because 'auto' is first
      hlsRef.current.currentLevel = levelIndex;
    }
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    setCurrentTime(videoRef.current.currentTime);
    setDuration(videoRef.current.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    trackAnalytics(currentVideo?.id || '', 'complete');
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (!duration || duration === 0) return 0;
    return (currentTime / duration) * 100;
  };

  const handleMouseMove = useCallback(() => {
    if (isMobile) return; // Don't auto-hide controls on mobile
    
    setShowControls(true);
    setShowInfo(true);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      setShowInfo(false);
    }, 3000);
  }, [isMobile]);

  const handleMouseEnter = useCallback(() => {
    setShowControls(true);
    setShowInfo(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (isMobile) return; // Don't auto-hide controls on mobile
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      setShowInfo(false);
    }, 1000);
  }, [isMobile]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!videoRef.current) return;
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        handlePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - 10));
        break;
      case 'ArrowRight':
        e.preventDefault();
        handleSeek(Math.min(duration, currentTime + 10));
        break;
      case 'ArrowUp':
        e.preventDefault();
        handleVolumeChange(Math.min(1, volume + 0.1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        handleVolumeChange(Math.max(0, volume - 0.1));
        break;
      case 'KeyM':
        e.preventDefault();
        handleMuteToggle();
        break;
      case 'KeyF':
        e.preventDefault();
        handleFullscreen();
        break;
      case 'KeyH':
        e.preventDefault();
        setShowKeyboardHelp(!showKeyboardHelp);
        break;
    }
  }, [currentTime, duration, volume, showKeyboardHelp]);

  const handleTouchStart = useCallback((_e: React.TouchEvent) => {
    if (isMobile) {
      setShowControls(true);
      setShowInfo(true);
    }
  }, [isMobile]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleFullscreen();
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [handleKeyDown]);

  if (!currentVideo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (currentVideo.status !== 'ready') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Video Not Ready</h1>
          <p className="text-muted-foreground">
            This video is still being processed. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div 
        className="relative w-full h-screen group"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onClick={handlePlayPause}
          onTouchStart={handleTouchStart}
          onDoubleClick={handleDoubleClick}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="text-white mt-4 text-lg">Loading video...</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="error-overlay">
            <div className="text-center text-white max-w-md mx-auto">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Playback Error</h2>
              <p className="text-gray-300 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="btn btn-primary"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Play Button Overlay */}
        {!isPlaying && !isLoading && !error && (
          <div className={`play-button-overlay ${showControls ? '' : 'hidden'}`}>
            <button
              onClick={handlePlayPause}
              className="play-button-large"
            >
              <Play className="w-8 h-8 ml-1" />
            </button>
          </div>
        )}

        {/* Video Controls */}
        <div className={`video-controls ${showControls && !isLoading && !error ? '' : 'hidden'}`}>
          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="video-slider"
              style={{'--progress': `${getProgressPercentage()}%`} as React.CSSProperties}
            />
          </div>

          {/* Control Buttons */}
          <div className={`flex items-center ${isMobile ? 'flex-col space-y-3' : 'justify-between'}`}>
            <div className={`flex items-center ${isMobile ? 'space-x-4' : 'space-x-2'}`}>
              <button
                onClick={handlePlayPause}
                className="video-control-btn"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>

              {!isMobile && (
                <>
                  <button
                    onClick={() => handleSeek(Math.max(0, currentTime - 10))}
                    className="video-control-btn"
                    title="Rewind 10s"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleSeek(Math.min(duration, currentTime + 10))}
                    className="video-control-btn"
                    title="Forward 10s"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </>
              )}

              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={handleMuteToggle}
                  className="video-control-btn"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                {!isMobile && (
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="volume-slider"
                  />
                )}
              </div>

              <span className="text-white text-sm font-mono ml-4">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className={`flex items-center ${isMobile ? 'space-x-3' : 'space-x-2'}`}>
              {/* Quality Selector */}
              <select
                value={currentQuality}
                onChange={(e) => handleQualityChange(e.target.value)}
                className="quality-selector"
                title="Video Quality"
              >
                {availableQualities.map(quality => (
                  <option key={quality} value={quality}>
                    {quality === 'auto' ? 'Auto' : quality}
                  </option>
                ))}
              </select>

              {!isMobile && (
                <button
                  onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
                  className="video-control-btn"
                  title="Keyboard Shortcuts (H)"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={handleFullscreen}
                className="video-control-btn"
                title="Fullscreen"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Video Info */}
        <div className={`video-info-overlay ${showInfo && !isLoading && !error ? '' : 'hidden'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2 text-white">{currentVideo.title}</h1>
              <p className="text-gray-200 text-sm mb-3 line-clamp-2">{currentVideo.description}</p>
              <div className="flex items-center space-x-6 text-sm text-gray-300">
                <span className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  <span>{currentVideo.viewCount?.toLocaleString() || 0} views</span>
                </span>
                <span className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                  <span>{currentVideo.likeCount?.toLocaleString() || 0} likes</span>
                </span>
                <span className="flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  <span>{currentVideo.user?.username || 'Unknown'}</span>
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowInfo(false)}
              className="text-gray-400 hover:text-white transition-colors ml-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        {showKeyboardHelp && !isMobile && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-sm text-white p-6 rounded-xl border border-white/20 max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Space</span>
                <span className="text-gray-300">Play/Pause</span>
              </div>
              <div className="flex justify-between">
                <span>← →</span>
                <span className="text-gray-300">Seek ±10s</span>
              </div>
              <div className="flex justify-between">
                <span>↑ ↓</span>
                <span className="text-gray-300">Volume ±10%</span>
              </div>
              <div className="flex justify-between">
                <span>M</span>
                <span className="text-gray-300">Mute/Unmute</span>
              </div>
              <div className="flex justify-between">
                <span>F</span>
                <span className="text-gray-300">Fullscreen</span>
              </div>
              <div className="flex justify-between">
                <span>H</span>
                <span className="text-gray-300">Show/Hides Help</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
