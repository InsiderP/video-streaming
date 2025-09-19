# Video Streaming Platform - Low Level Design (LLD)

## 1. Database Schema Design

### 1.1 PostgreSQL Tables

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url VARCHAR(500),
    role user_role DEFAULT 'viewer',
    subscription_tier subscription_tier DEFAULT 'free',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE user_role AS ENUM ('admin', 'creator', 'viewer');
CREATE TYPE subscription_tier AS ENUM ('free', 'premium', 'pro');
```

#### Videos Table
```sql
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255),
    file_size BIGINT,
    duration INTEGER, -- in seconds
    thumbnail_url VARCHAR(500),
    status video_status DEFAULT 'processing',
    visibility visibility_type DEFAULT 'private',
    category_id UUID REFERENCES categories(id),
    tags TEXT[],
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE video_status AS ENUM ('uploading', 'processing', 'ready', 'failed', 'deleted');
CREATE TYPE visibility_type AS ENUM ('public', 'private', 'unlisted');
```

#### Video Variants Table (for adaptive bitrate)
```sql
CREATE TABLE video_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    quality VARCHAR(20) NOT NULL, -- '1080p', '720p', '480p', '360p', '240p'
    bitrate INTEGER NOT NULL, -- in kbps
    resolution_width INTEGER NOT NULL,
    resolution_height INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    hls_playlist_url VARCHAR(500),
    dash_manifest_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Categories Table
```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### User Sessions Table
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Analytics Table
```sql
CREATE TABLE video_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type analytics_event NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_watched INTEGER, -- in seconds
    quality_watched VARCHAR(20),
    device_type VARCHAR(50),
    browser VARCHAR(50),
    country VARCHAR(2), -- ISO country code
    ip_address INET
);

CREATE TYPE analytics_event AS ENUM ('play', 'pause', 'seek', 'quality_change', 'complete', 'abandon');
```

## 2. API Endpoints Design

### 2.1 Authentication APIs
```typescript
// POST /api/auth/register
interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

// POST /api/auth/login
interface LoginRequest {
  email: string;
  password: string;
}

// POST /api/auth/refresh
interface RefreshRequest {
  refreshToken: string;
}

// POST /api/auth/logout
// DELETE /api/auth/sessions/:sessionId
```

### 2.2 Video Management APIs
```typescript
// POST /api/videos/upload
interface UploadRequest {
  title: string;
  description?: string;
  categoryId?: string;
  tags?: string[];
  visibility: 'public' | 'private' | 'unlisted';
}

