import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from 'src/config/app.config';

export interface R2ObjectInfo {
  exists: boolean;
  metadata?: Record<string, string>;
}

@Injectable()
export class R2StorageService {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const r2 = this.r2Config();
    return Boolean(
      r2.bucketName &&
      (r2.publicBaseUrl || (r2.accessKeyId && r2.secretAccessKey && (r2.endpoint || r2.accountId))),
    );
  }

  async getReadUrl(storageKey: string): Promise<string> {
    const r2 = this.r2Config();
    if (r2.publicBaseUrl) {
      return `${r2.publicBaseUrl.replace(/\/+$/, '')}/${storageKey.replace(/^\/+/, '')}`;
    }

    const { bucketName, signedUrlTtlSeconds } = this.requirePrivateConfig();
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: bucketName, Key: storageKey }),
      { expiresIn: signedUrlTtlSeconds },
    );
  }

  async headObject(storageKey: string): Promise<R2ObjectInfo> {
    const { bucketName } = this.requirePrivateConfig();
    try {
      const result: HeadObjectCommandOutput = await this.getClient().send(
        new HeadObjectCommand({ Bucket: bucketName, Key: storageKey }),
      );
      return { exists: true, metadata: result.Metadata };
    } catch (error: unknown) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (statusCode === 404) {
        return { exists: false };
      }
      throw error;
    }
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const r2 = this.requirePrivateConfig();
    this.client = new S3Client({
      region: 'auto',
      endpoint: r2.endpoint,
      credentials: {
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
      },
    });
    return this.client;
  }

  private r2Config(): AppConfig['r2'] {
    return this.config.getOrThrow<AppConfig['r2']>('app.r2');
  }

  private requirePrivateConfig(): Required<
    Pick<
      AppConfig['r2'],
      'accountId' | 'accessKeyId' | 'secretAccessKey' | 'bucketName' | 'endpoint'
    >
  > &
    AppConfig['r2'] {
    const r2 = this.r2Config();
    const endpoint =
      r2.endpoint ??
      (r2.accountId ? `https://${r2.accountId}.r2.cloudflarestorage.com` : undefined);
    if (!r2.bucketName || !r2.accessKeyId || !r2.secretAccessKey || !endpoint) {
      throw new ServiceUnavailableException(
        'Library media storage is not configured. Configure R2 before publishing AVAILABLE content.',
      );
    }
    return { ...r2, endpoint } as Required<
      Pick<
        AppConfig['r2'],
        'accountId' | 'accessKeyId' | 'secretAccessKey' | 'bucketName' | 'endpoint'
      >
    > &
      AppConfig['r2'];
  }
}
