import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { config } from '../config/environment';
import { VideoQuality } from '../types/common.types';
import { uploadDirectoryToS3, getS3PublicUrl } from '../utils/storage';
import { awsMediaConvertService } from './aws-mediaconvert.service';
import { cacheService } from './cache.service';

export class VideoProcessingService {
  private readonly qualities: VideoQuality[] = config.video.qualities;

  async processVideo(videoId: string, inputPath: string): Promise<void> {
    try {
      console.log(`Starting video processing for video ${videoId}`);

      // Update status to processing
      await this.updateVideoStatus(videoId, 'processing');
      await cacheService.cacheProcessingStatus(videoId, { status: 'processing', progress: 10 });

      // Get video metadata
      const metadata = await this.getVideoMetadata(inputPath);
      
      // Update video with metadata
      await this.updateVideoMetadata(videoId, metadata);

      // Choose processing method based on configuration
      if (config.aws.accessKeyId && config.aws.secretAccessKey) {
        // Use AWS MediaConvert for cloud processing
        await this.processWithAWSMediaConvert(videoId, inputPath, metadata);
      } else {
        // Use local FFmpeg processing
        await this.processWithFFmpeg(videoId, inputPath, metadata);
      }

      // Update video status to ready
      await this.updateVideoStatus(videoId, 'ready');
      await cacheService.cacheProcessingStatus(videoId, { status: 'ready', progress: 100 });

      // Invalidate cache to ensure fresh data
      await cacheService.invalidateVideoCache(videoId);

      console.log(`Video processing completed for video ${videoId}`);
    } catch (error) {
      console.error(`Video processing failed for video ${videoId}:`, error);
      await this.updateVideoStatus(videoId, 'failed');
      await cacheService.cacheProcessingStatus(videoId, { status: 'failed', progress: 0, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  private async processWithAWSMediaConvert(videoId: string, inputPath: string, metadata: any): Promise<void> {
    console.log(`Processing video ${videoId} with AWS MediaConvert`);

    // Upload source video to S3
    const inputKey = `videos/${videoId}/source/${path.basename(inputPath)}`;
    const inputS3Uri = await awsMediaConvertService.uploadToS3(inputPath, inputKey);
    
    // Create transcoding job
    const jobSettings = {
      videoId,
      inputS3Uri,
      outputS3Uri: `s3://${config.aws.s3Bucket}/videos/${videoId}/outputs`,
      qualities: this.qualities,
    };

    const jobId = await awsMediaConvertService.createTranscodingJob(jobSettings);
    
    // Store job ID in database for status tracking
    await db('videos')
      .where({ id: videoId })
      .update({ 
        processing_job_id: jobId,
        updated_at: new Date() 
      });

    // Generate thumbnail locally (AWS MediaConvert can do this too, but keeping it simple)
    const outputDir = path.join(config.storage.localPath, 'processed', videoId);
    await fs.mkdir(outputDir, { recursive: true });
    await this.generateThumbnail(inputPath, outputDir, videoId);

    // Update progress
    await cacheService.cacheProcessingStatus(videoId, { 
      status: 'processing', 
      progress: 30, 
      jobId,
      message: 'Transcoding job created, processing in progress...' 
    });
  }

  private async processWithFFmpeg(videoId: string, inputPath: string, metadata: any): Promise<void> {
    console.log(`Processing video ${videoId} with local FFmpeg`);

    // Create output directory
    const outputDir = path.join(config.storage.localPath, 'processed', videoId);
    await fs.mkdir(outputDir, { recursive: true });

    // Generate thumbnail
    await this.generateThumbnail(inputPath, outputDir, videoId);

    // Transcode to multiple qualities
    const variants = await this.transcodeToMultipleQualities(inputPath, outputDir, videoId);

    // Generate HLS playlists
    await this.generateHLSPlaylists(variants, outputDir, videoId);

    // If S3 storage is selected, publish the processed directory to S3
    if (config.storage.type === 's3') {
      const prefix = `videos/${videoId}`;
      await uploadDirectoryToS3({ prefix, directoryPath: outputDir, acl: 'public-read' });

      // Update variant URLs to S3
      for (const variant of variants) {
        const playlistKey = `videos/${videoId}/${variant.quality}.m3u8`;
        const playlistUrl = getS3PublicUrl({ bucket: config.storage.s3Bucket as string, key: playlistKey });
        await db('video_variants').where({ id: variant.id }).update({ hls_playlist_url: playlistUrl });
      }
    }
  }

  private async getVideoMetadata(inputPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        resolve({
          duration: Math.floor(metadata.format.duration || 0),
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          bitrate: Math.floor((metadata.format.bit_rate || 0) / 1000), // Convert to kbps
          fps: eval(videoStream?.r_frame_rate || '0'),
          codec: videoStream?.codec_name || 'unknown',
          audioCodec: audioStream?.codec_name || 'unknown',
        });
      });
    });
  }

