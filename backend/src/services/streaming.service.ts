import { db } from '../config/database';
import { redis } from '../config/redis';
import { config } from '../config/environment';
import { 
  HLSManifest, 
  StreamingAnalytics,
  VideoVariant 
} from '../types/video.types';
import { AnalyticsEvent } from '../types/common.types';

export class StreamingService {
  async generateHLSManifest(videoId: string): Promise<string> {
    // Check cache first
    const cachedManifest = await redis.get(`manifest:${videoId}`);
    if (cachedManifest) {
      return cachedManifest;
    }

    // Get video variants
    const variants = await this.getVideoVariants(videoId);
    
    if (variants.length === 0) {
      throw new Error('No video variants found');
    }

    // Generate HLS master playlist
    let manifest = '#EXTM3U\n#EXT-X-VERSION:3\n\n';
    
    variants.forEach(variant => {
      manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bitrate * 1000},RESOLUTION=${variant.resolutionWidth}x${variant.resolutionHeight}\n`;
      manifest += `${variant.quality}/playlist.m3u8\n\n`;
    });

    // Cache manifest for 30 minutes
    await redis.setex(`manifest:${videoId}`, 1800, manifest);

    return manifest;
  }

  async generateQualityPlaylist(videoId: string, quality: string): Promise<string> {
    // Check cache first
    const cacheKey = `playlist:${videoId}:${quality}`;
    const cachedPlaylist = await redis.get(cacheKey);
    if (cachedPlaylist) {
      return cachedPlaylist;
    }

    // Get variant info
    const variant = await db('video_variants')
      .where({ video_id: videoId, quality })
      .first();

    if (!variant) {
      throw new Error(`Quality ${quality} not found for video ${videoId}`);
    }

    // For now, return a simple playlist pointing to the HLS file
    // In a real implementation, you would read the actual HLS file and serve it
    const playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:10.0,
${quality}_000.ts
#EXTINF:10.0,
${quality}_001.ts
#EXT-X-ENDLIST`;

    // Cache playlist for 10 minutes
    await redis.setex(cacheKey, 600, playlist);

    return playlist;
  }

  async getVideoSegment(videoId: string, quality: string, segment: string): Promise<Buffer | null> {
    try {
      const segmentPath = `${config.storage.localPath}/processed/${videoId}/${quality}_${segment}.ts`;
      const fs = require('fs');
      
      if (fs.existsSync(segmentPath)) {
        return fs.readFileSync(segmentPath);
      }
      
      return null;
    } catch (error) {
      console.error(`Error reading segment ${segment} for video ${videoId}:`, error);
      return null;
    }
  }

  async trackStreamingEvent(analytics: StreamingAnalytics): Promise<void> {
    try {
      // Insert analytics event
      await db('video_analytics').insert({
        video_id: analytics.videoId,
        user_id: analytics.userId,
        event_type: analytics.eventType,
        timestamp: analytics.timestamp,
        duration_watched: analytics.durationWatched,
        quality_watched: analytics.qualityWatched,
        device_type: analytics.deviceType,
        browser: analytics.browser,
        country: analytics.country,
        ip_address: analytics.ipAddress,
      });

      // Update real-time analytics in Redis
      await this.updateRealTimeAnalytics(analytics);

      // Increment view count for play events
      if (analytics.eventType === 'play') {
        await this.incrementViewCount(analytics.videoId);
      }
    } catch (error) {
      console.error('Failed to track streaming event:', error);
    }
  }

  private async updateRealTimeAnalytics(analytics: StreamingAnalytics): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();

    // Update daily view count
    await redis.incr(`analytics:${analytics.videoId}:views:${today}`);
    
    // Update hourly view count
    await redis.incr(`analytics:${analytics.videoId}:views:${today}:${hour}`);
    
    // Update quality distribution
    if (analytics.qualityWatched) {
      await redis.incr(`analytics:${analytics.videoId}:quality:${analytics.qualityWatched}:${today}`);
    }
    
    // Update device distribution
    if (analytics.deviceType) {
      await redis.incr(`analytics:${analytics.videoId}:device:${analytics.deviceType}:${today}`);
    }

    // Set expiration for analytics keys (30 days)
    await redis.expire(`analytics:${analytics.videoId}:views:${today}`, 2592000);
    await redis.expire(`analytics:${analytics.videoId}:views:${today}:${hour}`, 2592000);
  }

