import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Settings, Maximize, Wifi, WifiOff, Activity, UploadCloud, Check } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import LoadingSpinner from '../components/common/LoadingSpinner';

interface VideoUploadResponse {
  success: boolean;
  data?: {
    video: any;
    processingStatus: {
      status: string;
      progress: number;
      message: string;
    };
  };
  error?: string;
}

interface ProcessingStatus {
  status: string;
  progress: number;
  message?: string;
  error?: string;
}

const AdaptiveStreamingDemo: React.FC = () => {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [currentQuality, setCurrentQuality] = useState('Auto');
  const [networkStatus, setNetworkStatus] = useState('Auto-detecting');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showStreamingDemo, setShowStreamingDemo] = useState(false);
  const [transcodingCode, setTranscodingCode] = useState('');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadedFile) {
      alert('Please select a video file first');
      return;
    }

    if (!user) {
      alert('Please login to upload videos');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('video', uploadedFile);
    formData.append('title', uploadedFile.name);
    formData.append('description', 'Adaptive bitrate streaming demo video');
    formData.append('visibility', 'public');

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/videos/upload-with-transcoding', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result: VideoUploadResponse = await response.json();

      if (result.success && result.data) {
        setProcessingStatus(result.data.processingStatus);
        setStreamingUrl(`/api/stream/${result.data.video.id}/manifest.m3u8`);
        
        // Start monitoring processing status
        monitorProcessingStatus(result.data.video.id);
        
        // Show transcoding animation
        animateTranscodingCode();
        
        setTimeout(() => {
          setShowStreamingDemo(true);
        }, 2000);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const monitorProcessingStatus = async (videoId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/stream/${videoId}/status`);
        const result = await response.json();
        
        if (result.success) {
          setProcessingStatus(result.data);
          
          if (result.data.status === 'ready') {
            // Initialize HLS player
            initializeHLSPlayer(videoId);
            return;
          }
        }
        
        // Continue checking if still processing
        if (processingStatus?.status === 'processing') {
          setTimeout(checkStatus, 2000);
        }
      } catch (error) {
        console.error('Failed to check status:', error);
      }
    };

    checkStatus();
  };

  const initializeHLSPlayer = (videoId: string) => {
    if (!videoRef.current) return;

    const Hls = (window as any).Hls;
    if (Hls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
      });

      hls.loadSource(`/api/stream/${videoId}/manifest.m3u8`);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest loaded');
        setProcessingStatus(prev => prev ? { ...prev, status: 'ready', progress: 100 } : null);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event: any, data: any) => {
        const quality = data.level !== -1 ? `${hls.levels[data.level].height}p` : 'Auto';
        setCurrentQuality(quality);
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      videoRef.current.src = `/api/stream/${videoId}/manifest.m3u8`;
    }
  };

  const animateTranscodingCode = () => {
    const code = `// AWS MediaConvert Job Settings
{
  "OutputGroups": [{
    "Name": "HLS",
    "Outputs": [
      {
        "Preset": "System-Avc_16x9_1080p_29_97fps_8500kbps",
        "Extension": "ts",
        "NameModifier": "_1080"
      },
      {
        "Preset": "System-Avc_16x9_720p_29_97fps_5000kbps",
        "Extension": "ts",
        "NameModifier": "_720"
      },
      {
        "Preset": "System-Avc_16x9_480p_29_97fps_2500kbps",
        "Extension": "ts",
        "NameModifier": "_480"
      }
    ],
    "OutputGroupSettings": {
      "Type": "HLS_GROUP_SETTINGS",
      "HlsGroupSettings": {
        "SegmentLength": 6,
        "MinSegmentLength": 0,
        "Destination": "s3://your-bucket/outputs/"
      }
    }
  }]
}`;

    let i = 0;
    const typing = setInterval(() => {
      if (i < code.length) {
        setTranscodingCode(code.substring(0, i + 1));
        i++;
      } else {
        clearInterval(typing);
      }
    }, 10);
  };

  const simulateNetwork = (speed: 'slow' | 'fast') => {
    if (!hlsRef.current) return;

    if (speed === 'slow') {
      // Simulate slow 3G conditions
      hlsRef.current.currentLevel = 0; // Force lowest quality
      hlsRef.current.config.maxBufferLength = 10;
      setNetworkStatus('Slow 3G (~1.5 Mbps)');
    } else {
      // Simulate fast WiFi conditions
      hlsRef.current.currentLevel = -1; // Auto quality
      hlsRef.current.config.maxBufferLength = 30;
      setNetworkStatus('Fast WiFi (~50 Mbps)');
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="bg-gray-800 py-4 px-6 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Play className="text-blue-500 w-6 h-6" />
          <h1 className="text-xl font-bold">StreamFlow</h1>
        </div>
        <div className="hidden md:flex space-x-6">
          <a href="#" className="hover:text-blue-400">Home</a>
          <a href="#" className="hover:text-blue-400">Browse</a>
          <a href="#" className="hover:text-blue-400">Library</a>
          <a href="#" className="hover:text-blue-400">About</a>
        </div>
        <div className="flex items-center space-x-4">
          <button className="p-2 rounded-full hover:bg-gray-700">
            <Settings className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-700">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">U</span>
            </div>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent z-10"></div>
        <div className="relative aspect-video bg-black">
          {streamingUrl && showStreamingDemo ? (
            <video
              ref={videoRef}
              className="w-full h-full"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Play className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Adaptive Bitrate Streaming Demo</h2>
                <p className="text-gray-300">Upload a video to see adaptive streaming in action</p>
              </div>
            </div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-20 p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold mb-2">Adaptive Bitrate Streaming Demo</h1>
            <p className="text-gray-300 mb-4 max-w-2xl">
              Experience seamless video playback with our adaptive streaming technology that automatically adjusts quality based on your network conditions.
            </p>
            <div className="flex space-x-4">
              <button 
                onClick={handlePlayPause}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg flex items-center space-x-2"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'Pause' : 'Play Now'}</span>
              </button>
              <button className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>More Info</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Demo Section */}
      <div className="py-12 px-6 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Try It Yourself</h2>
          
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
                <div className="mx-auto w-max mb-4">
                  <UploadCloud className="text-blue-500 w-12 h-12" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Upload Your Video</h3>
                <p className="text-gray-300 mb-6">
                  Upload a video file to see adaptive bitrate streaming in action
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {!user ? (
                  <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-sm mb-2">Please login to upload videos</p>
                    <button
                      onClick={() => window.location.href = '/login'}
                      className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg text-sm"
                    >
                      Go to Login
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg cursor-pointer inline-block mb-4"
                    >
                      Select Video File
                    </button>
                    
                    {uploadedFile && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-400">Selected: {uploadedFile.name}</p>
                        <p className="text-xs text-gray-500">Size: {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button
                          onClick={handleUpload}
                          disabled={isUploading}
                          className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg mt-2 disabled:opacity-50"
                        >
                          {isUploading ? 'Uploading...' : 'Start Transcoding'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {isUploading && (
                  <div className="mt-4">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
                    </p>
                  </div>
                )}

                {processingStatus && (
                  <div className="mt-4">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 transition-all duration-300" 
                        style={{ width: `${processingStatus.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      {processingStatus.message || `Processing... ${processingStatus.progress}%`}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">How It Works</h3>
                <ol className="space-y-4 list-decimal list-inside text-gray-300">
                  <li>Upload your video file (MP4, MOV, etc.)</li>
                  <li>Our system processes it into multiple bitrate versions</li>
                  <li>The video is segmented and packaged for HLS streaming</li>
                  <li>You'll receive a streaming URL to test adaptive playback</li>
                  <li>Watch how the player adapts to different network conditions</li>
                </ol>
                <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                  <h4 className="font-medium mb-2">Transcoding Process:</h4>
                  <pre className="text-xs text-gray-300 overflow-auto max-h-40">
                    <code>{transcodingCode}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Streaming Demo Section */}
      {showStreamingDemo && (
        <div className="py-12 px-6 bg-gray-900">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">See Adaptive Streaming in Action</h2>
            
            {/* Main Video Player */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h3 className="text-xl font-semibold mb-4">Adaptive Bitrate Player</h3>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                {streamingUrl ? (
                  <video
                    ref={videoRef}
                    className="w-full h-full"
                    controls
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-white">
                      <Play className="w-16 h-16 mx-auto mb-4" />
                      <p>Video is being processed...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quality Options and Controls */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold mb-4">Current Stream Info</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-400">Current Quality:</p>
                      <p className="text-blue-400 font-medium">{currentQuality}</p>
                      <div className="mt-2">
                        <p className="text-gray-400 text-sm">Available Qualities:</p>
                        <div className="flex space-x-2 mt-1">
                          <span className="bg-gray-700 px-2 py-1 rounded text-xs">1080p</span>
                          <span className="bg-gray-700 px-2 py-1 rounded text-xs">720p</span>
                          <span className="bg-gray-700 px-2 py-1 rounded text-xs">480p</span>
                          <span className="bg-gray-700 px-2 py-1 rounded text-xs">360p</span>
                          <span className="bg-gray-700 px-2 py-1 rounded text-xs">240p</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-400">Network Status:</p>
                      <p className="text-blue-400 font-medium">{networkStatus}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Processing Status:</p>
                      <p className="text-green-400 font-medium">
                        {processingStatus?.status === 'ready' ? 'Ready for streaming' : 'Processing...'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold mb-4">Simulate Network Conditions</h3>
                  <div className="flex space-x-4">
                    <button 
                      onClick={() => simulateNetwork('slow')}
                      className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded-lg flex items-center"
                    >
                      <WifiOff className="mr-2 w-4 h-4" />
                      Slow 3G
                    </button>
                    <button 
                      onClick={() => simulateNetwork('fast')}
                      className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg flex items-center"
                    >
                      <Wifi className="mr-2 w-4 h-4" />
                      Fast WiFi
                    </button>
                  </div>
                  <p className="text-gray-400 mt-4">
                    Click the buttons to simulate different network conditions and watch how the player adapts.
                  </p>
                  
                  {/* Quality Selection */}
                  <div className="mt-6">
                    <h4 className="text-lg font-medium mb-2">Manual Quality Selection</h4>
                    <div className="flex space-x-2">
                      {['Auto', '1080p', '720p', '480p', '360p', '240p'].map((quality) => (
                        <button
                          key={quality}
                          onClick={() => setCurrentQuality(quality)}
                          className={`px-3 py-1 rounded text-sm ${
                            currentQuality === quality
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {quality}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AWS Integration Section */}
      <div className="py-12 px-6 bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">AWS Media Services Integration</h2>
          
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="bg-gray-700 rounded-lg p-8 text-center">
                <h3 className="text-2xl font-bold mb-4">AWS Media Services</h3>
                <p className="text-gray-300">Cloud-based video processing and delivery</p>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-semibold mb-4">Powered by AWS</h3>
              <p className="text-gray-300 mb-6">
                This demo showcases how AWS Media Services can be used to implement adaptive bitrate streaming at scale:
              </p>
              <ul className="space-y-3">
                <li className="flex items-start space-x-2">
                  <Check className="text-green-400 mt-1 w-4 h-4" />
                  <span><strong>S3</strong> for storage of source and transcoded content</span>
                </li>
                <li className="flex items-start space-x-2">
                  <Check className="text-green-400 mt-1 w-4 h-4" />
                  <span><strong>Elemental MediaConvert</strong> for video processing and packaging</span>
                </li>
                <li className="flex items-start space-x-2">
                  <Check className="text-green-400 mt-1 w-4 h-4" />
                  <span><strong>CloudFront</strong> for global content delivery</span>
                </li>
                <li className="flex items-start space-x-2">
                  <Check className="text-green-400 mt-1 w-4 h-4" />
                  <span><strong>Lambda</strong> for serverless processing workflows</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-8 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4">StreamFlow</h3>
            <p className="text-gray-400">
              Advanced adaptive bitrate streaming technology demo for your projects.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white">Home</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Documentation</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">API Reference</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Technology</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-white">HLS.js</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">AWS Media Services</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white">Node.js Backend</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Connect</h3>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-white">GitHub</a>
              <a href="#" className="text-gray-400 hover:text-white">Twitter</a>
              <a href="#" className="text-gray-400 hover:text-white">LinkedIn</a>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500">
          <p>© 2023 StreamFlow Demo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AdaptiveStreamingDemo;
