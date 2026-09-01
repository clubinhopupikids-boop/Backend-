import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';

export interface R2ScriptConfig {
  bucketName: string;
  client: S3Client;
}

export function configuredR2Client(): R2ScriptConfig {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const endpoint =
    process.env.R2_ENDPOINT ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  if (!accessKeyId || !secretAccessKey || !bucketName || !endpoint) {
    throw new Error(
      'R2 não está configurado. Defina R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_ENDPOINT (ou R2_ACCOUNT_ID).',
    );
  }
  return {
    bucketName,
    client: new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export async function remoteObject(
  client: S3Client,
  bucketName: string,
  key: string,
): Promise<HeadObjectCommandOutput | undefined> {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
  } catch (error: unknown) {
    const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode;
    if (statusCode === 404) return undefined;
    throw error;
  }
}

export async function putLibraryObject(
  client: S3Client,
  bucketName: string,
  key: string,
  body: Uint8Array,
  contentType: string,
  sha256: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: { sha256 },
    }),
  );
}
