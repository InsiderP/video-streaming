import fs from 'fs';
import path from 'path';
import { S3 } from 'aws-sdk';
import { config } from '../config/environment';

const s3 = new S3({
  region: config.storage.s3Region,
  accessKeyId: config.storage.s3AccessKey,
  secretAccessKey: config.storage.s3SecretKey,
  endpoint: config.storage.s3Endpoint || undefined,
  s3ForcePathStyle: !!config.storage.s3Endpoint,
});

export async function uploadFileToS3(opts: {
  bucket?: string;
  key: string;
  filePath: string;
  contentType?: string;
  acl?: 'private' | 'public-read';
}): Promise<string> {
  const bucket = opts.bucket || (config.storage.s3Bucket as string);
  const fileStream = fs.createReadStream(opts.filePath);
  await s3
    .upload({
      Bucket: bucket,
      Key: opts.key,
      Body: fileStream,
      ACL: opts.acl || 'public-read',
      ContentType: opts.contentType,
    })
    .promise();
  return getS3PublicUrl({ bucket, key: opts.key });
}

export async function uploadDirectoryToS3(opts: {
  bucket?: string;
  prefix: string;
  directoryPath: string;
  acl?: 'private' | 'public-read';
}): Promise<string[]> {
  const uploaded: string[] = [];
  const bucket = opts.bucket || (config.storage.s3Bucket as string);

  function walk(dir: string): string[] {
    return fs.readdirSync(dir).flatMap((name) => {
      const fp = path.join(dir, name);
      return fs.statSync(fp).isDirectory() ? walk(fp) : [fp];
    });
  }

  const files = walk(opts.directoryPath);
  for (const file of files) {
    const relative = path.relative(opts.directoryPath, file);
    const key = path.posix.join(opts.prefix, relative).replace(/\\/g, '/');
    const url = await uploadFileToS3({ bucket, key, filePath: file, acl: opts.acl || 'public-read' });
    uploaded.push(url);
  }
  return uploaded;
}

export function getS3PublicUrl({ bucket, key }: { bucket: string; key: string }): string {
  if (config.storage.s3Endpoint) {
    // Custom endpoint (e.g., MinIO)
    const base = config.storage.s3Endpoint.replace(/\/$/, '');
    return `${base}/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.${config.storage.s3Region}.amazonaws.com/${key}`;
}
