# Adaptive Bitrate Streaming Implementation

This document describes the implementation of adaptive bitrate streaming (ABR) in the video streaming platform, featuring AWS MediaConvert integration and Redis caching.

## Features Implemented

### 1. AWS MediaConvert Integration
- **Cloud-based video transcoding** using AWS Elemental MediaConvert
- **Multiple quality levels**: 240p, 360p, 480p, 720p, 1080p
- **HLS (HTTP Live Streaming)** format output
- **Automatic job status monitoring** and progress tracking
- **Fallback to local FFmpeg** when AWS credentials are not configured

### 2. Redis Caching System
- **Video metadata caching** for improved performance
- **HLS manifest caching** to reduce database queries
- **Processing status caching** for real-time updates
- **Streaming session tracking** for analytics
- **Quality preference caching** for user experience

### 3. HLS Adaptive Bitrate Streaming
- **Master playlist generation** with multiple quality variants
- **Automatic quality switching** based on network conditions
- **Segment-based delivery** for smooth playback
- **Cross-browser compatibility** with HLS.js and native Safari support

### 4. Enhanced API Endpoints
- `POST /api/videos/upload-with-transcoding` - Direct upload with transcoding
- `GET /api/stream/:videoId/manifest.m3u8` - HLS master playlist
- `GET /api/stream/:videoId/:quality/playlist.m3u8` - Quality-specific playlist
- `GET /api/stream/:videoId/status` - Processing status with caching
- `GET /api/stream/:videoId/aws-job-status` - AWS job status monitoring

### 5. Frontend Adaptive Player
- **Interactive demo page** similar to the provided HTML
- **Real-time upload and transcoding** visualization
- **Network condition simulation** (Slow 3G, Fast WiFi)
- **Quality switching controls** and status display
- **AWS transcoding process** visualization

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   AWS Services  │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ HLS Player  │ │◄──►│ │ API Routes   │ │◄──►│ │ MediaConvert│ │
│ │ (HLS.js)    │ │    │ │              │ │    │ │             │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│                 │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ ┌─────────────┐ │    │ │ Video Service│ │◄──►│ │ S3 Storage  │ │
│ │ Upload UI   │ │◄──►│ │              │ │    │ │             │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ └─────────────┘ │
│                 │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│                 │    │ │ Redis Cache  │ │    │ │ CloudFront  │ │
│                 │    │ │              │ │    │ │             │ │
│                 │    │ └──────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Setup Instructions

### 1. Backend Setup

#### Install Dependencies
```bash
cd backend
npm install
```

#### Environment Configuration
Copy `env.example` to `.env` and configure:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_MEDIACONVERT_ENDPOINT=https://your-mediaconvert-endpoint.mediaconvert.us-east-1.amazonaws.com
AWS_S3_BUCKET=your-s3-bucket
AWS_CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_streaming
DB_USER=postgres
DB_PASSWORD=password
```

#### Database Migration
```bash
npm run db:migrate
```

#### Start Services
```bash
# Start Redis
redis-server

# Start PostgreSQL
# (Follow your system's instructions)

# Start the backend
npm run dev
```

### 2. Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install
```

#### Start Development Server
```bash
npm run dev
```

### 3. AWS Setup

#### Create IAM Role for MediaConvert
1. Go to AWS IAM Console
2. Create a new role named `MediaConvertRole`
3. Attach the following policies:
   - `MediaConvertServiceRole`
   - Custom policy for S3 access to your bucket

#### Configure MediaConvert
1. Go to AWS MediaConvert Console
2. Note your account-specific endpoint URL
3. Update the `AWS_MEDIACONVERT_ENDPOINT` in your `.env` file

#### S3 Bucket Setup
1. Create an S3 bucket for video storage
2. Configure CORS policy for web access
3. Set up CloudFront distribution (optional but recommended)

## Usage

### 1. Upload Video with Transcoding

```bash
curl -X POST http://localhost:8001/api/videos/upload-with-transcoding \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "video=@your-video.mp4" \
  -F "title=My Video" \
  -F "description=Test video" \
  -F "visibility=public"
```

