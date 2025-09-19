import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { User } from '../types/auth.types';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ 
        success: false, 
        error: 'Access token required' 
      });
      return;
    }

    // Verify token
    const decoded = await authService.verifyToken(token);
    
    // Get user from database
    const user = await authService.getUserById(decoded.userId);
    
    if (!user || !user.isActive) {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid or inactive user' 
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions' 
      });
      return;
    }

    next();
  };
};

export const requireSubscription = (tiers: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
      return;
    }

    if (!tiers.includes(req.user.subscriptionTier)) {
      res.status(403).json({ 
        success: false, 
        error: 'Subscription required' 
      });
      return;
    }

    next();
  };
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = await authService.verifyToken(token);
      const user = await authService.getUserById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};
