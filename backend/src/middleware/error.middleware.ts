import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/common.types';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', error);

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Not found';
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    message = 'Conflict';
  } else if (error.message.includes('duplicate key')) {
    statusCode = 409;
    message = 'Resource already exists';
  } else if (error.message.includes('not found')) {
    statusCode = 404;
    message = error.message;
  } else if (error.message.includes('invalid')) {
    statusCode = 400;
    message = error.message;
  } else if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
    statusCode = 401;
    message = error.message;
  } else if (error.message.includes('forbidden') || error.message.includes('permission')) {
    statusCode = 403;
    message = error.message;
  }

  const response: ApiResponse = {
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { 
      details: error.message,
      stack: error.stack 
    }),
  };

  res.status(statusCode).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: false,
    error: 'Route not found',
  };
  res.status(404).json(response);
};
