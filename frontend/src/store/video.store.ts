import { create } from 'zustand';
import { Video, VideoListQuery, CreateVideoRequest, VideoComment, CreateCommentRequest, UploadProgress } from '../types';
import { apiService } from '../services/api';

interface VideoState {
  videos: Video[];
  currentVideo: Video | null;
  comments: VideoComment[];
  uploadProgress: UploadProgress | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null;
}

interface VideoActions {
  // Video management
  getVideos: (query?: VideoListQuery) => Promise<void>;
  getVideo: (id: string) => Promise<void>;
  createVideo: (data: CreateVideoRequest) => Promise<Video>;
  updateVideo: (id: string, data: Partial<CreateVideoRequest>) => Promise<void>;
  deleteVideo: (id: string) => Promise<void>;
  
  // Video upload
  uploadVideo: (id: string, file: File) => Promise<void>;
  getUploadProgress: () => UploadProgress | null;
  
  // Comments
  getComments: (videoId: string, page?: number, limit?: number) => Promise<void>;
  addComment: (videoId: string, data: CreateCommentRequest) => Promise<void>;
  
  // Analytics
  trackAnalytics: (videoId: string, eventType: string, data?: any) => Promise<void>;
  
  // Utility
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  clearCurrentVideo: () => void;
}

type VideoStore = VideoState & VideoActions;

export const useVideoStore = create<VideoStore>((set, get) => ({
  // State
  videos: [],
  currentVideo: null,
  comments: [],
  uploadProgress: null,
  isLoading: false,
  error: null,
  pagination: null,

  // Actions
  getVideos: async (query) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiService.getVideos(query);
      const { videos, pagination } = response.data;
      
      set({
        videos: videos || [],
        pagination: pagination || null,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to fetch videos',
      });
      throw error;
    }
  },

  getVideo: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiService.getVideo(id);
      const { video } = response.data;
      
      set({
        currentVideo: video,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to fetch video',
      });
      throw error;
    }
  },

  createVideo: async (data) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiService.createVideo(data);
      const { video } = response.data;
      
      set({
        isLoading: false,
        error: null,
      });
      
      return video;
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to create video',
      });
      throw error;
    }
  },

  updateVideo: async (id, data) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiService.updateVideo(id, data);
      const { video } = response.data;
      
      // Update video in the list
      const videos = get().videos.map(v => v.id === id ? video : v);
      
      set({
        videos,
        currentVideo: get().currentVideo?.id === id ? video : get().currentVideo,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to update video',
      });
      throw error;
    }
  },

  deleteVideo: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      await apiService.deleteVideo(id);
      
      // Remove video from the list
      const videos = get().videos.filter(v => v.id !== id);
      
      set({
        videos,
        currentVideo: get().currentVideo?.id === id ? null : get().currentVideo,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to delete video',
      });
      throw error;
    }
  },

  uploadVideo: async (id, file) => {
    set({ 
      uploadProgress: { 
        videoId: id, 
        progress: 0, 
        status: 'uploading' 
      },
      error: null 
    });
    
    try {
      await apiService.uploadVideo(id, file);
      
      set({
        uploadProgress: {
          videoId: id,
          progress: 100,
          status: 'completed',
        },
      });
      
      // Start polling for processing status
      get().pollProcessingStatus(id);
    } catch (error: any) {
      set({
        uploadProgress: {
          videoId: id,
          progress: 0,
          status: 'failed',
          error: error.response?.data?.error || 'Upload failed',
        },
      });
      throw error;
    }
  },

  getUploadProgress: () => {
    return get().uploadProgress;
  },

  getComments: async (videoId, page = 1, limit = 20) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiService.getComments(videoId, page, limit);
      const { comments } = response.data;
      
      set({
        comments: comments || [],
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to fetch comments',
      });
      throw error;
    }
  },

  addComment: async (videoId, data) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await apiService.addComment(videoId, data);
      const { comment } = response.data;
      
      // Add comment to the list
      const comments = [...get().comments, comment];
      
      set({
        comments,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.error || 'Failed to add comment',
      });
      throw error;
    }
  },

  trackAnalytics: async (videoId, eventType, data = {}) => {
    try {
      await apiService.trackAnalytics(videoId, {
        videoId,
        eventType,
        timestamp: Date.now(),
        ...data,
      });
    } catch (error) {
      console.error('Failed to track analytics:', error);
    }
  },

  clearError: () => {
    set({ error: null });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  clearCurrentVideo: () => {
    set({ currentVideo: null });
  },

  // Helper method to poll processing status
  pollProcessingStatus: async (videoId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await apiService.getVideoProcessingStatus(videoId);
        const { status } = response.data;
        
        if (status.status === 'ready' || status.status === 'failed') {
          clearInterval(pollInterval);
          
          set({
            uploadProgress: {
              videoId,
              progress: 100,
              status: status.status === 'ready' ? 'completed' : 'failed',
              error: status.error,
            },
          });
          
          // Refresh video data
          get().getVideo(videoId);
        }
      } catch (error) {
        console.error('Failed to poll processing status:', error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds
  },
}));
