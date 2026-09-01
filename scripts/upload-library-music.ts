import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LIBRARY_MUSIC_CATALOG } from '../prisma/library-music-catalog';
import { configuredR2Client, putLibraryObject, remoteObject } from './r2-library-client';

interface PreparedManifestItem {
  code: string;
  storageKey: string;
  thumbnailStorageKey: string;
  videoSha256: string;
  thumbnailSha256: string;
}

interface PreparedManifest {
  itemCount: number;
  items: PreparedManifestItem[];
}

async function main(): Promise<void> {
  const preparedRoot = resolve(process.cwd(), 'prepared-media', 'library', 'music');
  const manifest = JSON.parse(
    await readFile(resolve(preparedRoot, 'technical-manifest.json'), 'utf8'),
  ) as PreparedManifest;
  if (manifest.itemCount !== 18 || manifest.items.length !== 18) {
    throw new Error('Manifesto técnico inválido: são esperadas exatamente 18 músicas preparadas.');
  }
  const catalogByCode = new Map(LIBRARY_MUSIC_CATALOG.map((item) => [item.code, item]));
  if (manifest.items.some((item) => !catalogByCode.has(item.code))) {
    throw new Error('Manifesto técnico contém música que não pertence ao catálogo versionado.');
  }

  const { client, bucketName } = configuredR2Client();
  const differing: string[] = [];
  const missing: Array<{ key: string; contentType: string; sha256: string; file: string }> = [];
  for (const item of manifest.items) {
    const catalog = catalogByCode.get(item.code);
    if (
      !catalog ||
      catalog.storageKey !== item.storageKey ||
      catalog.thumbnailStorageKey !== item.thumbnailStorageKey
    ) {
      throw new Error(
        `Storage keys divergentes para ${item.code}. Execute novamente a preparação a partir do catálogo atual.`,
      );
    }
    const objects = [
      {
        key: item.storageKey,
        contentType: 'video/mp4',
        sha256: item.videoSha256,
        file: resolve(preparedRoot, catalog.slug, 'video.mp4'),
      },
      {
        key: item.thumbnailStorageKey,
        contentType: 'image/webp',
        sha256: item.thumbnailSha256,
        file: resolve(preparedRoot, catalog.slug, 'thumbnail.webp'),
      },
    ];
    for (const object of objects) {
      const remote = await remoteObject(client, bucketName, object.key);
      if (!remote) missing.push(object);
      else if (remote.Metadata?.sha256 !== object.sha256) differing.push(object.key);
    }
  }
  if (differing.length) {
    throw new Error(
      `Upload interrompido: ${differing.length} objeto(s) remoto(s) têm checksum diferente e não serão sobrescritos: ${differing.join(', ')}`,
    );
  }

  for (const object of missing) {
    await putLibraryObject(
      client,
      bucketName,
      object.key,
      await readFile(object.file),
      object.contentType,
      object.sha256,
    );
    console.log(`Enviado: ${object.key}`);
  }
  console.log(
    `Upload idempotente concluído: ${missing.length} objeto(s) novo(s), ${36 - missing.length} já correspondente(s).`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
