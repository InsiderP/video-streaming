import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useVideoStore } from '../store/video.store';
import { useAuthStore } from '../store/auth.store';
import { Eye, UploadCloud, Play, PlusCircle, RefreshCcw, Settings, BarChart3, Clock } from 'lucide-react';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { videos, isLoading, error, getVideos } = useVideoStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      await getVideos({ userId: user?.id, status: undefined, visibility: undefined, limit: 20 });
    } catch (e) {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">My Dashboard</h1>
          <div className="flex items-center gap-3">
            <Link to="/streaming-demo" className="btn btn-outline btn-sm">
              <Play className="w-4 h-4 mr-2" /> Streaming Demo
            </Link>
            <button onClick={onRefresh} className="btn btn-outline btn-sm" disabled={refreshing}>
              <RefreshCcw className="w-4 h-4 mr-2" /> {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <Link to="/upload" className="btn btn-primary btn-sm">
              <PlusCircle className="w-4 h-4 mr-2" /> Upload Video
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="py-24 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((v) => (
              <div key={v.id} className="card overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <UploadCloud className="w-10 h-10" />
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">{v.status.toUpperCase()}</div>
                </div>
                <div className="card-content">
                  <h3 className="font-semibold text-foreground mb-1">{v.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{v.description}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {v.viewCount}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {v.duration ? `${Math.floor(v.duration / 60)}:${(v.duration % 60).toString().padStart(2, '0')}` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/video/${v.id}`} className="btn btn-sm btn-outline flex-1">
                        <Play className="w-4 h-4 mr-1" /> View
                      </Link>
                      <Link to={`/analytics/${v.id}`} className="btn btn-sm btn-outline">
                        <BarChart3 className="w-4 h-4" />
                      </Link>
                    </div>
                    {v.status === 'ready' && (
                      <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        ✓ Adaptive streaming ready
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
