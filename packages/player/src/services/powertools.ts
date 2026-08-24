import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { formatArtistNames, type Track } from '@nuclearplayer/model';

import { discoveryHost } from './discoveryHost';
import { providersHost } from './providersHost';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useLyricsStore, type LyricsData } from '../stores/lyricsStore';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';

const recentIds = new Set<string>();
const lyricsCache = new Map<string, LyricsData>();
let lastLyricsTrackId: string | null = null;

const trackId = (track: Track): string =>
  `${track.source.provider}:${track.source.id}`;

const score = (track: Track, context: Track[]): number => {
  if (recentIds.has(trackId(track))) {
    return -100;
  }

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
  const favorites = useFavoritesStore
    .getState()
    .tracks.map((entry) => entry.ref);

  if (!favorites.length) {
    return;
  }

  const candidates = shuffle(favorites).slice(
    0,
    Math.min(count, favorites.length),
  );
  const queue = useQueueStore.getState();
  const firstId = candidates[0]?.source.id;

  queue.addToQueue(candidates);

  const added = useQueueStore.getState().items.slice(-candidates.length);
  const first = added.find((item) => item.track.source.id === firstId);

  if (first) {
    queue.goToId(first.id);
  }
};

export const startWave = async (count = 40): Promise<void> => {
  const favorites = useFavoritesStore
    .getState()
    .tracks.map((entry) => entry.ref);
  const current = useQueueStore.getState().getCurrentItem()?.track;

  const context = current
    ? [current, ...favorites.filter((track) => trackId(track) !== trackId(current))]
    : favorites;

  if (!context.length) {
    return;
  }

  const discoveryProviderId = providersHost.getActive('discovery');
  if (!discoveryProviderId) {
    return;
  }

  const recommended = await discoveryHost.getRecommendations(
    context,
    {
      variety: 0.85,
      limit: Math.max(count * 3, 100),
    },
    discoveryProviderId,
  );

  const contextIds = new Set(context.map(trackId));
  const unique = new Map<string, Track>();

  for (const track of recommended) {
    const id = trackId(track);
    if (!contextIds.has(id) && !unique.has(id) && !recentIds.has(id)) {
      unique.set(id, track);
    }
  }

  const tracks = [...unique.values()]
    .map((track) => ({ track, score: score(track, context) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ track }) => track);

  if (tracks.length) {
    useQueueStore.getState().addToQueue(tracks);
  }
};

const loadLyrics = async (track: Track, open = true): Promise<void> => {
  const id = trackId(track);
  const artist = formatArtistNames(track.artists);
  const title = track.title;
  const lyricsStore = useLyricsStore.getState();

  if (open) {
    lyricsStore.setOpen(true);
  }

  const cached = lyricsCache.get(id);
  if (cached) {
    lyricsStore.setData(id, cached);
    return;
  }

  lyricsStore.setLoading(id);

  try {
    const result = await invoke<LyricsData>('genius_lyrics', {
      artist,
      title,
    });

    lyricsCache.set(id, result);
    lyricsStore.setData(id, result);
  } catch (error) {
    lyricsStore.setError(
      id,
      error instanceof Error ? error.message : String(error),
    );
  }
};

export const openLyricsForCurrentTrack = async (): Promise<void> => {
  const item = useQueueStore.getState().getCurrentItem();

  if (item) {
    await loadLyrics(item.track, true);
  }
};

const handleCurrentTrackChanged = (track: Track): void => {
  const id = trackId(track);

  if (id === lastLyricsTrackId) {
    return;
  }

  lastLyricsTrackId = id;
  void loadLyrics(track, true);
};

export const initPowerToolsService = (): void => {
  void listen('powertools:favorite-shuffle', () => favoriteShuffle());
  void listen('powertools:wave', () => void startWave());
  void listen('powertools:lyrics', () => void openLyricsForCurrentTrack());
  void listen('powertools:play-toggle', () => {
    const sound = useSoundStore.getState();

    if (sound.status === 'playing') {
      sound.pause();
    } else {
      sound.play();
    }
  });
  void listen('powertools:previous', () => {
    useQueueStore.getState().goToPrevious();
  });
  void listen('powertools:next', () => {
    useQueueStore.getState().goToNext();
  });

  useQueueStore.subscribe((state) => {
    const current = state.getCurrentItem();

    if (current) {
      recentIds.add(trackId(current.track));
      handleCurrentTrackChanged(current.track);
    }

    if (recentIds.size > 50) {
      const oldest = recentIds.values().next().value;

      if (oldest) {
        recentIds.delete(oldest);
      }
    }
  });

  const current = useQueueStore.getState().getCurrentItem()?.track;
  if (current) {
    handleCurrentTrackChanged(current);
  }
};
