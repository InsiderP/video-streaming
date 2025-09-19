import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { db } from '../config/database';
import { config } from '../config/environment';
import { 
  Video, 
  VideoVariant, 
  CreateVideoRequest, 
  UpdateVideoRequest, 
  VideoListQuery,
  VideoProcessingStatus,
  VideoAnalytics,
  VideoComment,
  CreateCommentRequest,
  VideoLike,
  HLSManifest
} from '../types/video.types';
import { VideoStatus, VideoQuality, PaginationMeta } from '../types/common.types';
import { VideoProcessingService } from './video-processing.service';

export class VideoService {
  private processingService = new VideoProcessingService();

  async createVideo(userId: string, videoData: CreateVideoRequest): Promise<Video> {
    const { title, description, categoryId, tags, visibility } = videoData;

    const [video] = await db('videos')
      .insert({
        title,
        description,
        user_id: userId,
        category_id: categoryId,
        tags: tags || [],
        visibility,
        status: 'uploading',
      })
      .returning('*');

    return this.mapVideoFromDb(video);
  }

  async updateVideo(videoId: string, userId: string, videoData: UpdateVideoRequest): Promise<Video> {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (videoData.title !== undefined) updateData.title = videoData.title;
    if (videoData.description !== undefined) updateData.description = videoData.description;
    if (videoData.categoryId !== undefined) updateData.category_id = videoData.categoryId;
    if (videoData.tags !== undefined) updateData.tags = videoData.tags;
    if (videoData.visibility !== undefined) updateData.visibility = videoData.visibility;

    const [video] = await db('videos')
      .where({ id: videoId, user_id: userId })
      .update(updateData)
      .returning('*');

    if (!video) {
      throw new Error('Video not found or access denied');
    }

    return this.mapVideoFromDb(video);
  }

  async deleteVideo(videoId: string, userId: string): Promise<void> {
    const video = await db('videos')
      .where({ id: videoId, user_id: userId })
      .first();

    if (!video) {
      throw new Error('Video not found or access denied');
    }

    // Delete video files
    await this.deleteVideoFiles(videoId);

    // Update status to deleted
    await db('videos')
      .where({ id: videoId })
      .update({ status: 'deleted', updated_at: new Date() });
  }

  async getVideoById(videoId: string, userId?: string): Promise<Video | null> {
    const video = await db('videos')
      .select(
        'videos.*',
        'users.username',
        'users.avatar_url as user_avatar_url',
        'categories.name as category_name'
      )
      .leftJoin('users', 'videos.user_id', 'users.id')
      .leftJoin('categories', 'videos.category_id', 'categories.id')
      .where('videos.id', videoId)
      .first();

    if (!video) {
      return null;
    }

    // Check visibility
    if (video.visibility === 'private' && video.user_id !== userId) {
      throw new Error('Video is private');
    }

    // Get variants
    const variants = await this.getVideoVariants(videoId);

    return {
      ...this.mapVideoFromDb(video),
      user: {
        id: video.user_id,
        username: video.username,
        avatarUrl: video.user_avatar_url,
      },
      category: video.category_id ? {
        id: video.category_id,
        name: video.category_name,
      } : undefined,
      variants,
    };
  }

  async getVideos(query: VideoListQuery): Promise<{ videos: Video[]; pagination: PaginationMeta }> {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sortBy = 'created_at',
      sortOrder = 'desc',
      userId,
      status = 'ready',
      visibility = 'public',
    } = query;

    const offset = (page - 1) * limit;

    let queryBuilder = db('videos')
      .select(
        'videos.*',
        'users.username',
        'users.avatar_url as user_avatar_url',
        'categories.name as category_name'
      )
      .leftJoin('users', 'videos.user_id', 'users.id')
      .leftJoin('categories', 'videos.category_id', 'categories.id')
      .where('videos.status', status)
      .where('videos.visibility', visibility);

    // Apply filters
    if (category) {
      queryBuilder = queryBuilder.where('videos.category_id', category);
    }

    if (userId) {
      queryBuilder = queryBuilder.where('videos.user_id', userId);
    }

    if (search) {
      queryBuilder = queryBuilder.whereRaw(
        "to_tsvector('english', videos.title || ' ' || COALESCE(videos.description, '')) @@ plainto_tsquery('english', ?)",
        [search]
      );
    }

