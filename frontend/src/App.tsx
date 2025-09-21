import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import VideoPlayer from './pages/VideoPlayer';
import VideoUpload from './pages/VideoUpload';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import StreamingShowcase from './pages/StreamingShowcase';
import AdaptiveStreamingDemo from './pages/AdaptiveStreamingDemo';

// Components
import Layout from './components/layout/Layout';
import AuthGuard from './components/auth/AuthGuard';
import LoadingSpinner from './components/common/LoadingSpinner';

// Store
import { initializeAuth } from './store/auth.store';
import { useAuthStore } from './store/auth.store';

// Styles
import './index.css';
import './globals.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected routes */}
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="video/:id" element={<VideoPlayer />} />
              <Route path="streaming-demo" element={<StreamingShowcase />} />
              <Route path="adaptive-streaming" element={<AdaptiveStreamingDemo />} />
              
              {/* Auth required routes */}
              <Route path="dashboard" element={
                <AuthGuard>
                  <Dashboard />
                </AuthGuard>
              } />
              
              <Route path="upload" element={
                <AuthGuard requiredRole={['creator', 'admin']}>
                  <VideoUpload />
                </AuthGuard>
              } />
              
              <Route path="profile" element={
                <AuthGuard>
                  <Profile />
                </AuthGuard>
              } />
              
              <Route path="analytics/:videoId" element={
                <AuthGuard requiredRole={['creator', 'admin']}>
                  <Analytics />
                </AuthGuard>
              } />
            </Route>
            
            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          
          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
