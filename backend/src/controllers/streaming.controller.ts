import { Request, Response } from 'express';
import { videoService } from '../services/video.service';
import { videoProcessingService } from '../services/video-processing.service';
import { cacheService } from '../services/cache.service';
import { ApiResponse } from '../types/common.types';
import { HLSManifest } from '../types/video.types';

export class StreamingController {
  async getHLSManifest(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      
      // Check if video exists and is ready
      const video = await videoService.getVideoById(videoId);
      if (!video) {
        const response: ApiResponse = {
          success: false,
          error: 'Video not found',
        };
        res.status(404).json(response);
        return;
      }

      if (video.status !== 'ready') {
        const response: ApiResponse = {
          success: false,
          error: 'Video is not ready for streaming',
        };
        res.status(400).json(response);
        return;
      }

      // Generate HLS manifest
      const manifest = await videoService.generateHLSManifest(videoId);

      // Set appropriate headers for HLS
      res.set({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range',
      });

      // Convert manifest to M3U8 format
      const m3u8Content = this.generateM3U8Content(manifest);
      res.send(m3u8Content);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get HLS manifest',
      };
      res.status(400).json(response);
    }
  }

  async getHLSPlaylist(req: Request, res: Response): Promise<void> {
    try {
      const { videoId, quality } = req.params;
      
      // Get video variants
      const variants = await videoService.getVideoVariants(videoId);
      const variant = variants.find(v => v.quality === quality);

      if (!variant) {
        const response: ApiResponse = {
          success: false,
          error: 'Quality variant not found',
        };
        res.status(404).json(response);
        return;
      }

      // If we have a direct HLS playlist URL (from AWS), redirect to it
      if (variant.hlsPlaylistUrl && variant.hlsPlaylistUrl.startsWith('http')) {
        res.redirect(variant.hlsPlaylistUrl);
        return;
      }

      // For local files, serve the playlist file
      const fs = await import('fs');
      const path = await import('path');
      
      const playlistPath = path.join(process.cwd(), 'uploads', 'processed', videoId, `${quality}.m3u8`);
      
      if (!fs.existsSync(playlistPath)) {
        const response: ApiResponse = {
          success: false,
          error: 'Playlist file not found',
        };
        res.status(404).json(response);
        return;
      }

      const playlistContent = fs.readFileSync(playlistPath, 'utf8');
      
      res.set({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=10', // Short cache for playlists
        'Access-Control-Allow-Origin': '*',
      });

      res.send(playlistContent);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get HLS playlist',
      };
      res.status(400).json(response);
    }
  }

  async getVideoSegment(req: Request, res: Response): Promise<void> {
    try {
      const { videoId, quality, segment } = req.params;
      
      // For AWS S3 hosted content, redirect to CloudFront/S3
      const variants = await videoService.getVideoVariants(videoId);
      const variant = variants.find(v => v.quality === quality);

      if (variant && variant.hlsPlaylistUrl && variant.hlsPlaylistUrl.startsWith('http')) {
        const segmentUrl = variant.hlsPlaylistUrl.replace('.m3u8', `_${segment}.ts`);
        res.redirect(segmentUrl);
        return;
      }

      // For local files, serve the segment
      const fs = await import('fs');
      const path = await import('path');
      
      const segmentPath = path.join(process.cwd(), 'uploads', 'processed', videoId, `${quality}_${segment}.ts`);
      
      if (!fs.existsSync(segmentPath)) {
        const response: ApiResponse = {
          success: false,
          error: 'Video segment not found',
        };
        res.status(404).json(response);
        return;
      }

      const segmentContent = fs.readFileSync(segmentPath);
      
      res.set({
        'Content-Type': 'video/mp2t',
        'Cache-Control': 'public, max-age=86400', // 24 hours cache for segments
        'Access-Control-Allow-Origin': '*',
      });

      res.send(segmentContent);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get video segment',
      };
      res.status(400).json(response);
    }
  }

  async getProcessingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      
      // Try to get from cache first
      const cachedStatus = await cacheService.getCachedProcessingStatus(videoId);
      if (cachedStatus) {
        const response: ApiResponse = {
          success: true,
          data: cachedStatus,
        };
        res.json(response);
        return;
      }

      // Get from database
      const status = await videoService.getVideoProcessingStatus(videoId);
      
      // Cache the status
      await cacheService.cacheProcessingStatus(videoId, status);

      const response: ApiResponse = {
        success: true,
        data: status,
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get processing status',
      };
      res.status(400).json(response);
    }
  }

  async checkAWSJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      
      const jobStatus = await videoProcessingService.checkAWSJobStatus(videoId);

      const response: ApiResponse = {
        success: true,
        data: jobStatus,
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check job status',
      };
      res.status(400).json(response);
    }
  }

  async trackStreamingEvent(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const eventData = req.body;
      const sessionId = req.headers['x-session-id'] as string;

      // Track the streaming event
      await this.trackEvent(videoId, sessionId, eventData);

      const response: ApiResponse = {
        success: true,
        message: 'Event tracked successfully',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track event',
      };
      res.status(400).json(response);
    }
  }

  async getStreamingAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const sessionId = req.headers['x-session-id'] as string;

      // Get cached analytics
      const analytics = await cacheService.getCachedAnalytics(videoId);
      
      if (analytics) {
        const response: ApiResponse = {
          success: true,
          data: analytics,
        };
        res.json(response);
        return;
      }

      // Get from database
      const dbAnalytics = await videoService.getVideoAnalytics(videoId);
      
      // Cache the analytics
      await cacheService.cacheAnalytics(videoId, dbAnalytics);

      const response: ApiResponse = {
        success: true,
        data: dbAnalytics,
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get analytics',
      };
      res.status(400).json(response);
    }
  }

  private generateM3U8Content(manifest: HLSManifest): string {
    let content = '#EXTM3U\n';
    content += '#EXT-X-VERSION:3\n\n';

    manifest.variants.forEach(variant => {
      content += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.resolution}\n`;
      content += `${variant.playlistUrl}\n\n`;
    });

    return content;
  }

  private async trackEvent(videoId: string, sessionId: string, eventData: any): Promise<void> {
    // Store streaming session data
    const sessionData = {
      videoId,
      sessionId,
      eventType: eventData.eventType,
      timestamp: new Date().toISOString(),
      duration: eventData.duration,
      quality: eventData.quality,
      deviceType: eventData.deviceType,
      browser: eventData.browser,
      country: eventData.country,
    };

    await cacheService.cacheStreamingSession(sessionId, sessionData);

    // Update analytics in database (batch this for performance)
    // This would typically be done asynchronously
  }
}

export const streamingController = new StreamingController();