    // Apply sorting
    queryBuilder = queryBuilder.orderBy(`videos.${sortBy}`, sortOrder);

    // Get total count
    const totalQuery = queryBuilder.clone().count('* as count').first();
    const totalResult = await totalQuery;
    const total = totalResult?.count || 0;

    // Get paginated results
    const videos = await queryBuilder.limit(limit).offset(offset);

    const mappedVideos = videos.map(video => ({
      ...this.mapVideoFromDb(video),
      user: {
        id: video.user_id,
        username: video.username,
        avatarUrl: video.user_avatar_url,
      },
      category: video.category_id ? {
        id: video.category_id,
        name: video.category_name,
      } : undefined,
    }));

    const pagination: PaginationMeta = {
      page,
      limit,
      total: parseInt(total as string),
      totalPages: Math.ceil(parseInt(total as string) / limit),
      hasNext: page < Math.ceil(parseInt(total as string) / limit),
      hasPrev: page > 1,
    };

    return { videos: mappedVideos, pagination };
  }

  async uploadVideoFile(videoId: string, filePath: string, originalFilename: string, fileSize: number): Promise<void> {
    // Update video with file information
    await db('videos')
      .where({ id: videoId })
      .update({
        original_filename: originalFilename,
        file_size: fileSize,
        status: 'processing',
        updated_at: new Date(),
      });

    // Start video processing
    await this.processingService.processVideo(videoId, filePath);
  }

  async getVideoProcessingStatus(videoId: string): Promise<VideoProcessingStatus> {
    const video = await db('videos')
      .where({ id: videoId })
      .first();

    if (!video) {
      throw new Error('Video not found');
    }

    const variants = await this.getVideoVariants(videoId);

    return {
      videoId,
      status: video.status,
      progress: this.calculateProcessingProgress(video.status, variants.length),
      error: video.status === 'failed' ? 'Processing failed' : undefined,
      variants,
    };
  }

  async getVideoVariants(videoId: string): Promise<VideoVariant[]> {
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

  async generateHLSManifest(videoId: string): Promise<HLSManifest> {
    const variants = await this.getVideoVariants(videoId);

    if (variants.length === 0) {
      throw new Error('No video variants found');
    }

    const manifest: HLSManifest = {
      version: 3,
      variants: variants.map(variant => ({
        bandwidth: variant.bitrate * 1000,
        resolution: `${variant.resolutionWidth}x${variant.resolutionHeight}`,
        playlistUrl: variant.hlsPlaylistUrl || `/api/stream/${videoId}/${variant.quality}/playlist.m3u8`,
      })),
    };

    return manifest;
  }

  async incrementViewCount(videoId: string): Promise<void> {
    await db('videos')
      .where({ id: videoId })
      .increment('view_count', 1);
  }

  async addComment(videoId: string, userId: string, commentData: CreateCommentRequest): Promise<VideoComment> {
    const { content, parentId } = commentData;

    const [comment] = await db('video_comments')
      .insert({
        video_id: videoId,
        user_id: userId,
        content,
        parent_id: parentId,
      })
      .returning('*');

    // Get user information
    const user = await db('users')
      .select('id', 'username', 'avatar_url')
      .where({ id: userId })
      .first();

    return {
      id: comment.id,
      videoId: comment.video_id,
      userId: comment.user_id,
      content: comment.content,
      parentId: comment.parent_id,
      isEdited: comment.is_edited,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar_url,
      },
    };
  }

  async getComments(videoId: string, page: number = 1, limit: number = 20): Promise<VideoComment[]> {
    const offset = (page - 1) * limit;

    const comments = await db('video_comments')
      .select(
        'video_comments.*',
        'users.username',
        'users.avatar_url'
      )
      .leftJoin('users', 'video_comments.user_id', 'users.id')
      .where('video_comments.video_id', videoId)
      .whereNull('video_comments.parent_id')
      .orderBy('video_comments.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return comments.map(comment => ({
      id: comment.id,
      videoId: comment.video_id,
      userId: comment.user_id,
      content: comment.content,
      parentId: comment.parent_id,
      isEdited: comment.is_edited,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: {
        id: comment.user_id,
        username: comment.username,
        avatarUrl: comment.avatar_url,
      },
    }));
  }

  async toggleLike(videoId: string, userId: string, isLike: boolean): Promise<VideoLike> {
    // Check if like already exists
    const existingLike = await db('video_likes')
      .where({ video_id: videoId, user_id: userId })
      .first();

    if (existingLike) {
      // Update existing like
      const [like] = await db('video_likes')
        .where({ id: existingLike.id })
        .update({ is_like: isLike, updated_at: new Date() })
        .returning('*');

      return this.mapLikeFromDb(like);
    } else {
      // Create new like
      const [like] = await db('video_likes')
        .insert({
          video_id: videoId,
          user_id: userId,
          is_like: isLike,
        })
        .returning('*');

      return this.mapLikeFromDb(like);
    }
  }

  async getVideoAnalytics(videoId: string): Promise<VideoAnalytics> {
    // Get basic video stats
    const video = await db('videos')
      .select('view_count', 'like_count')
      .where({ id: videoId })
      .first();

    if (!video) {
      throw new Error('Video not found');
    }

    // Get analytics data
    const analytics = await db('video_analytics')
      .where({ video_id: videoId });

    const totalViews = video.view_count;
    const uniqueViewers = new Set(analytics.map(a => a.user_id)).size;
    const totalWatchTime = analytics.reduce((sum, a) => sum + (a.duration_watched || 0), 0);
    const averageWatchTime = totalViews > 0 ? totalWatchTime / totalViews : 0;
    const completionRate = totalViews > 0 ? (analytics.filter(a => a.event_type === 'complete').length / totalViews) * 100 : 0;

    // Quality distribution
    const qualityDistribution = analytics.reduce((acc, a) => {
      if (a.quality_watched) {
        acc[a.quality_watched] = (acc[a.quality_watched] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Device distribution
    const deviceDistribution = analytics.reduce((acc, a) => {
      if (a.device_type) {
        acc[a.device_type] = (acc[a.device_type] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Browser distribution
    const browserDistribution = analytics.reduce((acc, a) => {
      if (a.browser) {
        acc[a.browser] = (acc[a.browser] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Country distribution
    const countryDistribution = analytics.reduce((acc, a) => {
      if (a.country) {
        acc[a.country] = (acc[a.country] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Daily views (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyViews = await db('video_analytics')
      .select(db.raw('DATE(timestamp) as date'))
      .count('* as views')
      .where({ video_id: videoId })
      .where('timestamp', '>=', thirtyDaysAgo)
      .groupBy(db.raw('DATE(timestamp)'))
      .orderBy('date', 'asc');

    return {
      videoId,
      totalViews,
      uniqueViewers,
      averageWatchTime,
      completionRate,
      qualityDistribution,
      deviceDistribution,
      browserDistribution,
      countryDistribution,
      dailyViews: dailyViews.map((d: any) => ({
        date: d.date,
        views: parseInt(d.views as string),
      })),
    };
  }

  private async deleteVideoFiles(videoId: string): Promise<void> {
    const variants = await this.getVideoVariants(videoId);
    
    for (const variant of variants) {
      try {
        await fs.unlink(variant.filePath);
      } catch (error) {
        console.error(`Failed to delete file ${variant.filePath}:`, error);
      }
    }
  }

  private calculateProcessingProgress(status: VideoStatus, variantCount: number): number {
    switch (status) {
      case 'uploading':
        return 10;
      case 'processing':
        return Math.min(10 + (variantCount * 15), 90);
      case 'ready':
        return 100;
      case 'failed':
        return 0;
      default:
        return 0;
    }
  }

  private mapVideoFromDb(video: any): Video {
    return {
      id: video.id,
      title: video.title,
      description: video.description,
      userId: video.user_id,
      originalFilename: video.original_filename,
      fileSize: video.file_size,
      duration: video.duration,
      thumbnailUrl: video.thumbnail_url,
      status: video.status,
      visibility: video.visibility,
      categoryId: video.category_id,
      tags: video.tags,
      viewCount: video.view_count,
      likeCount: video.like_count,
      createdAt: video.created_at,
      updatedAt: video.updated_at,
    };
  }

  private mapLikeFromDb(like: any): VideoLike {
    return {
      id: like.id,
      videoId: like.video_id,
      userId: like.user_id,
      isLike: like.is_like,
      createdAt: like.created_at,
      updatedAt: like.updated_at,
    };
  }
}

export const videoService = new VideoService();
