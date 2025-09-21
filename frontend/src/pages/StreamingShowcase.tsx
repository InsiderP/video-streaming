import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVideoStore } from '../store/video.store';
import { useAuthStore } from '../store/auth.store';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Settings, 
  Maximize, 
  Upload, 
  Eye, 
  Wifi, 
  WifiOff,
  Activity,
  Zap,
  Monitor,
  Smartphone,
  Globe
} from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

// Declare HLS.js types
declare global {
  interface Window {
    Hls: any;
  }
}

interface QualityLevel {
  name: string;
  width: number;
  height: number;
  bitrate: number;
  url?: string;
}

interface NetworkSimulation {
  name: string;
  bandwidth: number;
  latency: number;
  icon: React.ReactNode;
  color: string;
}

const StreamingShowcase: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { videos, getVideos } = useVideoStore();
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [availableQualities, setAvailableQualities] = useState<QualityLevel[]>([]);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [networkStatus, setNetworkStatus] = useState('Auto-detecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showUploadDemo, setShowUploadDemo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const networkSimulations: NetworkSimulation[] = [
    {
      name: 'Slow 3G',
      bandwidth: 1.5,
      latency: 400,
      icon: <WifiOff className="w-4 h-4" />,
      color: 'bg-red-600 hover:bg-red-700'
    },
    {
      name: 'Fast 3G',
      bandwidth: 3,
      latency: 200,
      icon: <Wifi className="w-4 h-4" />,
      color: 'bg-orange-600 hover:bg-orange-700'
    },
    {
      name: '4G',
      bandwidth: 10,
      latency: 100,
      icon: <Activity className="w-4 h-4" />,
      color: 'bg-yellow-600 hover:bg-yellow-700'
    },
    {
      name: 'WiFi',
      bandwidth: 50,
      latency: 20,
      icon: <Zap className="w-4 h-4" />,
      color: 'bg-green-600 hover:bg-green-700'
    }
  ];

  useEffect(() => {
    loadVideos();
    loadHLS();
  }, []);

  const loadVideos = async () => {
    try {
      await getVideos({ status: 'ready', visibility: 'public', limit: 10 });
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const loadHLS = () => {
    if (typeof window !== 'undefined' && window.Hls) {
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    script.onload = () => {
      console.log('HLS.js loaded');
    };
    document.head.appendChild(script);
  };

  const selectVideo = (video: any) => {
    setSelectedVideo(video);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    
    // Simulate available qualities for demo
    const qualities: QualityLevel[] = [
      { name: '1080p', width: 1920, height: 1080, bitrate: 5000 },
      { name: '720p', width: 1280, height: 720, bitrate: 2500 },
      { name: '480p', width: 854, height: 480, bitrate: 1000 },
      { name: '360p', width: 640, height: 360, bitrate: 500 }
    ];
    setAvailableQualities(qualities);
    setCurrentQuality('auto');
  };

  const playVideo = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration);
    }
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    if (!videoRef.current || !progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const changeQuality = (quality: string) => {
    setCurrentQuality(quality);
    setShowQualityMenu(false);
    
    if (hlsRef.current && quality !== 'auto') {
      const levelIndex = availableQualities.findIndex(q => q.name === quality);
      if (levelIndex !== -1) {
        hlsRef.current.currentLevel = levelIndex;
      }
    } else if (hlsRef.current) {
      hlsRef.current.currentLevel = -1; // Auto
    }
  };

  const simulateNetwork = (simulation: NetworkSimulation) => {
    setNetworkStatus(`${simulation.name} (~${simulation.bandwidth} Mbps)`);
    
    // Simulate network throttling effect
    if (hlsRef.current) {
      // Force lower quality for slower networks
      if (simulation.bandwidth <= 1.5) {
        hlsRef.current.currentLevel = availableQualities.length - 1; // Lowest quality
      } else if (simulation.bandwidth <= 3) {
        hlsRef.current.currentLevel = Math.max(0, availableQualities.length - 2);
      } else if (simulation.bandwidth <= 10) {
        hlsRef.current.currentLevel = Math.max(0, availableQualities.length - 3);
      } else {
        hlsRef.current.currentLevel = -1; // Auto
      }
    }
    
    toast.success(`Simulating ${simulation.name} network conditions`);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUploadDemo = () => {
    setShowUploadDemo(true);
    setUploadProgress(0);
    setIsProcessing(false);
    
    // Simulate upload and processing
    const uploadInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(uploadInterval);
          setIsProcessing(true);
          
          // Simulate processing time
          setTimeout(() => {
            setIsProcessing(false);
            toast.success('Video processed! Adaptive streaming is now available.');
            setShowUploadDemo(false);
          }, 3000);
          
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Play className="w-8 h-8 text-blue-500" />
            <h1 className="text-2xl font-bold">StreamFlow - Adaptive Bitrate Demo</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
            >
              My Dashboard
            </button>
            <button 
              onClick={() => navigate('/upload')}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Video</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Video Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Select a Video to Stream</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.length > 0 ? (
              videos.map((video) => (
                <div
                  key={video.id}
                  onClick={() => selectVideo(video)}
                  className={`cursor-pointer rounded-lg overflow-hidden transition-all ${
                    selectedVideo?.id === video.id 
                      ? 'ring-2 ring-blue-500 bg-blue-900/20' 
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  <div className="aspect-video bg-gray-700 flex items-center justify-center">
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <Play className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold mb-1">{video.title}</h3>
                    <p className="text-sm text-gray-400 line-clamp-2">{video.description}</p>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Eye className="w-3 h-3" />
                        <span>{video.viewCount}</span>
                      </span>
                      <span className="bg-green-600 px-2 py-1 rounded">{video.status}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">No videos available for streaming</p>
                <button 
                  onClick={() => navigate('/upload')}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg"
                >
                  Upload Your First Video
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Video Player */}
        {selectedVideo && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Adaptive Bitrate Player</h2>
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-full"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  poster={selectedVideo.thumbnailUrl}
                >
                  <source src="/api/stream/demo/master.m3u8" type="application/x-mpegURL" />
                  Your browser does not support the video tag.
                </video>
                
                {/* Custom Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={playVideo}
                      className="p-2 rounded-full hover:bg-white/20 transition-colors"
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                    </button>
                    
                    <div className="flex items-center space-x-2 text-sm">
                      <span>{formatTime(currentTime)}</span>
                      <span>/</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    
                    <div 
                      ref={progressRef}
                      onClick={handleProgressClick}
                      className="flex-1 h-1 bg-white/30 rounded-full cursor-pointer"
                    >
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                    
                    <button
                      onClick={toggleMute}
                      className="p-2 rounded-full hover:bg-white/20 transition-colors"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-20"
                    />
                    
                    <div className="relative">
                      <button
                        onClick={() => setShowQualityMenu(!showQualityMenu)}
                        className="p-2 rounded-full hover:bg-white/20 transition-colors flex items-center space-x-1"
                      >
                        <Settings className="w-5 h-5" />
                        <span className="text-sm">{currentQuality}</span>
                      </button>
                      
                      {showQualityMenu && (
                        <div className="absolute bottom-full right-0 mb-2 bg-gray-700 rounded-lg shadow-lg z-10 min-w-32">
                          <div className="py-2">
                            <button
                              onClick={() => changeQuality('auto')}
                              className={`w-full text-left px-4 py-2 hover:bg-gray-600 ${
                                currentQuality === 'auto' ? 'bg-blue-600' : ''
                              }`}
                            >
                              Auto
                            </button>
                            {availableQualities.map((quality) => (
                              <button
                                key={quality.name}
                                onClick={() => changeQuality(quality.name)}
                                className={`w-full text-left px-4 py-2 hover:bg-gray-600 ${
                                  currentQuality === quality.name ? 'bg-blue-600' : ''
                                }`}
                              >
                                {quality.name} ({quality.bitrate}kbps)
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 rounded-full hover:bg-white/20 transition-colors"
                    >
                      <Maximize className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Network Simulation */}
        {selectedVideo && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Network Simulation</h2>
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Current Network Status</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400">Current Quality:</p>
                      <p className="text-blue-400 font-medium">{currentQuality}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Network Status:</p>
                      <p className="text-green-400 font-medium">{networkStatus}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Available Qualities:</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {availableQualities.map((quality) => (
                          <span key={quality.name} className="bg-gray-700 px-3 py-1 rounded text-sm">
                            {quality.name} ({quality.bitrate}kbps)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">Simulate Network Conditions</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {networkSimulations.map((simulation) => (
                      <button
                        key={simulation.name}
                        onClick={() => simulateNetwork(simulation)}
                        className={`${simulation.color} px-4 py-3 rounded-lg flex items-center space-x-2 transition-colors`}
                      >
                        {simulation.icon}
                        <span className="text-sm font-medium">{simulation.name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-gray-400 text-sm mt-4">
                    Click the buttons to simulate different network conditions and watch how the player adapts automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Demo */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Try It Yourself</h2>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold mb-4">Upload & Process Demo</h3>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                  <h4 className="text-xl font-semibold mb-2">Upload Your Video</h4>
                  <p className="text-gray-400 mb-6">
                    Experience the complete adaptive bitrate streaming workflow
                  </p>
                  
                  {!showUploadDemo ? (
                    <button
                      onClick={handleUploadDemo}
                      className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium"
                    >
                      Start Demo Upload
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-400">
                        {isProcessing ? 'Processing video for adaptive streaming...' : `Uploading... ${uploadProgress}%`}
                      </p>
                      {isProcessing && <LoadingSpinner size="sm" />}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-4">How It Works</h3>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <h4 className="font-medium">Upload Original Video</h4>
                      <p className="text-sm text-gray-400">Your video is uploaded to secure cloud storage</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <h4 className="font-medium">Multi-Quality Transcoding</h4>
                      <p className="text-sm text-gray-400">FFmpeg creates multiple bitrate versions (1080p, 720p, 480p, 360p)</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</div>
                    <div>
                      <h4 className="font-medium">HLS Packaging</h4>
                      <p className="text-sm text-gray-400">Videos are segmented and packaged for adaptive streaming</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">4</div>
                    <div>
                      <h4 className="font-medium">Adaptive Delivery</h4>
                      <p className="text-sm text-gray-400">Player automatically selects optimal quality based on network</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Technology Stack */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Technology Stack</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="bg-blue-900/20 p-4 rounded-full w-max mb-4">
                <Monitor className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Frontend</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• React + TypeScript</li>
                <li>• HLS.js for adaptive streaming</li>
                <li>• Tailwind CSS for styling</li>
                <li>• Zustand for state management</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="bg-green-900/20 p-4 rounded-full w-max mb-4">
                <Activity className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Backend</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• Node.js + Express</li>
                <li>• FFmpeg for video processing</li>
                <li>• PostgreSQL database</li>
                <li>• JWT authentication</li>
              </ul>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="bg-purple-900/20 p-4 rounded-full w-max mb-4">
                <Globe className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Infrastructure</h3>
              <ul className="space-y-2 text-gray-300">
                <li>• AWS S3 for storage</li>
                <li>• CloudFront CDN</li>
                <li>• HLS streaming protocol</li>
                <li>• Adaptive bitrate algorithms</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreamingShowcase;