// GET /api/videos
interface VideoListQuery {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?: 'created_at' | 'view_count' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// GET /api/videos/:id
// PUT /api/videos/:id
// DELETE /api/videos/:id

// POST /api/videos/:id/thumbnail
// GET /api/videos/:id/analytics
```

### 2.3 Streaming APIs
```typescript
// GET /api/stream/:videoId/manifest.m3u8
// GET /api/stream/:videoId/:quality/playlist.m3u8
// GET /api/stream/:videoId/:quality/:segment.ts

// POST /api/stream/:videoId/analytics
interface StreamingAnalytics {
  eventType: 'play' | 'pause' | 'seek' | 'quality_change' | 'complete';
  timestamp: number;
  durationWatched?: number;
  qualityWatched?: string;
  seekPosition?: number;
}
```

## 3. Backend Service Architecture

### 3.1 Project Structure
```
backend/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── video.controller.ts
│   │   ├── stream.controller.ts
│   │   └── analytics.controller.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── video.service.ts
│   │   ├── stream.service.ts
│   │   ├── transcoding.service.ts
│   │   └── analytics.service.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── rateLimit.middleware.ts
│   │   └── error.middleware.ts
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── video.model.ts
│   │   └── analytics.model.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── video.routes.ts
│   │   ├── stream.routes.ts
│   │   └── analytics.routes.ts
│   ├── utils/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   ├── storage.ts
│   │   └── ffmpeg.ts
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── video.types.ts
│   │   └── common.types.ts
│   └── app.ts
├── uploads/
│   ├── temp/
│   ├── processed/
│   └── thumbnails/
├── config/
│   ├── database.ts
│   ├── redis.ts
│   └── storage.ts
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### 3.2 Core Services Implementation

#### Video Processing Service
```typescript
class VideoProcessingService {
  async processVideo(videoId: string, filePath: string): Promise<void> {
    // 1. Validate video file
    // 2. Extract metadata
    // 3. Generate thumbnails
    // 4. Transcode to multiple qualities
    // 5. Generate HLS playlists
    // 6. Update database
  }

  private async transcodeToQuality(
    inputPath: string, 
    outputPath: string, 
    quality: VideoQuality
  ): Promise<void> {
    const ffmpegCommand = this.buildFFmpegCommand(inputPath, outputPath, quality);
    await this.executeFFmpeg(ffmpegCommand);
  }

  private buildFFmpegCommand(
    input: string, 
    output: string, 
    quality: VideoQuality
  ): string[] {
    return [
      '-i', input,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', quality.crf.toString(),
      '-maxrate', `${quality.bitrate}k`,
      '-bufsize', `${quality.bitrate * 2}k`,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'hls',
      '-hls_time', '10',
      '-hls_list_size', '0',
      '-hls_segment_filename', `${output}_%03d.ts`,
      output
    ];
  }
}
```

#### Streaming Service
```typescript
class StreamingService {
  async generateHLSManifest(videoId: string): Promise<string> {
    const variants = await this.getVideoVariants(videoId);
    const manifest = this.buildHLSManifest(variants);
    return manifest;
  }

  private buildHLSManifest(variants: VideoVariant[]): string {
    let manifest = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
    
    variants.forEach(variant => {
      manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bitrate * 1000},RESOLUTION=${variant.resolution_width}x${variant.resolution_height}\n`;
      manifest += `${variant.quality}/playlist.m3u8\n\n`;
    });
    
    return manifest;
  }

  async trackStreamingEvent(
    videoId: string, 
    userId: string, 
    event: StreamingEvent
  ): Promise<void> {
    await this.analyticsService.recordEvent({
      videoId,
      userId,
      eventType: event.type,
      timestamp: new Date(),
      durationWatched: event.durationWatched,
      qualityWatched: event.quality,
      deviceType: event.deviceType,
      browser: event.browser,
      ipAddress: event.ipAddress
    });
  }
}
```

## 4. Frontend Architecture

### 4.1 Project Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── AuthGuard.tsx
│   │   ├── video/
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── VideoUpload.tsx
│   │   │   ├── VideoList.tsx
│   │   │   ├── VideoCard.tsx
│   │   │   └── VideoAnalytics.tsx
│   │   └── layout/
│   │       ├── MainLayout.tsx
│   │       └── DashboardLayout.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useVideo.ts
│   │   ├── useStreaming.ts
│   │   └── useAnalytics.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── auth.service.ts
│   │   ├── video.service.ts
│   │   └── streaming.service.ts
│   ├── store/
│   │   ├── auth.store.ts
│   │   ├── video.store.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── video.types.ts
│   │   └── common.types.ts
│   ├── utils/
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   └── validation.ts
│   └── pages/
│       ├── Home.tsx
│       ├── Login.tsx
│       ├── Register.tsx
│       ├── Dashboard.tsx
│       ├── VideoUpload.tsx
│       ├── VideoPlayer.tsx
│       └── Analytics.tsx
├── public/
│   ├── index.html
│   └── favicon.ico
└── package.json
```

