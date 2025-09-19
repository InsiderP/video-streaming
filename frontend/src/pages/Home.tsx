import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { Play, Eye, Heart, Clock, Search } from 'lucide-react';
import { useVideoStore } from '../store/video.store';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Home: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { videos, pagination, isLoading, error, getVideos } = useVideoStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  useEffect(() => {
    loadVideos();
  }, [currentPage, searchQuery]);

  const loadVideos = async () => {
    try {
      await getVideos({
        page: currentPage,
        limit: 12,
        search: searchQuery || undefined,
        sortBy: 'created_at',
        sortOrder: 'desc',
        visibility: 'public',
        status: 'ready',
      });
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadVideos();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading && videos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Professional Video Streaming
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            Upload, process, and stream your videos with adaptive bitrate technology
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/upload" className="btn btn-secondary btn-lg">
              Start Uploading
            </Link>
            <Link to="/dashboard" className="btn btn-outline btn-lg text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary">
              View Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="py-8 bg-card border-b border-border">
        <div className="container mx-auto px-4">
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              />
            </div>
          </form>
        </div>
      </section>

      {/* Videos Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-foreground">
              {searchQuery ? `Search Results for "${searchQuery}"` : 'Latest Videos'}
            </h2>
            {pagination && (
              <p className="text-muted-foreground">
                {pagination.total} videos found
              </p>
            )}
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-8">
              {error}
            </div>
          )}

          {videos.length === 0 && !isLoading ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground text-lg mb-4">
                {searchQuery ? 'No videos found matching your search.' : 'No videos available yet.'}
              </div>
              <Link to="/upload" className="btn btn-primary">
                Upload First Video
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {videos.map((video) => (
                  <Link
                    key={video.id}
                    to={`/video/${video.id}`}
                    className="group block bg-card rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-muted">
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Play Button Overlay */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                        <div className="bg-white bg-opacity-90 rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Play className="w-6 h-6 text-black" />
                        </div>
                      </div>

                      {/* Duration Badge */}
                      {video.duration && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                          {formatDuration(video.duration)}
                        </div>
                      )}
                    </div>

                    {/* Video Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {video.title}
                      </h3>
                      
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                        <span>{video.user?.username}</span>
                        <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Eye className="w-4 h-4" />
                          <span>{video.viewCount}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Heart className="w-4 h-4" />
                          <span>{video.likeCount}</span>
                        </div>
                        {video.fileSize && (
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatFileSize(video.fileSize)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex justify-center mt-12">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!pagination.hasPrev}
                      className="btn btn-outline btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`btn btn-sm ${
                              page === currentPage ? 'btn-primary' : 'btn-outline'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!pagination.hasNext}
                      className="btn btn-outline btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
