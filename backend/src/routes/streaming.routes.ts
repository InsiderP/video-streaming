import { Router } from 'express';
import Joi from 'joi';
import { streamingController } from '../controllers/streaming.controller';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { validateRequest, validateParams, schemas } from '../middleware/validation.middleware';

const router = Router();

// HLS Adaptive Bitrate Streaming Routes
router.get('/:videoId/manifest.m3u8',
  validateParams(Joi.object({ videoId: Joi.string().uuid().required() })),
  streamingController.getHLSManifest
);

router.get('/:videoId/:quality/playlist.m3u8',
  validateParams(Joi.object({ 
    videoId: Joi.string().uuid().required(),
    quality: Joi.string().valid('240p', '360p', '480p', '720p', '1080p').required()
  })),
  streamingController.getHLSPlaylist
);

router.get('/:videoId/:quality/:segment.ts',
  validateParams(Joi.object({ 
    videoId: Joi.string().uuid().required(),
    quality: Joi.string().valid('240p', '360p', '480p', '720p', '1080p').required(),
    segment: Joi.string().pattern(/^\d{3}$/).required()
  })),
  streamingController.getVideoSegment
);

// Processing Status Routes
router.get('/:videoId/status',
  validateParams(Joi.object({ videoId: Joi.string().uuid().required() })),
  streamingController.getProcessingStatus
);

router.get('/:videoId/aws-job-status',
  validateParams(Joi.object({ videoId: Joi.string().uuid().required() })),
  streamingController.checkAWSJobStatus
);

// Analytics and Tracking Routes
router.post('/:videoId/track',
  validateParams(Joi.object({ videoId: Joi.string().uuid().required() })),
  streamingController.trackStreamingEvent
);

router.get('/:videoId/analytics',
  optionalAuth,
  validateParams(Joi.object({ videoId: Joi.string().uuid().required() })),
  streamingController.getStreamingAnalytics
);

// Demo streaming routes (for showcase)
router.get('/demo/manifest.m3u8', streamingController.getHLSManifest);
router.get('/demo/:quality/playlist.m3u8', streamingController.getHLSPlaylist);
router.get('/demo/:quality/:segment.ts', streamingController.getVideoSegment);

export default router;
