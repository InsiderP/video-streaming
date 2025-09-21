import { Router } from 'express';
import { videoController } from '../controllers/video.controller';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { validateRequest, validateParams, validateQuery, schemas } from '../middleware/validation.middleware';

const router = Router();

// Public routes
router.get('/',
  optionalAuth,
  validateQuery(schemas.videoListQuery),
  videoController.getVideos
);

router.get('/:id',
  optionalAuth,
  validateParams(schemas.uuid),
  videoController.getVideo
);

router.get('/:id/comments',
  validateParams(schemas.uuid),
  videoController.getComments
);

// Protected routes (any authenticated user can upload/manage their own videos)
router.post('/',
  authenticateToken,
  validateRequest(schemas.createVideo),
  videoController.createVideo
);

router.post('/:id/upload',
  authenticateToken,
  validateParams(schemas.uuid),
  videoController.uploadMiddleware,
  videoController.uploadVideo
);

// New endpoint for direct upload with transcoding
router.post('/upload-with-transcoding',
  authenticateToken,
  videoController.uploadMiddleware,
  videoController.uploadVideoWithTranscoding
);

router.put('/:id',
  authenticateToken,
  validateParams(schemas.uuid),
  validateRequest(schemas.updateVideo),
  videoController.updateVideo
);

router.delete('/:id',
  authenticateToken,
  validateParams(schemas.uuid),
  videoController.deleteVideo
);

router.get('/:id/processing-status',
  authenticateToken,
  validateParams(schemas.uuid),
  videoController.getVideoProcessingStatus
);

router.get('/:id/analytics',
  authenticateToken,
  validateParams(schemas.uuid),
  videoController.getVideoAnalytics
);

router.post('/:id/comments',
  authenticateToken,
  validateParams(schemas.uuid),
  validateRequest(schemas.createComment),
  videoController.addComment
);

router.post('/:id/like',
  authenticateToken,
  validateParams(schemas.uuid),
  videoController.toggleLike
);

export default router;
