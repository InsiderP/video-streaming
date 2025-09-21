import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { videoService } from '../services/video.service';
import { videoProcessingService } from '../services/video-processing.service';
import { ApiResponse } from '../types/common.types';
import { 
  CreateVideoRequest, 
  UpdateVideoRequest, 
  VideoListQuery,
  CreateCommentRequest 
} from '../types/video.types';
import { config } from '../config/environment';
import { uploadFileToS3, getS3PublicUrl } from '../utils/storage';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(config.storage.localPath, 'temp');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.video.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    const allowedFormats = config.video.allowedFormats;
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    
    if (allowedFormats.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File format ${fileExtension} is not allowed. Allowed formats: ${allowedFormats.join(', ')}`));
    }
  },
});

export class VideoController {
  // Multer middleware for file upload
  uploadMiddleware = upload.single('video');

  async createVideo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const videoData: CreateVideoRequest = req.body;
      const video = await videoService.createVideo(req.user.id, videoData);

      const response: ApiResponse = {
        success: true,
        data: { video },
        message: 'Video created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create video',
      };
      res.status(400).json(response);
    }
  }

  async uploadVideo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = { success: false, error: 'User not authenticated' };
        res.status(401).json(response);
        return;
      }

      const { videoId } = req.params;
      const file = req.file;

      if (!file) {
        const response: ApiResponse = { success: false, error: 'No video file provided' };
        res.status(400).json(response);
        return;
      }

      // Optionally upload original source to S3 for archival
      if (config.storage.type === 's3') {
        const key = `videos/${videoId}/source/${file.filename}`;
        await uploadFileToS3({ key, filePath: file.path, acl: 'private' });
      }

      // Validate video file
      const isValid = await videoProcessingService.validateVideoFile(file.path);
      if (!isValid) {
        // Clean up uploaded file
        await fs.unlink(file.path);
        const response: ApiResponse = {
          success: false,
          error: 'Invalid video file',
        };
        res.status(400).json(response);
        return;
      }

      // Upload video file and start processing
      await videoService.uploadVideoFile(
        videoId,
        file.path,
        file.originalname,
        file.size
      );

      const response: ApiResponse = { 
        success: true, 
        message: 'Video uploaded successfully and processing started',
        data: {
          videoId,
          status: 'processing',
          message: 'Video is being transcoded into multiple quality levels for adaptive streaming'
        }
      };
      res.json(response);
    } catch (error) {
      const response: ApiResponse = { success: false, error: error instanceof Error ? error.message : 'Video upload failed' };
      res.status(400).json(response);
    }
  }

  async uploadVideoWithTranscoding(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = { success: false, error: 'User not authenticated' };
        res.status(401).json(response);
        return;
      }

      const file = req.file;
      const { title, description, categoryId, tags, visibility } = req.body;

      if (!file) {
        const response: ApiResponse = { success: false, error: 'No video file provided' };
        res.status(400).json(response);
        return;
      }

      // Validate video file
      const isValid = await videoProcessingService.validateVideoFile(file.path);
      if (!isValid) {
        await fs.unlink(file.path);
        const response: ApiResponse = {
          success: false,
          error: 'Invalid video file',
        };
        res.status(400).json(response);
        return;
      }

      // Create video record
      const video = await videoService.createVideo(req.user.id, {
        title: title || file.originalname,
        description,
        categoryId,
        tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : [],
        visibility: visibility || 'public',
      });

      // Upload and start processing
      await videoService.uploadVideoFile(
        video.id,
        file.path,
        file.originalname,
        file.size
      );

      const response: ApiResponse = {
        success: true,
        message: 'Video uploaded successfully and adaptive transcoding started',
        data: {
          video,
          processingStatus: {
            status: 'processing',
            progress: 10,
            message: 'Video is being transcoded into multiple quality levels (240p, 360p, 480p, 720p, 1080p) for adaptive bitrate streaming'
          }
        }
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Video upload and transcoding failed' 
      };
      res.status(400).json(response);
    }
  }

  async getVideo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const video = await videoService.getVideoById(id, userId);

      if (!video) {
        const response: ApiResponse = {
          success: false,
          error: 'Video not found',
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { video },
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get video',
      };
      res.status(400).json(response);
    }
  }

  async updateVideo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { id } = req.params;
      const videoData: UpdateVideoRequest = req.body;

      const video = await videoService.updateVideo(id, req.user.id, videoData);

      const response: ApiResponse = {
        success: true,
        data: { video },
        message: 'Video updated successfully',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update video',
      };
      res.status(400).json(response);
    }
  }

  async deleteVideo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { id } = req.params;
      await videoService.deleteVideo(id, req.user.id);

      const response: ApiResponse = {
        success: true,
        message: 'Video deleted successfully',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete video',
      };
      res.status(400).json(response);
    }
  }

  async getVideos(req: Request, res: Response): Promise<void> {
    try {
      const query: VideoListQuery = req.query;
      const result = await videoService.getVideos(query);

      const response: ApiResponse = {
        success: true,
        data: { videos: result.videos },
        pagination: result.pagination,
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get videos',
      };
      res.status(400).json(response);
    }
  }

  async getVideoProcessingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const status = await videoService.getVideoProcessingStatus(id);

      const response: ApiResponse = {
        success: true,
        data: { status },
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

  async getVideoAnalytics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { id } = req.params;
      const analytics = await videoService.getVideoAnalytics(id);

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

  async addComment(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { id } = req.params;
      const commentData: CreateCommentRequest = req.body;

      const comment = await videoService.addComment(id, req.user.id, commentData);

      const response: ApiResponse = {
        success: true,
        data: { comment },
        message: 'Comment added successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add comment',
      };
      res.status(400).json(response);
    }
  }

  async getComments(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const comments = await videoService.getComments(id, page, limit);

      const response: ApiResponse = {
        success: true,
        data: { comments },
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get comments',
      };
      res.status(400).json(response);
    }
  }

  async toggleLike(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const { id } = req.params;
      const { isLike } = req.body;

      const like = await videoService.toggleLike(id, req.user.id, isLike);

      const response: ApiResponse = {
        success: true,
        data: { like },
        message: isLike ? 'Video liked' : 'Video disliked',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle like',
      };
      res.status(400).json(response);
    }
  }
}

export const videoController = new VideoController();
