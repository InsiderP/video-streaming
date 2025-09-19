import { Request, Response } from 'express';
import { streamingService } from '../services/streaming.service';
import { ApiResponse } from '../types/common.types';
import { StreamingAnalytics } from '../types/video.types';

export class StreamingController {
  async getHLSManifest(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const manifest = await streamingService.generateHLSManifest(videoId);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
      res.send(manifest);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate manifest',
      };
      res.status(404).json(response);
    }
  }

  async getQualityPlaylist(req: Request, res: Response): Promise<void> {
    try {
      const { videoId, quality } = req.params;
      const playlist = await streamingService.generateQualityPlaylist(videoId, quality);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'public, max-age=60'); // Cache for 1 minute
      res.send(playlist);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate playlist',
      };
      res.status(404).json(response);
    }
  }

  async getVideoSegment(req: Request, res: Response): Promise<void> {
    try {
      const { videoId, quality, segment } = req.params;
      const segmentData = await streamingService.getVideoSegment(videoId, quality, segment);

      if (!segmentData) {
        res.status(404).json({
          success: false,
          error: 'Segment not found',
        });
        return;
      }

      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.send(segmentData);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get segment',
      };
      res.status(404).json(response);
    }
  }

  async trackAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const analyticsData: StreamingAnalytics = {
        videoId,
        userId: req.user?.id,
        eventType: req.body.eventType,
        timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
        durationWatched: req.body.durationWatched,
        qualityWatched: req.body.quality,
        deviceType: req.body.deviceType,
        browser: req.body.browser,
        country: req.body.country,
        ipAddress: req.ip,
      };

      await streamingService.trackStreamingEvent(analyticsData);

      const response: ApiResponse = {
        success: true,
        message: 'Analytics tracked successfully',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track analytics',
      };
      res.status(400).json(response);
    }
  }

  async getRealTimeAnalytics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { videoId } = req.params;
      const analytics = await streamingService.getRealTimeAnalytics(videoId);

      const response: ApiResponse = {
        success: true,
        data: { analytics },
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

  async getStreamingStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { videoId } = req.params;
      const timeRange = req.query.timeRange as string || '24h';
      const stats = await streamingService.getStreamingStats(videoId, timeRange);

      const response: ApiResponse = {
        success: true,
        data: { stats },
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get streaming stats',
      };
      res.status(400).json(response);
    }
  }

  async getOptimalQuality(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const userBandwidth = parseInt(req.query.bandwidth as string) || 1000; // Default to 1Mbps

      const optimalQuality = await streamingService.getOptimalQuality(videoId, userBandwidth);

      const response: ApiResponse = {
        success: true,
        data: { optimalQuality },
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get optimal quality',
      };
      res.status(400).json(response);
    }
  }
}

export const streamingController = new StreamingController();
