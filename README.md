# Video Streaming Platform

A professional video streaming platform with adaptive bitrate streaming capabilities, built with Node.js, Express, React, and TypeScript.

## Features

- **Adaptive Bitrate Streaming**: Automatic quality adjustment based on network conditions
- **Video Upload & Processing**: Support for multiple video formats with automatic transcoding
- **User Management**: Authentication, authorization, and user profiles
- **Content Management**: Video metadata, categorization, and search
- **Analytics**: Viewing statistics and performance metrics
- **Responsive Design**: Cross-platform compatibility

## Technology Stack

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **PostgreSQL** for database
- **Redis** for caching
- **FFmpeg** for video processing
- **JWT** for authentication
- **HLS (HTTP Live Streaming)** protocol

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Query** for state management
- **Zustand** for state management
- **HLS.js** for video playback

## Prerequisites

- Node.js (>= 18.0.0)
- PostgreSQL (>= 13.0)
- Redis (>= 6.0)
- FFmpeg (>= 4.0)

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

Edit the `.env` file with your configuration:
```env
NODE_ENV=development
PORT=8001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=video_streaming
DB_USER=postgres
DB_PASSWORD=your_password
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-super-secret-jwt-key
```

4. Set up the database:
```bash
# Run migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

5. Start the backend server:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Videos
- `GET /api/videos` - Get videos list
- `POST /api/videos` - Create video
- `GET /api/videos/:id` - Get video details
- `PUT /api/videos/:id` - Update video
- `DELETE /api/videos/:id` - Delete video
- `POST /api/videos/:id/upload` - Upload video file

### Streaming
- `GET /api/stream/:videoId/manifest.m3u8` - Get HLS manifest
- `GET /api/stream/:videoId/:quality/playlist.m3u8` - Get quality playlist
- `GET /api/stream/:videoId/:quality/:segment.ts` - Get video segment
- `POST /api/stream/:videoId/analytics` - Track streaming analytics

## Video Processing

The platform automatically processes uploaded videos into multiple quality variants:

- **240p** - 400 kbps
- **360p** - 800 kbps
- **480p** - 1200 kbps
- **720p** - 2500 kbps
- **1080p** - 5000 kbps

## Development

### Backend Development
```bash
# Run in development mode with hot reload
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

### Frontend Development
```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint

# Type checking
npm run type-check
```

## Database Schema

The platform uses PostgreSQL with the following main tables:

- `users` - User accounts and profiles
- `videos` - Video metadata
- `video_variants` - Different quality versions of videos
- `video_analytics` - Streaming analytics data
- `video_comments` - Video comments
- `video_likes` - Video likes/dislikes
- `categories` - Video categories

## Deployment

### Backend Deployment

1. Build the application:
```bash
npm run build
```

2. Set production environment variables
3. Run database migrations
4. Start the application with PM2 or similar process manager

### Frontend Deployment

1. Build the application:
```bash
npm run build
```

2. Deploy the `dist` folder to your web server or CDN

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the GitHub repository.
