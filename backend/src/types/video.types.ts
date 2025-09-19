import { VideoStatus, VisibilityType, AnalyticsEvent, VideoQuality } from './common.types';

export interface Video {
  id: string;
  title: string;
  description?: string;
  userId: string;
  originalFilename?: string;
  fileSize?: number;
  duration?: number;
  thumbnailUrl?: string;
  status: VideoStatus;
  visibility: VisibilityType;
  categoryId?: string;
  tags?: string[];
  viewCount: number;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  category?: {
    id: string;
    name: string;
  };
  variants?: VideoVariant[];
}

export interface VideoVariant {
  id: string;
  videoId: string;
  quality: string;
  bitrate: number;
  resolutionWidth: number;
  resolutionHeight: number;
  filePath: string;
  fileSize?: number;
  hlsPlaylistUrl?: string;
  dashManifestUrl?: string;
  createdAt: Date;
}

export interface CreateVideoRequest {
  title: string;
  description?: string;
  categoryId?: string;
  tags?: string[];
  visibility: VisibilityType;
}

export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  categoryId?: string;
  tags?: string[];
  visibility?: VisibilityType;
}

export interface VideoListQuery {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sortBy?: 'created_at' | 'view_count' | 'title' | 'like_count';
  sortOrder?: 'asc' | 'desc';
  userId?: string;
  status?: VideoStatus;
  visibility?: VisibilityType;
}

export interface VideoUploadResponse {
  videoId: string;
  uploadUrl: string;
  expiresAt: Date;
}

export interface VideoProcessingStatus {
  videoId: string;
  status: VideoStatus;
  progress: number;
  error?: string;
  variants?: VideoVariant[];
}

export interface VideoAnalytics {
  videoId: string;
  totalViews: number;
  uniqueViewers: number;
  averageWatchTime: number;
  completionRate: number;
  qualityDistribution: Record<string, number>;
  deviceDistribution: Record<string, number>;
  browserDistribution: Record<string, number>;
  countryDistribution: Record<string, number>;
  dailyViews: Array<{
    date: string;
    views: number;
  }>;
}

export interface VideoComment {
  id: string;
  videoId: string;
  userId: string;
  content: string;
  parentId?: string;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  replies?: VideoComment[];
}

export interface CreateCommentRequest {
  content: string;
  parentId?: string;
}

export interface VideoLike {
  id: string;
  videoId: string;
  userId: string;
  isLike: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HLSManifest {
  version: number;
  variants: Array<{
    bandwidth: number;
    resolution: string;
    playlistUrl: string;
  }>;
}

export interface StreamingAnalytics {
  videoId: string;
  userId?: string;
  eventType: AnalyticsEvent;
  timestamp: Date;
  durationWatched?: number;
  qualityWatched?: string;
  deviceType?: string;
  browser?: string;
  country?: string;
  ipAddress?: string;
}