### 2. Get HLS Manifest

```bash
curl http://localhost:8001/api/stream/VIDEO_ID/manifest.m3u8
```

### 3. Check Processing Status

```bash
curl http://localhost:8001/api/stream/VIDEO_ID/status
```

### 4. Access Frontend Demo

Navigate to `http://localhost:3001/adaptive-streaming` to see the interactive demo.

## Quality Levels

The system automatically creates the following quality variants:

| Quality | Resolution | Bitrate | Use Case |
|---------|------------|---------|----------|
| 240p    | 426x240    | 400kbps | Mobile, slow connections |
| 360p    | 640x360    | 800kbps | Mobile, moderate connections |
| 480p    | 854x480    | 1200kbps| Standard definition |
| 720p    | 1280x720   | 2500kbps| High definition |
| 1080p   | 1920x1080  | 5000kbps| Full HD |

## Adaptive Streaming Algorithm

The HLS player automatically:

1. **Monitors network conditions** and buffer health
2. **Switches quality levels** based on available bandwidth
3. **Prefers higher quality** when bandwidth is sufficient
4. **Drops to lower quality** to prevent buffering
5. **Maintains smooth playback** with minimal interruptions

## Caching Strategy

### Redis Cache TTLs
- **Video metadata**: 1 hour
- **Video variants**: 30 minutes
- **HLS manifests**: 15 minutes
- **Processing status**: 5 minutes
- **Analytics data**: 10 minutes

### Cache Invalidation
- Automatic invalidation on video updates
- Manual cache warming for popular content
- Real-time updates for processing status

## Performance Optimizations

1. **CDN Integration**: CloudFront for global content delivery
2. **Redis Caching**: Reduced database load and faster responses
3. **HLS Segmentation**: 10-second segments for optimal streaming
4. **Adaptive Bitrate**: Automatic quality adjustment
5. **Background Processing**: Non-blocking video transcoding

## Monitoring and Analytics

### Real-time Metrics
- Processing job status
- Quality switching events
- Buffer health monitoring
- Network condition tracking

### Analytics Events
- Video play/pause/seek events
- Quality level changes
- Completion rates
- Device and browser statistics

## Troubleshooting

### Common Issues

1. **AWS MediaConvert Job Fails**
   - Check IAM role permissions
   - Verify S3 bucket access
   - Ensure input video format is supported

2. **HLS Playback Issues**
   - Verify CORS configuration
   - Check segment file accessibility
   - Ensure proper MIME types

3. **Redis Connection Issues**
   - Verify Redis server is running
   - Check connection credentials
   - Monitor Redis memory usage

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

## Future Enhancements

1. **DASH Support**: Add MPEG-DASH format support
2. **Low Latency**: Implement LL-HLS for reduced latency
3. **AI Quality**: Machine learning-based quality selection
4. **Edge Processing**: Lambda@Edge for global processing
5. **Analytics Dashboard**: Real-time streaming analytics

## API Documentation

### Streaming Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stream/:videoId/manifest.m3u8` | GET | HLS master playlist |
| `/api/stream/:videoId/:quality/playlist.m3u8` | GET | Quality-specific playlist |
| `/api/stream/:videoId/:quality/:segment.ts` | GET | Video segment |
| `/api/stream/:videoId/status` | GET | Processing status |
| `/api/stream/:videoId/aws-job-status` | GET | AWS job status |
| `/api/stream/:videoId/track` | POST | Track streaming events |
| `/api/stream/:videoId/analytics` | GET | Streaming analytics |

### Video Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/videos/upload-with-transcoding` | POST | Upload with transcoding |
| `/api/videos/:id/upload` | POST | Upload to existing video |
| `/api/videos/:id/processing-status` | GET | Processing status |

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review AWS MediaConvert documentation
3. Check Redis and database connectivity
4. Verify environment configuration

## License

This implementation is part of the video streaming platform and follows the same license terms.
