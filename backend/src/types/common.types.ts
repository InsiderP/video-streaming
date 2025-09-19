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

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export type UserRole = 'admin' | 'creator' | 'viewer';
export type SubscriptionTier = 'free' | 'premium' | 'pro';
export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'deleted';
export type VisibilityType = 'public' | 'private' | 'unlisted';
export type AnalyticsEvent = 'play' | 'pause' | 'seek' | 'quality_change' | 'complete' | 'abandon';

export interface VideoQuality {
  name: string;
  bitrate: number;
  crf: number;
  width: number;
  height: number;
}

export interface StreamingEvent {
  type: AnalyticsEvent;
  timestamp: number;
  durationWatched?: number;
  quality?: string;
  seekPosition?: number;
  deviceType?: string;
  browser?: string;
  ipAddress?: string;
}

export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

export interface ProcessingJob {
  id: string;
  videoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
