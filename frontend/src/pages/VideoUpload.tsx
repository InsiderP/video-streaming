import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useVideoStore } from '../store/video.store';

const VideoUpload: React.FC = () => {
  const navigate = useNavigate();
  const { createVideo, uploadVideo, getVideo } = useVideoStore();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'unlisted'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!fileRef.current?.files || fileRef.current.files.length === 0) {
        toast.error('Please choose a video file');
        return;
      }
      const file = fileRef.current.files[0];
      setIsSubmitting(true);

      // 1) Create video metadata
      const video = await createVideo({ title, description, visibility });
      toast.success('Video created, uploading file...');

      // 2) Upload file
      await uploadVideo(video.id, file);
      toast.success('Upload complete. Processing has started.');

      // 3) Poll latest once and navigate to player or dashboard
      await getVideo(video.id);
      navigate(`/video/${video.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Upload Video</h1>
        <div className="card">
          <div className="card-content">
            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Title</label>
                <input
                  className="input w-full"
                  placeholder="My awesome video"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                <textarea
                  className="input w-full min-h-[120px]"
                  placeholder="What is this video about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Visibility</label>
                <select
                  className="input w-full"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="unlisted">Unlisted</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Video file</label>
                <input ref={fileRef} type="file" accept="video/*" className="block" />
                <p className="text-sm text-muted-foreground mt-2">Supported: mp4, mov, mkv, webm, avi</p>
              </div>

              <div className="flex items-center gap-4">
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting ? 'Uploading...' : 'Upload'}
                </button>
                <button type="button" onClick={() => navigate('/dashboard')} className="btn btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoUpload;
