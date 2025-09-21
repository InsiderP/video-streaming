import { MediaConvertClient, CreateJobCommand, GetJobCommand, JobStatus } from '@aws-sdk/client-mediaconvert';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/environment';
import { VideoQuality } from '../types/common.types';

export interface MediaConvertJobSettings {
  videoId: string;
  inputS3Uri: string;
  outputS3Uri: string;
  qualities: VideoQuality[];
}

export interface MediaConvertJob {
  jobId: string;
  status: JobStatus;
  progress?: number;
  errorMessage?: string;
  outputGroupDetails?: any[];
}

export class AWSMediaConvertService {
  private mediaConvertClient: MediaConvertClient;
  private s3Client: S3Client;

  constructor() {
    this.mediaConvertClient = new MediaConvertClient({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId!,
        secretAccessKey: config.aws.secretAccessKey!,
      },
      endpoint: config.aws.mediaConvertEndpoint,
    });

    this.s3Client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId!,
        secretAccessKey: config.aws.secretAccessKey!,
      },
    });
  }

  async createTranscodingJob(settings: MediaConvertJobSettings): Promise<string> {
    const jobSettings = this.buildJobSettings(settings);
    
    const command = new CreateJobCommand({
      Role: `arn:aws:iam::${this.getAccountId()}:role/MediaConvertRole`, // You'll need to create this role
      Settings: jobSettings,
      Queue: 'Default', // You can create custom queues
      UserMetadata: {
        videoId: settings.videoId,
      },
    });

    try {
      const response = await this.mediaConvertClient.send(command);
      return response.Job?.Id || '';
    } catch (error) {
      console.error('Failed to create MediaConvert job:', error);
      throw new Error('Failed to create transcoding job');
    }
  }

  async getJobStatus(jobId: string): Promise<MediaConvertJob> {
    const command = new GetJobCommand({ Id: jobId });

    try {
      const response = await this.mediaConvertClient.send(command);
      const job = response.Job;

      if (!job) {
        throw new Error('Job not found');
      }

      return {
        jobId: job.Id || '',
        status: job.Status || JobStatus.SUBMITTED,
        progress: this.calculateJobProgress(job),
        errorMessage: job.ErrorMessage,
        outputGroupDetails: job.OutputGroupDetails,
      };
    } catch (error) {
      console.error('Failed to get job status:', error);
      throw new Error('Failed to get job status');
    }
  }

  async uploadToS3(filePath: string, key: string): Promise<string> {
    const fs = await import('fs');
    const fileContent = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
      Bucket: config.aws.s3Bucket!,
      Key: key,
      Body: fileContent,
      ContentType: 'video/mp4',
    });

    try {
      await this.s3Client.send(command);
      return `s3://${config.aws.s3Bucket}/${key}`;
    } catch (error) {
      console.error('Failed to upload to S3:', error);
      throw new Error('Failed to upload file to S3');
    }
  }

  private buildJobSettings(settings: MediaConvertJobSettings): any {
    const outputs = settings.qualities.map(quality => ({
      NameModifier: `_${quality.name}`,
      VideoDescription: {
        CodecSettings: {
          Codec: 'H_264',
          H264Settings: {
            RateControlMode: 'QVBR',
            QvbrSettings: {
              QvbrQualityLevel: quality.crf,
              QvbrQualityLevelFineTune: 0,
            },
            MaxBitrate: quality.bitrate * 1000,
            Bitrate: quality.bitrate * 1000,
            GopSize: 60,
            GopSizeUnits: 'FRAMES',
            FramerateControl: 'INITIALIZE_FROM_SOURCE',
            FramerateConversionAlgorithm: 'DUPLICATE_DROP',
            FramerateNumerator: 30,
            FramerateDenominator: 1,
            Width: quality.width,
            Height: quality.height,
            ScalingBehavior: 'DEFAULT',
            TimecodeInsertion: 'DISABLED',
            AdaptiveQuantization: 'HIGH',
            SpatialAdaptiveQuantization: 'ENABLED',
            TemporalAdaptiveQuantization: 'ENABLED',
            FlickerAdaptiveQuantization: 'ENABLED',
            EntropyEncoding: 'CABAC',
            BitDepth: 8,
            RepeatPps: 'DISABLED',
            InterlaceMode: 'PROGRESSIVE',
            ColorMetadata: 'INSERT',
            SampleAdaptiveOffset: 'ADAPTIVE',
            HrdBufferSize: quality.bitrate * 1000 * 2,
            HrdBufferInitialFillPercentage: 90,
            SlowPal: 'DISABLED',
            NumberBFramesBetweenReferenceFrames: 2,
            GopBReference: 'DISABLED',
            GopClosedCadence: 1,
            SubgopLength: 'DYNAMIC',
            SceneChangeDetect: 'ENABLED',
            UnregisteredSeiTimecode: 'DISABLED',
            QualityTuningLevel: 'SINGLE_PASS',
            NumberReferenceFrames: 3,
          },
        },
        Width: quality.width,
        Height: quality.height,
        TimecodeInsertion: 'DISABLED',
        AntiAlias: 'ENABLED',
        Sharpness: 50,
        RespondToAfd: 'NONE',
        ColorMetadata: 'INSERT',
        AfdSignaling: 'NONE',
        DropFrameTimecode: 'ENABLED',
      },
      AudioDescriptions: [
        {
          CodecSettings: {
            Codec: 'AAC',
            AacSettings: {
              AudioDescriptionBroadcasterMix: 'NORMAL',
              Bitrate: 128000,
              RateControlMode: 'CBR',
              CodecProfile: 'LC',
              CodingMode: 'CODING_MODE_2_0',
              RawFormat: 'NONE',
              SampleRate: 48000,
              Specification: 'MPEG4',
            },
          },
          AudioSourceName: 'Audio Selector 1',
          AudioType: 0,
          AudioTypeControl: 'FOLLOW_INPUT',
          LanguageCodeControl: 'FOLLOW_INPUT',
          AudioSelectorName: 'Audio Selector 1',
        },
      ],
      ContainerSettings: {
        Container: 'M3U8',
        M3u8Settings: {
          AudioFramesPerPes: 4,
          PcrControl: 'PCR_EVERY_PES_PACKET',
          PmtPid: 480,
          PrivateMetadataPid: 503,
          ProgramNumber: 1,
          PatInterval: 0,
          PmtInterval: 0,
          Scte35Source: 'NONE',
          Scte35Pid: 500,
          TimedMetadata: 'NONE',
          TimedMetadataPid: 502,
          VideoPid: 481,
          AudioPids: [
            482,
            483,
            484,
            485,
            486,
            487,
            488,
            489,
            490,
            491,
            492,
            493,
            494,
            495,
            496,
            497,
            498,
          ],
        },
      },
      Extension: 'm3u8',
    }));

    return {
      Inputs: [
        {
          AudioSelectors: {
            'Audio Selector 1': {
              DefaultSelection: 'DEFAULT',
              Offset: 0,
              ProgramSelection: 1,
              Pid: 1,
            },
          },
          VideoSelector: {
            ColorSpace: 'FOLLOW',
            Rotate: 'DEGREE_0',
            AlphaBehavior: 'DISCARD',
          },
          FilterEnable: 'AUTO',
          PsiControl: 'USE_PSI',
          FilterStrength: 0,
          DeblockFilter: 'DISABLED',
          DenoiseFilter: 'DISABLED',
          TimecodeSource: 'EMBEDDED',
          FileInput: settings.inputS3Uri,
        },
      ],
      OutputGroups: [
        {
          Name: 'HLS',
          OutputGroupSettings: {
            Type: 'HLS_GROUP_SETTINGS',
            HlsGroupSettings: {
              ManifestDurationFormat: 'INTEGER',
              SegmentLength: 10,
              TimedMetadataId3Period: 10,
              CaptionLanguageSetting: 'OMIT',
              CaptionLanguageGroupSettings: {
                LanguageCode: 'EN',
                LanguageDescription: 'English',
              },
              Destination: `${settings.outputS3Uri}/`,
              SegmentControl: 'SEGMENTED_FILES',
              MinSegmentLength: 0,
              MinFinalSegmentLength: 0,
              OutputSelection: 'MANIFESTS_AND_SEGMENTS',
              ProgramDateTime: 'EXCLUDE',
              ProgramDateTimePeriod: 600,
              TimedMetadataId3Frame: 'NONE',
              DirectoryStructure: 'SINGLE_DIRECTORY',
              SegmentModifier: '',
            },
          },
          Outputs: outputs,
        },
      ],
      AdAvailOffset: 0,
      TimecodeConfig: {
        Source: 'EMBEDDED',
      },
    };
  }

  private calculateJobProgress(job: any): number {
    if (!job.OutputGroupDetails) return 0;

    let totalProgress = 0;
    let outputCount = 0;

    job.OutputGroupDetails.forEach((outputGroup: any) => {
      if (outputGroup.OutputDetails) {
        outputGroup.OutputDetails.forEach((output: any) => {
          if (output.OutputFilePaths && output.OutputFilePaths.length > 0) {
            totalProgress += 100;
          } else {
            totalProgress += output.ProgressInSeconds || 0;
          }
          outputCount++;
        });
      }
    });

    return outputCount > 0 ? Math.round(totalProgress / outputCount) : 0;
  }

  private getAccountId(): string {
    // In a real implementation, you might want to get this from AWS STS
    // For now, we'll use a placeholder or environment variable
    return process.env.AWS_ACCOUNT_ID || '123456789012';
  }

  getCloudFrontUrl(key: string): string {
    if (config.aws.cloudFrontDomain) {
      return `https://${config.aws.cloudFrontDomain}/${key}`;
    }
    return `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  }
}

export const awsMediaConvertService = new AWSMediaConvertService();
