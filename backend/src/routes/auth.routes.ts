import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { validateRequest, schemas } from '../middleware/validation.middleware';

const router = Router();

// Public routes
router.post('/register', 
  validateRequest(schemas.register),
  authController.register
);

router.post('/login', 
  validateRequest(schemas.login),
  authController.login
);

router.post('/refresh-token', 
  validateRequest(schemas.refreshToken),
  authController.refreshToken
);

// Protected routes
router.post('/logout', 
  authenticateToken,
  authController.logout
);

router.get('/profile', 
  authenticateToken,
  authController.getProfile
);

router.put('/profile', 
  authenticateToken,
  validateRequest(schemas.updateProfile),
  authController.updateProfile
);

router.put('/change-password', 
  authenticateToken,
  validateRequest(schemas.changePassword),
  authController.changePassword
);

router.post('/logout-all', 
  authenticateToken,
  authController.logoutAllSessions
);

export default router;
