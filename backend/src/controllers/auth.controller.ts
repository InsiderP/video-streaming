import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../types/common.types';
import { 
  CreateUserRequest, 
  LoginRequest, 
  RefreshTokenRequest,
  ChangePasswordRequest,
  UpdateProfileRequest 
} from '../types/auth.types';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const userData: CreateUserRequest = req.body;
      const user = await authService.createUser(userData);

      const response: ApiResponse = {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            subscriptionTier: user.subscriptionTier,
            isActive: user.isActive,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
          },
        },
        message: 'User registered successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
      res.status(400).json(response);
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const loginData: LoginRequest = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await authService.login(loginData, ipAddress, userAgent);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Login successful',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
      res.status(401).json(response);
    }
  }

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const refreshData: RefreshTokenRequest = req.body;
      const result = await authService.refreshToken(refreshData);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Token refreshed successfully',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      };
      res.status(401).json(response);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(' ')[1];

      if (token) {
        // For logout, we would typically invalidate the refresh token
        // This is a simplified implementation
        const response: ApiResponse = {
          success: true,
          message: 'Logout successful',
        };
        res.json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: 'No token provided',
        };
        res.status(400).json(response);
      }
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      };
      res.status(500).json(response);
    }
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: { user: req.user },
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get profile',
      };
      res.status(500).json(response);
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const profileData: UpdateProfileRequest = req.body;
      const updatedUser = await authService.updateProfile(req.user.id, profileData);

      const response: ApiResponse = {
        success: true,
        data: { user: updatedUser },
        message: 'Profile updated successfully',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Profile update failed',
      };
      res.status(400).json(response);
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      const passwordData: ChangePasswordRequest = req.body;
      await authService.changePassword(req.user.id, passwordData);

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Password change failed',
      };
      res.status(400).json(response);
    }
  }

  async logoutAllSessions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = {
          success: false,
          error: 'User not authenticated',
        };
        res.status(401).json(response);
        return;
      }

      await authService.logoutAllSessions(req.user.id);

      const response: ApiResponse = {
        success: true,
        message: 'All sessions logged out successfully',
      };

      res.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      };
      res.status(500).json(response);
    }
  }
}

export const authController = new AuthController();
