import { redis } from '../config/redis';
import { Video, VideoVariant, HLSManifest } from '../types/video.types';

export class CacheService {
  private readonly CACHE_TTL = {
    VIDEO_METADATA: 3600, // 1 hour
    VIDEO_VARIANTS: 1800, // 30 minutes
    HLS_MANIFEST: 900, // 15 minutes
    PROCESSING_STATUS: 300, // 5 minutes
    ANALYTICS: 600, // 10 minutes
  };

  // Video metadata caching
  async cacheVideoMetadata(videoId: string, video: Video): Promise<void> {
    const key = `video:metadata:${videoId}`;
    await redis.setex(key, this.CACHE_TTL.VIDEO_METADATA, JSON.stringify(video));
  }

  async getCachedVideoMetadata(videoId: string): Promise<Video | null> {
    const key = `video:metadata:${videoId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateVideoMetadata(videoId: string): Promise<void> {
    const key = `video:metadata:${videoId}`;
    await redis.del(key);
  }

  // Video variants caching
  async cacheVideoVariants(videoId: string, variants: VideoVariant[]): Promise<void> {
    const key = `video:variants:${videoId}`;
    await redis.setex(key, this.CACHE_TTL.VIDEO_VARIANTS, JSON.stringify(variants));
  }

  async getCachedVideoVariants(videoId: string): Promise<VideoVariant[] | null> {
    const key = `video:variants:${videoId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateVideoVariants(videoId: string): Promise<void> {
    const key = `video:variants:${videoId}`;
    await redis.del(key);
  }

  // HLS manifest caching
  async cacheHLSManifest(videoId: string, manifest: HLSManifest): Promise<void> {
    const key = `video:hls:${videoId}`;
    await redis.setex(key, this.CACHE_TTL.HLS_MANIFEST, JSON.stringify(manifest));
  }

  async getCachedHLSManifest(videoId: string): Promise<HLSManifest | null> {
    const key = `video:hls:${videoId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateHLSManifest(videoId: string): Promise<void> {
    const key = `video:hls:${videoId}`;
    await redis.del(key);
  }

  // Processing status caching
  async cacheProcessingStatus(videoId: string, status: any): Promise<void> {
    const key = `video:processing:${videoId}`;
    await redis.setex(key, this.CACHE_TTL.PROCESSING_STATUS, JSON.stringify(status));
  }

  async getCachedProcessingStatus(videoId: string): Promise<any | null> {
    const key = `video:processing:${videoId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateProcessingStatus(videoId: string): Promise<void> {
    const key = `video:processing:${videoId}`;
    await redis.del(key);
  }

  // Analytics caching
  async cacheAnalytics(videoId: string, analytics: any): Promise<void> {
    const key = `video:analytics:${videoId}`;
    await redis.setex(key, this.CACHE_TTL.ANALYTICS, JSON.stringify(analytics));
  }

  async getCachedAnalytics(videoId: string): Promise<any | null> {
    const key = `video:analytics:${videoId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateAnalytics(videoId: string): Promise<void> {
    const key = `video:analytics:${videoId}`;
    await redis.del(key);
  }

  // Streaming session caching
  async cacheStreamingSession(sessionId: string, sessionData: any): Promise<void> {
    const key = `streaming:session:${sessionId}`;
    await redis.setex(key, 1800, JSON.stringify(sessionData)); // 30 minutes
  }

  async getCachedStreamingSession(sessionId: string): Promise<any | null> {
    const key = `streaming:session:${sessionId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async updateStreamingSession(sessionId: string, updates: any): Promise<void> {
    const existing = await this.getCachedStreamingSession(sessionId);
    if (existing) {
      const updated = { ...existing, ...updates, lastUpdated: new Date().toISOString() };
      await this.cacheStreamingSession(sessionId, updated);
    }
  }

  // View count caching (for real-time updates)
  async incrementViewCount(videoId: string): Promise<number> {
    const key = `video:views:${videoId}`;
    return await redis.incr(key);
  }

  async getViewCount(videoId: string): Promise<number> {
    const key = `video:views:${videoId}`;
    const count = await redis.get(key);
    return count ? parseInt(count) : 0;
  }

  async resetViewCount(videoId: string): Promise<void> {
    const key = `video:views:${videoId}`;
    await redis.del(key);
  }

  // Quality selection caching (for adaptive streaming)
  async cacheQualityPreference(userId: string, videoId: string, quality: string): Promise<void> {
    const key = `user:quality:${userId}:${videoId}`;
    await redis.setex(key, 86400, quality); // 24 hours
  }

  async getCachedQualityPreference(userId: string, videoId: string): Promise<string | null> {
    const key = `user:quality:${userId}:${videoId}`;
    return await redis.get(key);
  }

  // Network condition caching
  async cacheNetworkCondition(sessionId: string, condition: any): Promise<void> {
    const key = `network:condition:${sessionId}`;
    await redis.setex(key, 300, JSON.stringify(condition)); // 5 minutes
  }

  async getCachedNetworkCondition(sessionId: string): Promise<any | null> {
    const key = `network:condition:${sessionId}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  // Bulk invalidation
  async invalidateVideoCache(videoId: string): Promise<void> {
    const keys = [
      `video:metadata:${videoId}`,
      `video:variants:${videoId}`,
      `video:hls:${videoId}`,
      `video:processing:${videoId}`,
      `video:analytics:${videoId}`,
      `video:views:${videoId}`,
    ];
    
    await Promise.all(keys.map(key => redis.del(key)));
  }

  // Cache warming
  async warmVideoCache(videoId: string, video: Video, variants: VideoVariant[]): Promise<void> {
    await Promise.all([
      this.cacheVideoMetadata(videoId, video),
      this.cacheVideoVariants(videoId, variants),
    ]);
  }

  // Cache statistics
  async getCacheStats(): Promise<any> {
    const info = await redis.info('memory');
    const keyspace = await redis.info('keyspace');
    const clients = await redis.info('clients');
    
    return {
      memory: info,
      keyspace: keyspace,
      clients: clients,
    };
  }
}

export const cacheService = new CacheService();
