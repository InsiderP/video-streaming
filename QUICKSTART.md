# 🚀 Quick Start Guide

## Option 1: Quick Start with SQLite (No Database Setup Required)

1. **Copy the development environment file:**
   ```bash
   cd backend
   cp env.development .env
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

4. **Start the backend:**
   ```bash
   npm run dev
   ```

5. **Start the frontend (in a new terminal):**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

## Option 2: Full Setup with PostgreSQL

1. **Run the database setup script:**
   ```bash
   ./setup-database.sh
   ```

2. **Update your .env file with PostgreSQL credentials:**
   ```bash
   cd backend
   cp env.example .env
   # Edit .env file with your PostgreSQL credentials
   ```

3. **Continue with steps 2-5 from Option 1**

## 🎯 What's Working

✅ **Backend Features:**
- User authentication (JWT)
- Video upload and processing
- Adaptive bitrate streaming (HLS)
- Real-time analytics
- RESTful API endpoints

✅ **Frontend Features:**
- React 18 with TypeScript
- Video player with HLS.js
- User authentication
- Responsive design
- State management with Zustand

## 🔧 Troubleshooting

### Database Connection Issues
- **SQLite**: No setup required, works out of the box
- **PostgreSQL**: Make sure PostgreSQL is running and credentials are correct

### Port Conflicts
- Backend runs on port 8001
- Frontend runs on port 3001
- If ports are busy, update the PORT in .env files

### FFmpeg Issues
- Install FFmpeg: `brew install ffmpeg` (macOS) or `sudo apt install ffmpeg` (Ubuntu)
- Update FFMPEG_PATH in .env if needed

## 📱 Access the Application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8001
- **Health Check**: http://localhost:8001/health

## 🎥 Testing Video Upload

1. Register a new account
2. Go to Upload page
3. Upload a video file
4. Wait for processing to complete
5. Watch the video with adaptive streaming!

---

**Note**: This is a professional-grade video streaming platform with adaptive bitrate streaming, built with modern technologies and best practices.
