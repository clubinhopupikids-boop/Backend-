import { PrismaClient } from '@prisma/client';
import { seedMissions } from './seed-missions';
import { seedLibraryMusic } from './seed-library-music';

const prisma = new PrismaClient();

// Seed the extensible set of communication modalities. Adding a new modality
// later only requires a new row here, not a schema migration for an enum.
const modes = [
  { code: 'VOICE', label: 'Voice' },
  { code: 'IMAGES_SYMBOLS', label: 'Images / Symbols' },
  { code: 'TOUCH', label: 'Touch' },
  { code: 'TEXT', label: 'Text' },
  { code: 'SUPPORTED_COMMUNICATION', label: 'Supported communication' },
];

async function main() {
  for (const mode of modes) {
    await prisma.communicationMode.upsert({
      where: { code: mode.code },
      update: { label: mode.label },
      create: mode,
    });
  }
  const missionCount = await seedMissions(prisma);
  const libraryMusicCount = await seedLibraryMusic(prisma);
  console.log(
    `Seeded ${modes.length} communication modes, ${missionCount} missions and ${libraryMusicCount} library music entries.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
