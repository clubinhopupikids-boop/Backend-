import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  LIBRARY_MUSIC_CATALOG,
  type LibraryMusicCatalogItem,
} from '../prisma/library-music-catalog';

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  sample_rate?: string;
  channels?: number;
}

interface FfprobeResult {
  format?: { duration?: string; bit_rate?: string; format_name?: string };
  streams?: FfprobeStream[];
}

interface PreparedMusicItem {
  code: string;
  title: string;
  storageKey: string;
  thumbnailStorageKey: string;
  durationSeconds: number;
  resolution: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  audioSampleRate: number | null;
  audioChannels: number | null;
  originalSizeBytes: number;
  preparedSizeBytes: number;
  bitrateKbps: number | null;
  thumbnailPercent: number;
  thumbnailTimestampSeconds: number;
  thumbnailCreated: boolean;
  videoSha256: string;
  thumbnailSha256: string;
  warnings: string[];
}

interface PreviousPreparedMusicItem {
  code: string;
  videoSha256: string;
  thumbnailPercent?: number;
}

interface PreviousTechnicalManifest {
  items?: PreviousPreparedMusicItem[];
}

export const DEFAULT_THUMBNAIL_PERCENT = 25;

const DEFAULT_SOURCE = resolve(
  process.cwd(),
  '..',
  '..',
  'Mídias, conteudos e documentação',
  'Musicas',
  'Musicas',
);
const DEFAULT_OUTPUT = resolve(process.cwd(), 'prepared-media', 'library', 'music');

function argumentValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : fallback;
}

