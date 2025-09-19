import { Router } from 'express';
import Joi from 'joi';
import { streamingController } from '../controllers/streaming.controller';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { validateRequest, validateParams, schemas } from '../middleware/validation.middleware';

const router = Router();

// Public streaming routes
router.get('/:videoId/manifest.m3u8',
  validateParams(Joi.object({ videoId: Joi.string().uuid().required() })),
  streamingController.getHLSManifest
);

router.get('/:videoId/:quality/playlist.m3u8',
  validateParams(Joi.object({ 
    videoId: Joi.string().uuid().required(),
    quality: Joi.string().valid('240p', '360p', '480p', '720p', '1080p').required()
  })),
  streamingController.getQualityPlaylist
);

router.get('/:videoId/:quality/:segment.ts',
  validateParams(Joi.object({ 
    videoId: Joi.string().uuid().required(),
    quality: Joi.string().valid('240p', '360p', '480p', '720p', '1080p').required(),
    segment: Joi.string().pattern(/^\d{3}$/).required()
  })),
  streamingController.getVideoSegment
);

router.get('/:videoId/optimal-quality',
  validateParams(Joi.object({ videoId: Joi.string().uuid().required() })),
  streamingController.getOptimalQuality
);

// Analytics routes (protected)
router.post('/:videoId/analytics',
  optionalAuth,
  validateParams(Joi.object({ videoId: Joi.string().uuid().required() })),
  validateRequest(schemas.streamingAnalytics),
  streamingController.trackAnalytics
);

router.get('/:videoId/analytics/realtime',
  authenticateToken,
  validateParams(Joi.object({ videoId: Joi.string().uuid().required() })),
  streamingController.getRealTimeAnalytics
);

router.get('/:videoId/analytics/stats',
  authenticateToken,
  validateParams(Joi.object({ videoId: Joi.string().uuid().required() })),
  streamingController.getStreamingStats
);

export default router;
