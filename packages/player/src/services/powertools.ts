import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { formatArtistNames, type Track } from '@nuclearplayer/model';

import { useFavoritesStore } from '../stores/favoritesStore';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';
import { Logger } from './logger';

type ScoredTrack = { track: Track; score: number };

const recentIds = new Set<string>();

const trackId = (track: Track): string => `${track.source.provider}:${track.source.id}`;

const score = (track: Track, context: Track[]): number => {
  const id = trackId(track);
  if (recentIds.has(id)) return -100;

  const artist = formatArtistNames(track.artists);
  const artistHits = context.filter(
    (candidate) => formatArtistNames(candidate.artists) === artist,
  ).length;

  return 5 + Math.min(artistHits, 4) * 2 + Math.random() * 2;
};

const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const favoriteShuffle = (count = 50): void => {
  const favorites = useFavoritesStore.getState().tracks.map((entry) => entry.ref);
  if (!favorites.length) return;

  const candidates = shuffle(favorites).slice(0, Math.min(count, favorites.length));
  useQueueStore.getState().addToQueue(candidates);
  useQueueStore.getState().goToId(useQueueStore.getState().items.at(-candidates.length)?.id ?? '');
};

export const startWave = (count = 40): void => {
  const favorites = useFavoritesStore.getState().tracks.map((entry) => entry.ref);
  if (!favorites.length) return;

  const ranked: ScoredTrack[] = favorites
    .map((track) => ({ track, score: score(track, favorites) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(count, favorites.length));

  const tracks = ranked.map(({ track }) => track);
  useQueueStore.getState().addToQueue(tracks);
};

export const openLyricsForCurrentTrack = async (): Promise<void> => {
  const item = useQueueStore.getState().getCurrentItem();
  if (!item) return;

  const track = item.track;
  const artist = formatArtistNames(track.artists);
  try {
    await invoke('genius_lyrics', { artist, title: track.title });
  } catch (error) {
    Logger.warn(`PowerTools lyrics request failed: ${String(error)}`);
  }
};

export const initPowerToolsService = (): void => {
  void listen('powertools:favorite-shuffle', () => favoriteShuffle());
  void listen('powertools:wave', () => startWave());
  void listen('powertools:lyrics', () => void openLyricsForCurrentTrack());
  void listen('powertools:play-toggle', () => {
    const sound = useSoundStore.getState();
    if (sound.status === 'playing') sound.pause();
    else sound.play();
  });
  void listen('powertools:previous', () => useQueueStore.getState().goToPrevious());
  void listen('powertools:next', () => useQueueStore.getState().goToNext());

  useQueueStore.subscribe((state) => {
    const current = state.getCurrentItem();
    if (current) recentIds.add(trackId(current.track));
    if (recentIds.size > 50) {
      const first = recentIds.values().next().value;
      if (first) recentIds.delete(first);
    }
  });
};
