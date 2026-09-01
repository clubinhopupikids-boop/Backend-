import { PutObjectCommand } from '@aws-sdk/client-s3';
import { putLibraryObject } from './r2-library-client';

describe('R2 library upload client', () => {
  it('sends the stable MP4 key, MIME type and checksum as S3 metadata', async () => {
    const client = { send: jest.fn().mockResolvedValue({}) };

    await putLibraryObject(
      client as never,
      'pupimundo-media',
      'library/music/eu-consigo/video.mp4',
      new Uint8Array([1, 2, 3]),
      'video/mp4',
      'sha256-value',
    );

    const command = client.send.mock.calls[0][0] as PutObjectCommand;
    expect(command.input).toEqual(
      expect.objectContaining({
        Bucket: 'pupimundo-media',
        Key: 'library/music/eu-consigo/video.mp4',
        ContentType: 'video/mp4',
        Metadata: { sha256: 'sha256-value' },
      }),
    );
  });

  it('supports the thumbnail content type with its own stable key', async () => {
    const client = { send: jest.fn().mockResolvedValue({}) };

    await putLibraryObject(
      client as never,
      'pupimundo-media',
      'library/music/eu-consigo/thumbnail.webp',
      new Uint8Array([1]),
      'image/webp',
      'thumbnail-sha256',
    );

    expect((client.send.mock.calls[0][0] as PutObjectCommand).input).toEqual(
      expect.objectContaining({
        Key: 'library/music/eu-consigo/thumbnail.webp',
        ContentType: 'image/webp',
      }),
    );
  });
});
