import { PrismaClient } from '@prisma/client';
import { seedLibraryMusic } from '../prisma/seed-library-music';

const prisma = new PrismaClient();

seedLibraryMusic(prisma)
  .then((count) => console.log(`Catálogo de músicas registrado: ${count} entradas em COMING_SOON.`))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