function commandAvailable(command: string): boolean {
  try {
    execFileSync(command, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function canonicalName(value: string): string {
  return value.normalize('NFC').trim();
}

/** Resolves pipeline configuration only; no title-based special cases exist. */
export function resolveThumbnailPercent(
  item: Pick<LibraryMusicCatalogItem, 'code' | 'thumbnailPercent'>,
): number {
  const thumbnailPercent = item.thumbnailPercent ?? DEFAULT_THUMBNAIL_PERCENT;
  if (!Number.isFinite(thumbnailPercent) || thumbnailPercent <= 0 || thumbnailPercent >= 100) {
    throw new Error(
      `thumbnailPercent inválido para ${item.code}: ${String(thumbnailPercent)}. Use um número maior que 0 e menor que 100.`,
    );
  }
  return thumbnailPercent;
}

/** Uses the real ffprobe duration, never a catalog or display-duration value. */
export function thumbnailTimestampSeconds(
  durationSeconds: number,
  thumbnailPercent: number,
): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Duração inválida para thumbnail: ${String(durationSeconds)}.`);
  }
  return (durationSeconds * thumbnailPercent) / 100;
}

function ffprobe(file: string): FfprobeResult {
  return JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], {
      encoding: 'utf8',
    }),
  ) as FfprobeResult;
}

function technicalDetails(probe: FfprobeResult) {
  const video = probe.streams?.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams?.find((stream) => stream.codec_type === 'audio');
  const durationSeconds = Number(probe.format?.duration ?? 0);
  const bitrate = Number(probe.format?.bit_rate ?? 0);
  return {
    durationSeconds,
    bitrateKbps: Number.isFinite(bitrate) && bitrate > 0 ? Math.round(bitrate / 1000) : null,
    resolution: video?.width && video.height ? `${video.width}x${video.height}` : null,
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    audioSampleRate: audio?.sample_rate ? Number(audio.sample_rate) : null,
    audioChannels: audio?.channels ?? null,
    formatName: probe.format?.format_name ?? null,
  };
}

async function sha256(file: string): Promise<string> {
  const content = await readFile(file);
  return createHash('sha256').update(content).digest('hex');
}

async function readPreviousManifest(
  outputRoot: string,
): Promise<Map<string, PreviousPreparedMusicItem>> {
  try {
    const manifest = JSON.parse(
      await readFile(resolve(outputRoot, 'technical-manifest.json'), 'utf8'),
    ) as PreviousTechnicalManifest;
    return new Map((manifest.items ?? []).map((item) => [item.code, item]));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map();
    throw new Error(`Não foi possível ler o manifesto técnico anterior: ${String(error)}`);
  }
}

async function validateSourceFiles(sourceDir: string): Promise<Map<string, string>> {
  if (!existsSync(sourceDir)) {
    throw new Error(`Diretório de origem não encontrado: ${sourceDir}`);
  }
  const mp4Files = (await readdir(sourceDir)).filter((name) => name.toLowerCase().endsWith('.mp4'));
  const expected = new Set(LIBRARY_MUSIC_CATALOG.map((item) => canonicalName(item.sourceFileName)));
  const found = new Set(mp4Files.map(canonicalName));
  const extra = mp4Files.filter((name) => !expected.has(canonicalName(name)));
  const missing = LIBRARY_MUSIC_CATALOG.filter(
    (item) => !found.has(canonicalName(item.sourceFileName)),
  );

  if (
    mp4Files.length !== 18 ||
    LIBRARY_MUSIC_CATALOG.length !== 18 ||
    extra.length ||
    missing.length
  ) {
    throw new Error(
      [
        `Validação do catálogo falhou: ${mp4Files.length} MP4 encontrados e ${LIBRARY_MUSIC_CATALOG.length} itens de catálogo.`,
        extra.length ? `Arquivos sem catálogo: ${extra.join(', ')}` : '',
        missing.length
          ? `Itens sem arquivo: ${missing.map((item) => item.sourceFileName).join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return new Map(mp4Files.map((file) => [canonicalName(file), resolve(sourceDir, file)]));
}

async function prepareOne(
  item: LibraryMusicCatalogItem,
  source: string,
  outputRoot: string,
  previous?: PreviousPreparedMusicItem,
): Promise<PreparedMusicItem> {
  const sourceProbe = technicalDetails(ffprobe(source));
  const warnings: string[] = [];
  if (!sourceProbe.formatName?.includes('mp4'))
    warnings.push(`container=${sourceProbe.formatName ?? 'desconhecido'}`);
  if (sourceProbe.videoCodec !== 'h264')
    warnings.push(`videoCodec=${sourceProbe.videoCodec ?? 'ausente'}`);
  if (sourceProbe.audioCodec !== 'aac')
    warnings.push(`audioCodec=${sourceProbe.audioCodec ?? 'ausente'}`);
  if (sourceProbe.resolution !== '1920x1080')
    warnings.push(`resolution=${sourceProbe.resolution ?? 'ausente'}`);
  if (!Number.isFinite(sourceProbe.durationSeconds) || sourceProbe.durationSeconds <= 0) {
    throw new Error(`${basename(source)} não possui duração válida.`);
  }

  const targetDir = resolve(outputRoot, item.slug);
  const videoPath = resolve(targetDir, 'video.mp4');
  const thumbnailPath = resolve(targetDir, 'thumbnail.webp');
  await mkdir(targetDir, { recursive: true });

  let outputProbe: ReturnType<typeof technicalDetails>;
  let preparedStats: Awaited<ReturnType<typeof stat>>;
  let videoSha256: string;
  const canReusePreparedVideo =
    Boolean(previous?.videoSha256) &&
    existsSync(videoPath) &&
    (await sha256(videoPath)) === previous?.videoSha256;

  if (canReusePreparedVideo) {
    outputProbe = technicalDetails(ffprobe(videoPath));
    preparedStats = await stat(videoPath);
    videoSha256 = previous!.videoSha256;
  } else {
    // Remux only: media streams remain byte-for-byte encoded as supplied.
    execFileSync(
      'ffmpeg',
      ['-y', '-i', source, '-map', '0', '-c', 'copy', '-movflags', '+faststart', videoPath],
      { stdio: 'inherit' },
    );
    outputProbe = technicalDetails(ffprobe(videoPath));
    preparedStats = await stat(videoPath);
    videoSha256 = await sha256(videoPath);
  }
  if (!Number.isFinite(outputProbe.durationSeconds) || outputProbe.durationSeconds <= 0) {
    throw new Error(`Fast Start produziu um MP4 inválido: ${videoPath}`);
  }

  const thumbnailPercent = resolveThumbnailPercent(item);
  const thumbnailSeconds = thumbnailTimestampSeconds(outputProbe.durationSeconds, thumbnailPercent);
  const previousPercent = previous?.thumbnailPercent ?? DEFAULT_THUMBNAIL_PERCENT;
  const shouldRegenerateThumbnail =
    !existsSync(thumbnailPath) || !previous || previousPercent !== thumbnailPercent;
  if (shouldRegenerateThumbnail) {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-ss',
        thumbnailSeconds.toFixed(3),
        '-i',
        videoPath,
        '-frames:v',
        '1',
        '-vf',
        "scale='min(960,iw)':-2",
        '-c:v',
        'libwebp',
        '-quality',
        '85',
        thumbnailPath,
      ],
      { stdio: 'inherit' },
    );
  }

  const [sourceStats, thumbnailStats] = await Promise.all([stat(source), stat(thumbnailPath)]);
  return {
    code: item.code,
    title: item.title,
    storageKey: item.storageKey,
    thumbnailStorageKey: item.thumbnailStorageKey,
    // Whole seconds are rounded to the closest second consistently for the API.
    durationSeconds: Math.round(outputProbe.durationSeconds),
    resolution: outputProbe.resolution,
    videoCodec: outputProbe.videoCodec,
    audioCodec: outputProbe.audioCodec,
    audioSampleRate: outputProbe.audioSampleRate,
    audioChannels: outputProbe.audioChannels,
    originalSizeBytes: sourceStats.size,
    preparedSizeBytes: preparedStats.size,
    bitrateKbps: outputProbe.bitrateKbps,
    thumbnailPercent,
    thumbnailTimestampSeconds: thumbnailSeconds,
    thumbnailCreated: thumbnailStats.size > 0,
    videoSha256,
    thumbnailSha256: await sha256(thumbnailPath),
    warnings,
  };
}

async function main(): Promise<void> {
  const sourceDir = argumentValue('--source', DEFAULT_SOURCE);
  const outputRoot = argumentValue('--output', DEFAULT_OUTPUT);
  const sourceFiles = await validateSourceFiles(sourceDir);
  console.log(
    `Catálogo validado: ${sourceFiles.size} MP4 encontrados, 18 itens e 18 correspondências.`,
  );
  if (!commandAvailable('ffprobe') || !commandAvailable('ffmpeg')) {
    throw new Error(
      'ffmpeg e ffprobe são obrigatórios para preparar as músicas. Instale-os e confirme que ambos estão no PATH antes de executar novamente.',
    );
  }
  const previousItems = await readPreviousManifest(outputRoot);
  const prepared: PreparedMusicItem[] = [];

  for (const item of LIBRARY_MUSIC_CATALOG) {
    const source = sourceFiles.get(canonicalName(item.sourceFileName));
    if (!source) throw new Error(`Correspondência ausente para ${item.sourceFileName}`);
    prepared.push(await prepareOne(item, source, outputRoot, previousItems.get(item.code)));
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDir,
    itemCount: prepared.length,
    items: prepared,
  };
  const sizes = prepared
    .map((entry) => entry.preparedSizeBytes)
    .sort((left, right) => left - right);
  const medianSize = sizes[Math.floor(sizes.length / 2)];
  const outliers = prepared.filter((entry) => entry.preparedSizeBytes > medianSize * 2);
  await writeFile(
    resolve(outputRoot, 'technical-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    resolve(outputRoot, 'technical-report.md'),
    [
      '# Biblioteca Sensorial — relatório técnico',
      '',
      '| Título | Duração | Thumbnail % | Timestamp thumbnail | Resolução | Vídeo | Áudio | Original | Fast Start | Bitrate | Thumbnail | SHA-256 vídeo |',
      '| --- | ---: | ---: | ---: | --- | --- | --- | ---: | ---: | ---: | --- | --- |',
      ...prepared.map(
        (entry) =>
          `| ${entry.title} | ${entry.durationSeconds}s | ${entry.thumbnailPercent}% | ${entry.thumbnailTimestampSeconds.toFixed(3)}s | ${entry.resolution ?? '-'} | ${entry.videoCodec ?? '-'} | ${entry.audioCodec ?? '-'} | ${entry.originalSizeBytes} | ${entry.preparedSizeBytes} | ${entry.bitrateKbps ?? '-'} kbps | ${entry.thumbnailCreated ? 'sim' : 'não'} | ${entry.videoSha256} |`,
      ),
      '',
      ...prepared
        .filter((entry) => entry.warnings.length)
        .map((entry) => `- ${entry.title}: ${entry.warnings.join(', ')}`),
      '',
      '## Arquivos maiores que o dobro da mediana',
      '',
      ...(outliers.length
        ? outliers.map(
            (entry) =>
              `- ${entry.title}: ${(entry.preparedSizeBytes / 1024 / 1024).toFixed(2)} MiB (nenhuma recompressão foi aplicada).`,
          )
        : ['- Nenhum.']),
      '',
    ].join('\n'),
  );
  if (outliers.length) {
    console.warn(
      `Outliers sem recompressão: ${outliers.map((entry) => `${entry.title} (${(entry.preparedSizeBytes / 1024 / 1024).toFixed(2)} MiB)`).join(', ')}`,
    );
  }
  console.table(
    prepared.map((entry) => ({
      title: entry.title,
      durationSeconds: entry.durationSeconds,
      resolution: entry.resolution,
      videoCodec: entry.videoCodec,
      audioCodec: entry.audioCodec,
      thumbnailPercent: `${entry.thumbnailPercent}%`,
      thumbnailTimestampSeconds: entry.thumbnailTimestampSeconds.toFixed(3),
      preparedMiB: (entry.preparedSizeBytes / 1024 / 1024).toFixed(2),
      warnings: entry.warnings.join(', '),
    })),
  );
  console.log(`Preparação concluída: ${prepared.length}/18 itens em ${outputRoot}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
