import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { config } from '../config/environment';
import { 
  User, 
  CreateUserRequest, 
  LoginRequest, 
  LoginResponse, 
  RefreshTokenRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  UserSession 
} from '../types/auth.types';
import { JWTPayload } from '../types/common.types';

export class AuthService {
  private readonly saltRounds = 12;

  async createUser(userData: CreateUserRequest): Promise<User> {
    const { email, username, password, firstName, lastName } = userData;

    // Check if user already exists
    const existingUser = await db('users')
      .where({ email })
      .orWhere({ username })
      .first();

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.saltRounds);

    // Create user
    const [user] = await db('users')
      .insert({
        email,
        username,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
      })
      .returning('*');

    return this.mapUserFromDb(user);
  }

  async login(loginData: LoginRequest, ipAddress?: string, userAgent?: string): Promise<LoginResponse> {
    const { email, password } = loginData;

    // Find user
    const user = await db('users')
      .where({ email, is_active: true })
      .first();

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Create session
    await this.createSession(user.id, refreshToken, ipAddress, userAgent);

    return {
      user: this.mapUserFromDb(user),
      accessToken,
      refreshToken,
      expiresIn: this.getTokenExpiration(),
    };
  }

  async refreshToken(refreshData: RefreshTokenRequest): Promise<LoginResponse> {
    const { refreshToken } = refreshData;

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as JWTPayload;
      
      // Check if session exists and is valid
      const session = await db('user_sessions')
        .where({ 
          user_id: decoded.userId, 
          session_token: refreshToken,
        })
        .where('expires_at', '>', new Date())
        .first();

      if (!session) {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const user = await db('users')
        .where({ id: decoded.userId, is_active: true })
        .first();

      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // Update session
      await db('user_sessions')
        .where({ id: session.id })
        .update({
          session_token: newRefreshToken,
          expires_at: new Date(Date.now() + this.getRefreshTokenExpiration() * 1000),
        });

      return {
        user: this.mapUserFromDb(user),
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.getTokenExpiration(),
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(sessionToken: string): Promise<void> {
    await db('user_sessions')
      .where({ session_token: sessionToken })
      .del();
  }

  async logoutAllSessions(userId: string): Promise<void> {
    await db('user_sessions')
      .where({ user_id: userId })
      .del();
  }

  async changePassword(userId: string, passwordData: ChangePasswordRequest): Promise<void> {
    const { currentPassword, newPassword } = passwordData;

    // Get user
    const user = await db('users')
      .where({ id: userId })
      .first();

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);

    // Update password
    await db('users')
      .where({ id: userId })
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date(),
      });

    // Logout all sessions
    await this.logoutAllSessions(userId);
  }

  async updateProfile(userId: string, profileData: UpdateProfileRequest): Promise<User> {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (profileData.firstName !== undefined) updateData.first_name = profileData.firstName;
    if (profileData.lastName !== undefined) updateData.last_name = profileData.lastName;
    if (profileData.username !== undefined) updateData.username = profileData.username;
    if (profileData.avatarUrl !== undefined) updateData.avatar_url = profileData.avatarUrl;

    const [user] = await db('users')
      .where({ id: userId })
      .update(updateData)
      .returning('*');

    return this.mapUserFromDb(user);
  }

  async getUserById(userId: string): Promise<User | null> {
    const user = await db('users')
      .where({ id: userId, is_active: true })
      .first();

    return user ? this.mapUserFromDb(user) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await db('users')
      .where({ email, is_active: true })
      .first();

    return user ? this.mapUserFromDb(user) : null;
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      return jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private generateAccessToken(user: any): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  private generateRefreshToken(user: any): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions);
  }

  private async createSession(
    userId: string, 
    sessionToken: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + this.getRefreshTokenExpiration() * 1000);

    await db('user_sessions').insert({
      user_id: userId,
      session_token: sessionToken,
      expires_at: expiresAt,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }

  private getTokenExpiration(): number {
    // Parse JWT expiration (e.g., "24h" -> 86400 seconds)
    const expiresIn = config.jwt.expiresIn;
    if (expiresIn.endsWith('h')) {
      return parseInt(expiresIn) * 3600;
    } else if (expiresIn.endsWith('d')) {
      return parseInt(expiresIn) * 86400;
    } else if (expiresIn.endsWith('m')) {
      return parseInt(expiresIn) * 60;
    }
    return parseInt(expiresIn);
  }

  private getRefreshTokenExpiration(): number {
    const expiresIn = config.jwt.refreshExpiresIn;
    if (expiresIn.endsWith('h')) {
      return parseInt(expiresIn) * 3600;
    } else if (expiresIn.endsWith('d')) {
      return parseInt(expiresIn) * 86400;
    } else if (expiresIn.endsWith('m')) {
      return parseInt(expiresIn) * 60;
    }
    return parseInt(expiresIn);
  }

  private mapUserFromDb(user: any): User {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      role: user.role,
      subscriptionTier: user.subscription_tier,
      isActive: user.is_active,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}

export const authService = new AuthService();
