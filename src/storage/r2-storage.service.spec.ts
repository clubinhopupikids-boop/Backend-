import { ServiceUnavailableException } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppConfig } from 'src/config/app.config';
import { R2StorageService } from './r2-storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

describe('R2StorageService', () => {
  const r2: AppConfig['r2'] = {
    accountId: 'account',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    bucketName: 'pupimundo-media',
    endpoint: 'https://account.r2.cloudflarestorage.com',
    publicBaseUrl: undefined,
    signedUrlTtlSeconds: 1800,
  };
  const config = { getOrThrow: jest.fn(() => r2) };

  beforeEach(() => {
    jest.clearAllMocks();
    config.getOrThrow.mockReset().mockReturnValue(r2);
  });

  it('generates a temporary read URL for the MP4 key without exposing credentials', async () => {
    mockedGetSignedUrl.mockResolvedValue('https://signed.example/video.mp4?signature=temporary');
    const service = new R2StorageService(config as never);

    await expect(service.getReadUrl('library/music/eu-consigo/video.mp4')).resolves.toContain(
      'signed.example',
    );
    expect(mockedGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({ Key: 'library/music/eu-consigo/video.mp4' }),
      }),
      { expiresIn: 1800 },
    );
  });

  it('uses a configured public base URL without constructing an R2 client', async () => {
    config.getOrThrow.mockReturnValue({ ...r2, publicBaseUrl: 'https://cdn.example/media/' });
    const service = new R2StorageService(config as never);

    await expect(service.getReadUrl('library/music/eu-consigo/thumbnail.webp')).resolves.toBe(
      'https://cdn.example/media/library/music/eu-consigo/thumbnail.webp',
    );
    expect(mockedGetSignedUrl).not.toHaveBeenCalled();
  });

  it('returns an absent object result for a 404 without leaking credentials', async () => {
    const service = new R2StorageService(config as never);
    (service as unknown as { client: { send: jest.Mock } }).client = {
      send: jest.fn().mockRejectedValue({ $metadata: { httpStatusCode: 404 } }),
    };

    await expect(service.headObject('library/music/eu-consigo/video.mp4')).resolves.toEqual({
      exists: false,
    });
  });

  it('fails only when a storage operation needs missing private configuration', async () => {
    config.getOrThrow.mockReturnValue({ ...r2, bucketName: undefined, accessKeyId: undefined });
    const service = new R2StorageService(config as never);

    await expect(service.getReadUrl('library/music/eu-consigo/video.mp4')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
