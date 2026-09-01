import { CatalogStatus, PrismaClient } from '@prisma/client';
import { LIBRARY_MUSIC_CATALOG } from '../prisma/library-music-catalog';
import { configuredR2Client, remoteObject } from './r2-library-client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const { client, bucketName } = configuredR2Client();
  for (const item of LIBRARY_MUSIC_CATALOG) {
    const [video, thumbnail] = await Promise.all([
      remoteObject(client, bucketName, item.storageKey),
      remoteObject(client, bucketName, item.thumbnailStorageKey),
    ]);
    if (!video || !thumbnail) {
      throw new Error(
        `Publicação interrompida: objetos ausentes para ${item.code}. Faça e valide o upload primeiro.`,
      );
    }
  }
  await prisma.$transaction(
    LIBRARY_MUSIC_CATALOG.map((item) =>
      prisma.libraryContent.update({
        where: { code: item.code },
        data: { status: CatalogStatus.AVAILABLE },
      }),
    ),
  );
  console.log('As 18 músicas foram publicadas após a verificação dos objetos R2.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