  private async incrementViewCount(videoId: string): Promise<void> {
    await db('videos')
      .where({ id: videoId })
      .increment('view_count', 1);
  }

  private async getVideoVariants(videoId: string): Promise<VideoVariant[]> {
    const variants = await db('video_variants')
      .where({ video_id: videoId })
      .orderBy('bitrate', 'desc');

    return variants.map(variant => ({
      id: variant.id,
      videoId: variant.video_id,
      quality: variant.quality,
      bitrate: variant.bitrate,
      resolutionWidth: variant.resolution_width,
      resolutionHeight: variant.resolution_height,
      filePath: variant.file_path,
      fileSize: variant.file_size,
      hlsPlaylistUrl: variant.hls_playlist_url,
      dashManifestUrl: variant.dash_manifest_url,
      createdAt: variant.created_at,
    }));
  }

  async getRealTimeAnalytics(videoId: string): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's view count
    const todayViews = await redis.get(`analytics:${videoId}:views:${today}`) || '0';
    
    // Get hourly views for today
    const hourlyViews = [];
    for (let hour = 0; hour < 24; hour++) {
      const views = await redis.get(`analytics:${videoId}:views:${today}:${hour}`) || '0';
      hourlyViews.push({
        hour,
        views: parseInt(views),
      });
    }

    // Get quality distribution
    const qualityKeys = await redis.keys(`analytics:${videoId}:quality:*:${today}`);
    const qualityDistribution: Record<string, number> = {};
    for (const key of qualityKeys) {
      const quality = key.split(':')[3];
      const views = await redis.get(key) || '0';
      qualityDistribution[quality] = parseInt(views);
    }

    // Get device distribution
    const deviceKeys = await redis.keys(`analytics:${videoId}:device:*:${today}`);
    const deviceDistribution: Record<string, number> = {};
    for (const key of deviceKeys) {
      const device = key.split(':')[3];
      const views = await redis.get(key) || '0';
      deviceDistribution[device] = parseInt(views);
    }

    return {
      videoId,
      todayViews: parseInt(todayViews),
      hourlyViews,
      qualityDistribution,
      deviceDistribution,
    };
  }

  async getOptimalQuality(videoId: string, userBandwidth: number): Promise<string> {
    const variants = await this.getVideoVariants(videoId);
    
    // Find the highest quality that fits within the user's bandwidth
    // Leave some headroom (80% of available bandwidth)
    const targetBitrate = userBandwidth * 0.8;
    
    let optimalQuality = variants[0]?.quality || '360p';
    
    for (const variant of variants) {
      if (variant.bitrate <= targetBitrate) {
        optimalQuality = variant.quality;
      } else {
        break;
      }
    }
    
    return optimalQuality;
  }

  async getStreamingStats(videoId: string, timeRange: string = '24h'): Promise<any> {
    const now = new Date();
    let startTime: Date;
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const stats = await db('video_analytics')
      .select('event_type')
      .count('* as count')
      .where({ video_id: videoId })
      .where('timestamp', '>=', startTime)
      .groupBy('event_type');

    const eventCounts = stats.reduce((acc, stat) => {
      acc[stat.event_type] = parseInt(stat.count as string);
      return acc;
    }, {} as Record<string, number>);

    return {
      videoId,
      timeRange,
      startTime,
      endTime: now,
      events: eventCounts,
      totalEvents: Object.values(eventCounts).reduce((sum: number, count: string | number) => sum + Number(count), 0),
    };
  }
}

export const streamingService = new StreamingService();
