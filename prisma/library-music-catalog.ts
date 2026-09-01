import {
  CatalogStatus,
  LibraryContentType,
  LibraryMediaFormat,
  LibraryTheme,
} from '@prisma/client';

export interface LibraryMusicCatalogItem {
  code: string;
  title: string;
  sourceFileName: string;
  slug: string;
  type: LibraryContentType;
  mediaFormat: LibraryMediaFormat;
  mimeType: string;
  theme: LibraryTheme;
  sortOrder: number;
  storageKey: string;
  thumbnailStorageKey: string;
  /** Optional preparation-pipeline override; undefined uses the 25% default. */
  thumbnailPercent?: number;
  status: CatalogStatus;
}

const music = (
  sortOrder: number,
  code: string,
  title: string,
  sourceFileName: string,
  slug: string,
  theme: LibraryTheme,
  thumbnailPercent?: number,
): LibraryMusicCatalogItem => ({
  code,
  title,
  sourceFileName,
  slug,
  type: LibraryContentType.MUSIC,
  mediaFormat: LibraryMediaFormat.VIDEO,
  mimeType: 'video/mp4',
  theme,
  sortOrder,
  storageKey: `library/music/${slug}/video.mp4`,
  thumbnailStorageKey: `library/music/${slug}/thumbnail.webp`,
  thumbnailPercent,
  // Media is only published by the explicit post-upload verification command.
  status: CatalogStatus.COMING_SOON,
});

/**
 * Versioned editorial catalog. Technical duration/checksum values are derived
 * from the real source files by scripts/prepare-library-music.ts.
 */
export const LIBRARY_MUSIC_CATALOG: readonly LibraryMusicCatalogItem[] = [
  music(
    1,
    'music_mealtime_with_pupi',
    'A Hora da Refeição Divertida do Pupi',
    'A Hora da Refeição Divertida do Pupi.mp4',
    'a-hora-da-refeicao-divertida-do-pupi',
    LibraryTheme.ROUTINE,
  ),
  music(
    2,
    'music_bath_time_with_pupi',
    'A Hora do Banho Divertida do Pupi',
    'A Hora do Banho Divertida do Pupi.mp4',
    'a-hora-do-banho-divertida-do-pupi',
    LibraryTheme.ROUTINE,
    30,
  ),
  music(
    3,
    'music_wake_up_with_pupi',
    'Acorde com Pupi',
    'Acorde com Pupi.mp4',
    'acorde-com-pupi',
    LibraryTheme.ROUTINE,
  ),
  music(
    4,
    'music_gentle_good_night',
    'O Boa Noite Gentil do Pupi',
    'O Boa Noite Gentil do Pupi.mp4',
    'o-boa-noite-gentil-do-pupi',
    LibraryTheme.ROUTINE,
    70,
  ),
  music(
    5,
    'music_i_can_talk_about_my_feelings',
    'Posso falar o que sinto!',
    'Posso falar o que sinto!.mp4',
    'posso-falar-o-que-sinto',
    LibraryTheme.EMOTIONS,
  ),
  music(
    6,
    'music_i_need_to_calm_down',
    'Preciso me Acalmar',
    'Preciso me Acalmar.mp4',
    'preciso-me-acalmar',
    LibraryTheme.EMOTIONS,
  ),
  music(
    7,
    'music_my_body_is_talking',
    'Meu corpo está falando!',
    'Meu corpo está falando!.mp4',
    'meu-corpo-esta-falando',
    LibraryTheme.EMOTIONS,
  ),
  music(
    8,
    'music_pupi_chases_fear_away',
    'Pupi espanta o medo',
    'Pupi espanta o medo.mp4',
    'pupi-espanta-o-medo',
    LibraryTheme.EMOTIONS,
  ),
  music(
    9,
    'music_breathe_to_ease_anger',
    'Respire para Aliviar a raiva',
    'Respire para Aliviar a raiva.mp4',
    'respire-para-aliviar-a-raiva',
    LibraryTheme.EMOTIONS,
  ),
  music(
    10,
    'music_its_okay_to_fail',
    'Tudo bem falhar',
    'Tudo bem falhar.mp4',
    'tudo-bem-falhar',
    LibraryTheme.EMOTIONS,
    10,
  ),
  music(
    11,
    'music_wait_your_turn',
    'Espere a Sua Vez',
    'Espere a Sua Vez.mp4',
    'espere-a-sua-vez',
    LibraryTheme.SOCIAL,
  ),
  music(
    12,
    'music_friends_share',
    'Amigos Dividem',
    'Amigos Dividem.mp4',
    'amigos-dividem',
    LibraryTheme.SOCIAL,
  ),
  music(
    13,
    'music_pupis_cozy_hug',
    'O Abraço Aconchegante do Pupi',
    'O Abraço Aconchegante do Pupi.mp4',
    'o-abraco-aconchegante-do-pupi',
    LibraryTheme.SOCIAL,
    30,
  ),
  music(
    14,
    'music_i_can_do_it',
    'Eu Consigo!',
    'Eu Consigo!.mp4',
    'eu-consigo',
    LibraryTheme.DEVELOPMENT,
    70,
  ),
  music(
    15,
    'music_growing_is_good',
    'Crescer é Bom!',
    'Crescer é Bom!.mp4',
    'crescer-e-bom',
    LibraryTheme.DEVELOPMENT,
  ),
  music(
    16,
    'music_grow_at_your_own_pace',
    'Cresça no seu próprio ritmo',
    'Cresça no seu próprio ritmo.mp4',
    'cresca-no-seu-proprio-ritmo',
    LibraryTheme.DEVELOPMENT,
  ),
  music(
    17,
    'music_change_is_okay',
    'Tudo muda, tudo fica bem',
    'Tudo muda, tudo fica bem.mp4',
    'tudo-muda-tudo-fica-bem',
    LibraryTheme.DEVELOPMENT,
    70,
  ),
  music(
    18,
    'music_dance_with_pupi',
    'Dance com o Pupi',
    'Dance com o Pupi.mp4',
    'dance-com-o-pupi',
    LibraryTheme.MOVEMENT,
  ),
];
