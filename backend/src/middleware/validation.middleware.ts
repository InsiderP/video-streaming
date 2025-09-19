import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: errorMessage,
      });
      return;
    }

    req.body = value;
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      res.status(400).json({
        success: false,
        error: 'Query validation error',
        details: errorMessage,
      });
      return;
    }

    req.query = value;
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      res.status(400).json({
        success: false,
        error: 'Parameter validation error',
        details: errorMessage,
      });
      return;
    }

    req.params = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  // Auth schemas
  register: Joi.object({
    email: Joi.string().email().required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).max(128).required(),
    firstName: Joi.string().min(1).max(50).required(),
    lastName: Joi.string().min(1).max(50).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().min(1).max(50),
    lastName: Joi.string().min(1).max(50),
    username: Joi.string().alphanum().min(3).max(30),
    avatarUrl: Joi.string().uri(),
  }),

  // Video schemas
  createVideo: Joi.object({
    title: Joi.string().min(1).max(255).required(),
    description: Joi.string().max(5000),
    categoryId: Joi.string().uuid(),
    tags: Joi.array().items(Joi.string().max(50)).max(10),
    visibility: Joi.string().valid('public', 'private', 'unlisted').required(),
  }),

  updateVideo: Joi.object({
    title: Joi.string().min(1).max(255),
    description: Joi.string().max(5000),
    categoryId: Joi.string().uuid(),
    tags: Joi.array().items(Joi.string().max(50)).max(10),
    visibility: Joi.string().valid('public', 'private', 'unlisted'),
  }),

  videoListQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    category: Joi.string().uuid(),
    search: Joi.string().max(255),
    sortBy: Joi.string().valid('created_at', 'view_count', 'title', 'like_count').default('created_at'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    userId: Joi.string().uuid(),
    status: Joi.string().valid('uploading', 'processing', 'ready', 'failed', 'deleted'),
    visibility: Joi.string().valid('public', 'private', 'unlisted'),
  }),

  createComment: Joi.object({
    content: Joi.string().min(1).max(1000).required(),
    parentId: Joi.string().uuid(),
  }),

  // Streaming schemas
  streamingAnalytics: Joi.object({
    eventType: Joi.string().valid('play', 'pause', 'seek', 'quality_change', 'complete', 'abandon').required(),
    timestamp: Joi.number().integer().positive(),
    durationWatched: Joi.number().integer().min(0),
    quality: Joi.string().max(20),
    seekPosition: Joi.number().min(0),
    deviceType: Joi.string().max(50),
    browser: Joi.string().max(50),
    ipAddress: Joi.string().ip(),
  }),

  // Common schemas
  uuid: Joi.object({
    id: Joi.string().uuid().required(),
  }),

  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};
