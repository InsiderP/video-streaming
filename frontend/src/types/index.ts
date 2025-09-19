export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'creator' | 'viewer';
export type SubscriptionTier = 'free' | 'premium' | 'pro';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

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
  createdAt: string;
  updatedAt: string;
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

export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'deleted';
export type VisibilityType = 'public' | 'private' | 'unlisted';

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
  createdAt: string;
}

export interface CreateVideoRequest {
  title: string;
  description?: string;
  categoryId?: string;
  tags?: string[];
  visibility: VisibilityType;
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

export interface VideoComment {
  id: string;
  videoId: string;
  userId: string;
  content: string;
  parentId?: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface StreamingAnalytics {
  videoId: string;
  eventType: AnalyticsEvent;
  timestamp: number;
  durationWatched?: number;
  quality?: string;
  seekPosition?: number;
  deviceType?: string;
  browser?: string;
  ipAddress?: string;
}

export type AnalyticsEvent = 'play' | 'pause' | 'seek' | 'quality_change' | 'complete' | 'abandon';

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

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  createdAt: string;
}

export interface UploadProgress {
  videoId: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}
