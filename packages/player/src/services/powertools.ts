import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { formatArtistNames, type Track } from '@nuclearplayer/model';

import { discoveryHost } from './discoveryHost';
import { providersHost } from './providersHost';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';

const recentIds = new Set<string>();

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

  // Favorites/current track are only the recommendation context. The
  // discovery provider supplies the actual candidates from its catalogue,
  // so My Wave is no longer limited to liked tracks.
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

export const openLyricsForCurrentTrack = async (): Promise<void> => {
  const item = useQueueStore.getState().getCurrentItem();

  if (!item) {
    return;
  }

  const track = item.track;

  await invoke('genius_lyrics', {
    artist: formatArtistNames(track.artists),
    title: track.title,
  });
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
    }

    if (recentIds.size > 50) {
      const oldest = recentIds.values().next().value;

      if (oldest) {
        recentIds.delete(oldest);
      }
    }
  });
};