  private async generateThumbnail(inputPath: string, outputDir: string, videoId: string): Promise<string> {
    const thumbnailPath = path.join(outputDir, 'thumbnail.jpg');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ['10%'],
          filename: 'thumbnail.jpg',
          folder: outputDir,
          size: '320x180',
        })
        .on('end', async () => {
          try {
            // Update video with thumbnail URL
            const thumbnailUrl = `/uploads/processed/${videoId}/thumbnail.jpg`;
            await db('videos')
              .where({ id: videoId })
              .update({ thumbnail_url: thumbnailUrl });

            resolve(thumbnailPath);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  private async transcodeToMultipleQualities(
    inputPath: string, 
    outputDir: string, 
    videoId: string
  ): Promise<any[]> {
    const variants = [];

    for (const quality of this.qualities) {
      try {
        const variant = await this.transcodeToQuality(inputPath, outputDir, videoId, quality);
        variants.push(variant);
      } catch (error) {
        console.error(`Failed to transcode to ${quality.name}:`, error);
        // Continue with other qualities
      }
    }

    return variants;
  }

  private async transcodeToQuality(
    inputPath: string, 
    outputDir: string, 
    videoId: string, 
    quality: VideoQuality
  ): Promise<any> {
    const outputPath = path.join(outputDir, `${quality.name}.m3u8`);
    const segmentPattern = path.join(outputDir, `${quality.name}_%03d.ts`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${quality.width}x${quality.height}`)
        .videoBitrate(quality.bitrate)
        .audioBitrate('128k')
        .format('hls')
        .outputOptions([
          '-preset fast',
          `-crf ${quality.crf}`,
          `-maxrate ${quality.bitrate}k`,
          `-bufsize ${quality.bitrate * 2}k`,
          '-hls_time 10',
          '-hls_list_size 0',
          '-hls_segment_filename', segmentPattern,
          '-hls_flags delete_segments',
          '-start_number 0',
        ])
        .output(outputPath);

      command
        .on('start', (commandLine) => {
          console.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          console.log(`Processing ${quality.name}: ${progress.percent}% done`);
        })
        .on('end', async () => {
          try {
            // Get file size
            const stats = await fs.stat(outputPath);
            const fileSize = stats.size;

            // Save variant to database
            const [variant] = await db('video_variants')
              .insert({
                video_id: videoId,
                quality: quality.name,
                bitrate: quality.bitrate,
                resolution_width: quality.width,
                resolution_height: quality.height,
                file_path: outputPath,
                file_size: fileSize,
                hls_playlist_url: `/uploads/processed/${videoId}/${quality.name}.m3u8`,
              })
              .returning('*');

            resolve(variant);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .run();
    });
  }

  private async generateHLSPlaylists(variants: any[], outputDir: string, videoId: string): Promise<void> {
    // Generate master playlist
    const masterPlaylistPath = path.join(outputDir, 'master.m3u8');
    let masterPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    variants.forEach(variant => {
      masterPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bitrate * 1000},RESOLUTION=${variant.resolution_width}x${variant.resolution_height}\n`;
      masterPlaylist += `${variant.quality}.m3u8\n\n`;
    });

    await fs.writeFile(masterPlaylistPath, masterPlaylist);

    // Update video with master playlist URL
    await db('videos')
      .where({ id: videoId })
      .update({ 
        // Add master playlist URL to video record if needed
        updated_at: new Date() 
      });
  }

  private async updateVideoStatus(videoId: string, status: string): Promise<void> {
    await db('videos')
      .where({ id: videoId })
      .update({ 
        status, 
        updated_at: new Date() 
      });
  }

  private async updateVideoMetadata(videoId: string, metadata: any): Promise<void> {
    await db('videos')
      .where({ id: videoId })
      .update({
        duration: metadata.duration,
        updated_at: new Date(),
      });
  }

  async getVideoInfo(inputPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          format: metadata.format.format_name,
          video: {
            codec: videoStream?.codec_name,
            width: videoStream?.width,
            height: videoStream?.height,
            fps: videoStream?.r_frame_rate,
            bitrate: videoStream?.bit_rate,
          },
          audio: {
            codec: audioStream?.codec_name,
            sampleRate: audioStream?.sample_rate,
            channels: audioStream?.channels,
            bitrate: audioStream?.bit_rate,
          },
        });
      });
    });
  }

  async validateVideoFile(filePath: string): Promise<boolean> {
    try {
      const info = await this.getVideoInfo(filePath);
      
      // Check if video stream exists
      if (!info.video || !info.video.codec) {
        return false;
      }

      // Check if duration is reasonable (not too short or too long)
      if (info.duration < 1 || info.duration > 36000) { // 1 second to 10 hours
        return false;
      }

      // Check if file size is within limits
      if (info.size > config.video.maxFileSize) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Video validation failed:', error);
      return false;
    }
  }

  async checkAWSJobStatus(videoId: string): Promise<any> {
    try {
      const video = await db('videos')
        .where({ id: videoId })
        .first();

      if (!video || !video.processing_job_id) {
        throw new Error('No processing job found for this video');
      }

      const jobStatus = await awsMediaConvertService.getJobStatus(video.processing_job_id);
      
      // Update cache with current status
      await cacheService.cacheProcessingStatus(videoId, {
        status: jobStatus.status,
        progress: jobStatus.progress,
        jobId: video.processing_job_id,
        error: jobStatus.errorMessage,
      });

      // If job is complete, update video variants in database
      if (jobStatus.status === 'COMPLETE') {
        await this.updateVideoVariantsFromAWS(videoId, jobStatus);
        await this.updateVideoStatus(videoId, 'ready');
        await cacheService.invalidateVideoCache(videoId);
      } else if (jobStatus.status === 'ERROR') {
        await this.updateVideoStatus(videoId, 'failed');
      }

      return jobStatus;
    } catch (error) {
      console.error('Failed to check AWS job status:', error);
      throw error;
    }
  }

  private async updateVideoVariantsFromAWS(videoId: string, jobStatus: any): Promise<void> {
    if (!jobStatus.outputGroupDetails) return;

    for (const outputGroup of jobStatus.outputGroupDetails) {
      if (outputGroup.OutputDetails) {
        for (const output of outputGroup.OutputDetails) {
          if (output.OutputFilePaths && output.OutputFilePaths.length > 0) {
            const outputPath = output.OutputFilePaths[0];
            const quality = this.extractQualityFromPath(outputPath);
            
            if (quality) {
              // Create video variant record
              await db('video_variants').insert({
                video_id: videoId,
                quality: quality.name,
                bitrate: quality.bitrate,
                resolution_width: quality.width,
                resolution_height: quality.height,
                file_path: outputPath,
                hls_playlist_url: awsMediaConvertService.getCloudFrontUrl(`videos/${videoId}/outputs/${quality.name}.m3u8`),
                created_at: new Date(),
              });
            }
          }
        }
      }
    }
  }

  private extractQualityFromPath(outputPath: string): VideoQuality | null {
    // Extract quality from AWS output path
    // Example: s3://bucket/videos/123/outputs/720p.m3u8
    const match = outputPath.match(/(\d+p)\.m3u8$/);
    if (match) {
      const qualityName = match[1];
      return this.qualities.find(q => q.name === qualityName) || null;
    }
    return null;
  }
}

export const videoProcessingService = new VideoProcessingService();
