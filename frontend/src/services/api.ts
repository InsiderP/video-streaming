import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse, LoginRequest, RegisterRequest, LoginResponse, User, Video, VideoListQuery, CreateVideoRequest, VideoComment, CreateCommentRequest, StreamingAnalytics, VideoAnalytics, Category } from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              const response = await this.refreshToken({ refreshToken });
              localStorage.setItem('accessToken', response.data.accessToken);
              localStorage.setItem('refreshToken', response.data.refreshToken);
              
              // Retry original request
              originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async register(data: RegisterRequest): Promise<AxiosResponse<ApiResponse<{ user: User }>>> {
    return this.api.post('/auth/register', data);
  }

  async login(data: LoginRequest): Promise<AxiosResponse<ApiResponse<LoginResponse>>> {
    return this.api.post('/auth/login', data);
  }

  async refreshToken(data: { refreshToken: string }): Promise<AxiosResponse<ApiResponse<LoginResponse>>> {
    return this.api.post('/auth/refresh-token', data);
  }

  async logout(): Promise<AxiosResponse<ApiResponse>> {
    return this.api.post('/auth/logout');
  }

  async getProfile(): Promise<AxiosResponse<ApiResponse<{ user: User }>>> {
    return this.api.get('/auth/profile');
  }

  async updateProfile(data: Partial<User>): Promise<AxiosResponse<ApiResponse<{ user: User }>>> {
    return this.api.put('/auth/profile', data);
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<AxiosResponse<ApiResponse>> {
    return this.api.put('/auth/change-password', data);
  }

  // Video endpoints
  async getVideos(query?: VideoListQuery): Promise<AxiosResponse<ApiResponse<{ videos: Video[] }>>> {
    return this.api.get('/videos', { params: query });
  }

  async getVideo(id: string): Promise<AxiosResponse<ApiResponse<{ video: Video }>>> {
    return this.api.get(`/videos/${id}`);
  }

  async createVideo(data: CreateVideoRequest): Promise<AxiosResponse<ApiResponse<{ video: Video }>>> {
    return this.api.post('/videos', data);
  }

  async updateVideo(id: string, data: Partial<CreateVideoRequest>): Promise<AxiosResponse<ApiResponse<{ video: Video }>>> {
    return this.api.put(`/videos/${id}`, data);
  }

  async deleteVideo(id: string): Promise<AxiosResponse<ApiResponse>> {
    return this.api.delete(`/videos/${id}`);
  }

  async uploadVideo(id: string, file: File): Promise<AxiosResponse<ApiResponse>> {
    const formData = new FormData();
    formData.append('video', file);
    
    return this.api.post(`/videos/${id}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const progress = progressEvent.total 
          ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
          : 0;
        // Emit progress event
        window.dispatchEvent(new CustomEvent('uploadProgress', { 
          detail: { videoId: id, progress } 
        }));
      },
    });
  }

  async getVideoProcessingStatus(id: string): Promise<AxiosResponse<ApiResponse<{ status: any }>>> {
    return this.api.get(`/videos/${id}/processing-status`);
  }

  async getVideoAnalytics(id: string): Promise<AxiosResponse<ApiResponse<{ analytics: VideoAnalytics }>>> {
    return this.api.get(`/videos/${id}/analytics`);
  }

  async getComments(videoId: string, page = 1, limit = 20): Promise<AxiosResponse<ApiResponse<{ comments: VideoComment[] }>>> {
    return this.api.get(`/videos/${videoId}/comments`, { params: { page, limit } });
  }

  async addComment(videoId: string, data: CreateCommentRequest): Promise<AxiosResponse<ApiResponse<{ comment: VideoComment }>>> {
    return this.api.post(`/videos/${videoId}/comments`, data);
  }

  async toggleLike(videoId: string, isLike: boolean): Promise<AxiosResponse<ApiResponse<{ like: any }>>> {
    return this.api.post(`/videos/${videoId}/like`, { isLike });
  }

  // Streaming endpoints
  async getHLSManifest(videoId: string): Promise<string> {
    const response = await this.api.get(`/stream/${videoId}/manifest.m3u8`, {
      responseType: 'text',
    });
    return response.data;
  }

  async getQualityPlaylist(videoId: string, quality: string): Promise<string> {
    const response = await this.api.get(`/stream/${videoId}/${quality}/playlist.m3u8`, {
      responseType: 'text',
    });
    return response.data;
  }

  async getVideoSegment(videoId: string, quality: string, segment: string): Promise<ArrayBuffer> {
    const response = await this.api.get(`/stream/${videoId}/${quality}/${segment}.ts`, {
      responseType: 'arraybuffer',
    });
    return response.data;
  }

  async getOptimalQuality(videoId: string, bandwidth: number): Promise<AxiosResponse<ApiResponse<{ optimalQuality: string }>>> {
    return this.api.get(`/stream/${videoId}/optimal-quality`, { params: { bandwidth } });
  }

  async trackAnalytics(videoId: string, data: StreamingAnalytics): Promise<AxiosResponse<ApiResponse>> {
    return this.api.post(`/stream/${videoId}/analytics`, data);
  }

  async getRealTimeAnalytics(videoId: string): Promise<AxiosResponse<ApiResponse<{ analytics: any }>>> {
    return this.api.get(`/stream/${videoId}/analytics/realtime`);
  }

  async getStreamingStats(videoId: string, timeRange = '24h'): Promise<AxiosResponse<ApiResponse<{ stats: any }>>> {
    return this.api.get(`/stream/${videoId}/analytics/stats`, { params: { timeRange } });
  }

  // Categories endpoints
  async getCategories(): Promise<AxiosResponse<ApiResponse<{ categories: Category[] }>>> {
    return this.api.get('/categories');
  }
}

export const apiService = new ApiService();
export default apiService;