### 4.2 Video Player Component
```typescript
interface VideoPlayerProps {
  videoId: string;
  autoplay?: boolean;
  controls?: boolean;
  onAnalytics?: (event: StreamingEvent) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  autoplay = false,
  controls = true,
  onAnalytics
}) => {
  const [player, setPlayer] = useState<any>(null);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializePlayer = async () => {
      const manifestUrl = await streamingService.getHLSManifest(videoId);
      
      const videoElement = document.getElementById('video-player') as HTMLVideoElement;
      
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });
        
        hls.loadSource(manifestUrl);
        hls.attachMedia(videoElement);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
        });
        
        hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
          const quality = getQualityFromLevel(data.level);
          setCurrentQuality(quality);
          onAnalytics?.({
            type: 'quality_change',
            quality,
            timestamp: Date.now()
          });
        });
        
        setPlayer(hls);
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = manifestUrl;
        setIsLoading(false);
      }
    };

    initializePlayer();
    
    return () => {
      if (player) {
        player.destroy();
      }
    };
  }, [videoId]);

  return (
    <div className="relative w-full h-full bg-black">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}
      <video
        id="video-player"
        className="w-full h-full"
        controls={controls}
        autoPlay={autoplay}
        onPlay={() => onAnalytics?.({ type: 'play', timestamp: Date.now() })}
        onPause={() => onAnalytics?.({ type: 'pause', timestamp: Date.now() })}
        onSeeked={() => onAnalytics?.({ type: 'seek', timestamp: Date.now() })}
        onEnded={() => onAnalytics?.({ type: 'complete', timestamp: Date.now() })}
      />
    </div>
  );
};
```

## 5. Configuration Files

### 5.1 Environment Configuration
```typescript
// config/environment.ts
export const config = {
  port: process.env.PORT || 8001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'video_streaming',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  
  storage: {
    type: process.env.STORAGE_TYPE || 'local', // 'local' | 's3' | 'minio'
    localPath: process.env.LOCAL_STORAGE_PATH || './uploads',
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION,
    s3AccessKey: process.env.S3_ACCESS_KEY,
    s3SecretKey: process.env.S3_SECRET_KEY
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  video: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '1073741824'), // 1GB
    allowedFormats: ['mp4', 'avi', 'mov', 'mkv', 'webm'],
    qualities: [
      { name: '240p', bitrate: 400, crf: 28, width: 426, height: 240 },
      { name: '360p', bitrate: 800, crf: 25, width: 640, height: 360 },
      { name: '480p', bitrate: 1200, crf: 23, width: 854, height: 480 },
      { name: '720p', bitrate: 2500, crf: 21, width: 1280, height: 720 },
      { name: '1080p', bitrate: 5000, crf: 20, width: 1920, height: 1080 }
    ]
  }
};
```

## 6. Security Implementation

### 6.1 Authentication Middleware
```typescript
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    const user = await userService.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Invalid or inactive user' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};
```

### 6.2 Rate Limiting
```typescript
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});

export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 uploads per hour
  message: 'Too many uploads from this IP'
});
```

## 7. Performance Optimization

### 7.1 Caching Strategy
```typescript
// Redis caching for frequently accessed data
export class CacheService {
  async getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
    const cached = await redis.get(`video:${videoId}:metadata`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const metadata = await videoService.getMetadata(videoId);
    await redis.setex(`video:${videoId}:metadata`, 3600, JSON.stringify(metadata));
    return metadata;
  }

  async getHLSManifest(videoId: string): Promise<string | null> {
    const cached = await redis.get(`video:${videoId}:manifest`);
    if (cached) {
      return cached;
    }
    
    const manifest = await streamingService.generateHLSManifest(videoId);
    await redis.setex(`video:${videoId}:manifest`, 1800, manifest);
    return manifest;
  }
}
```

### 7.2 Database Optimization
```sql
-- Indexes for performance
CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_videos_category_id ON videos(category_id);
CREATE INDEX idx_video_variants_video_id ON video_variants(video_id);
CREATE INDEX idx_analytics_video_id ON video_analytics(video_id);
CREATE INDEX idx_analytics_timestamp ON video_analytics(timestamp DESC);

-- Full-text search index
CREATE INDEX idx_videos_search ON videos USING gin(to_tsvector('english', title || ' ' || description));
```

This LLD provides the detailed technical specifications needed to implement the video streaming platform with adaptive bitrate streaming capabilities.
