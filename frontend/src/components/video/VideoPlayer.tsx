import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Hls from 'hls.js';
import { Play, Pause, Volume2, VolumeX, Settings, Maximize, RotateCcw } from 'lucide-react';
import { useVideoStore } from '../../store/video.store';
import { useAuthStore } from '../../store/auth.store';
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
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentVideo, getVideo, trackAnalytics } = useVideoStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (id) {
      getVideo(id);
    }
  }, [id, getVideo]);

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

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          
          // Get available quality levels
          const levels = hls.levels;
          const qualities = levels.map(level => `${level.height}p`);
          setAvailableQualities(['auto', ...qualities]);
          
          // Track play event
          trackAnalytics(currentVideo.id, 'play');
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const quality = data.level !== -1 ? `${hls.levels[data.level].height}p` : 'auto';
          setCurrentQuality(quality);
          
          // Track quality change
          trackAnalytics(currentVideo.id, 'quality_change', { quality });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
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
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    setTimeout(() => setShowControls(false), 3000);
  };

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
      <div className="relative w-full h-screen">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onMouseMove={handleMouseMove}
          onClick={handlePlayPause}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-center text-white">
              <h2 className="text-xl font-bold mb-2">Playback Error</h2>
              <p className="text-gray-300">{error}</p>
            </div>
          </div>
        )}

        {/* Video Controls */}
        {showControls && !isLoading && !error && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
            {/* Progress Bar */}
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handlePlayPause}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleMuteToggle}
                    className="text-white hover:text-gray-300 transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center space-x-4">
                {/* Quality Selector */}
                <select
                  value={currentQuality}
                  onChange={(e) => handleQualityChange(e.target.value)}
                  className="bg-gray-800 text-white px-2 py-1 rounded text-sm"
                >
                  {availableQualities.map(quality => (
                    <option key={quality} value={quality}>
                      {quality}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleFullscreen}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Info */}
        <div className="absolute top-4 left-4 right-4">
          <div className="bg-black bg-opacity-50 text-white p-4 rounded-lg">
            <h1 className="text-xl font-bold mb-2">{currentVideo.title}</h1>
            <p className="text-gray-300 text-sm mb-2">{currentVideo.description}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span>{currentVideo.viewCount} views</span>
              <span>{currentVideo.likeCount} likes</span>
              <span>{currentVideo.user?.username}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
