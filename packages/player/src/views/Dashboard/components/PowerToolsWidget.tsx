import { invoke } from '@tauri-apps/api/core';
import { FC, useState } from 'react';

import { formatArtistNames } from '@nuclearplayer/model';

import { favoriteShuffle, startWave } from '../../../services/powertools';
import { useFavoritesStore } from '../../../stores/favoritesStore';
import { useQueueStore } from '../../../stores/queueStore';

export const PowerToolsWidget: FC = () => {
  const favorites = useFavoritesStore((state) => state.tracks.length);
  const current = useQueueStore((state) => state.getCurrentItem());
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsUrl, setLyricsUrl] = useState<string | null>(null);

  const showLyrics = async () => {
    if (!current) {
      return;
    }

    const result = await invoke<{ text: string; url: string } | null>(
      'genius_lyrics',
      {
        artist: formatArtistNames(current.track.artists),
        title: current.track.title,
      },
    );

    setLyrics(result?.text ?? 'Lyrics not found');
    setLyricsUrl(result?.url ?? null);
  };

  return (
    <section className="rounded-xl bg-black/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">PowerTools</h2>
          <p className="text-sm opacity-70">{favorites} liked tracks</p>
        </div>
        <button
          className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/10"
          onClick={() => startWave()}
        >
          My Wave
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
          onClick={() => favoriteShuffle()}
        >
          Shuffle Favorites
        </button>
        <button
          disabled={!current}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-40"
          onClick={() => void showLyrics()}
        >
          Lyrics
        </button>
      </div>
      {lyrics && (
        <div className="mt-4 max-h-80 overflow-auto rounded-lg bg-black/10 p-4 text-sm leading-6 whitespace-pre-wrap">
          {lyrics}
          {lyricsUrl && (
            <a
              className="mt-3 block underline"
              href={lyricsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open on Genius
            </a>
          )}
        </div>
      )}
    </section>
  );
};
