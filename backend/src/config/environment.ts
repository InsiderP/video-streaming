import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8001'),
  host: process.env.HOST || 'localhost',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'video_streaming',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  
  storage: {
    type: (process.env.STORAGE_TYPE || 'local') as 'local' | 's3' | 'minio',
    localPath: process.env.LOCAL_STORAGE_PATH || './uploads',
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION || 'us-east-1',
    s3AccessKey: process.env.S3_ACCESS_KEY,
    s3SecretKey: process.env.S3_SECRET_KEY,
    s3Endpoint: process.env.S3_ENDPOINT,
    minioEndpoint: process.env.MINIO_ENDPOINT || 'localhost',
    minioPort: parseInt(process.env.MINIO_PORT || '9000'),
    minioAccessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    minioSecretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    minioUseSSL: process.env.MINIO_USE_SSL === 'true',
  },
  
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    mediaConvertEndpoint: process.env.AWS_MEDIACONVERT_ENDPOINT,
    s3Bucket: process.env.AWS_S3_BUCKET,
    cloudFrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  video: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '1073741824'), // 1GB
    allowedFormats: (process.env.ALLOWED_VIDEO_FORMATS || 'mp4,avi,mov,mkv,webm').split(','),
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
    ffprobePath: process.env.FFPROBE_PATH || 'ffprobe',
    qualities: [
      { name: '240p', bitrate: 400, crf: 28, width: 426, height: 240 },
      { name: '360p', bitrate: 800, crf: 25, width: 640, height: 360 },
      { name: '480p', bitrate: 1200, crf: 23, width: 854, height: 480 },
      { name: '720p', bitrate: 2500, crf: 21, width: 1280, height: 720 },
      { name: '1080p', bitrate: 5000, crf: 20, width: 1920, height: 1080 },
    ],
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    uploadWindowMs: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || '3600000'), // 1 hour
    uploadMaxRequests: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX_REQUESTS || '10'),
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },
  
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: parseInt(process.env.SMTP_PORT || '587'),
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromEmail: process.env.FROM_EMAIL || 'noreply@videostreaming.com',
  },
  
  analytics: {
    retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '365'),
    batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '1000'),
  },
  
  cdn: {
    url: process.env.CDN_URL,
    cacheTtl: parseInt(process.env.CDN_CACHE_TTL || '3600'),
  },
};

export default config;
