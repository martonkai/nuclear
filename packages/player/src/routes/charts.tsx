import { invoke } from '@tauri-apps/api/core';
import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';

import { Button, ViewShell } from '@nuclearplayer/ui';

export type ChartTrack = {
  rank: number;
  title: string;
  artist: string;
  source: string;
};

export const Route = createFileRoute('/charts')({
  component: ChartsView,
});

function ChartsView() {
  const [tracks, setTracks] = useState<ChartTrack[]>([]);
  const [tab, setTab] = useState<'russia' | 'global'>('russia');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void invoke<ChartTrack[]>('fetch_charts')
      .then((result) => {
        if (active) {
          setTracks(result);
          setLoading(false);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleTracks = useMemo(() => {
    const source = tab === 'russia' ? 'VK Music Russia' : 'Global';
    return tracks.filter((track) => track.source === source);
  }, [tab, tracks]);

  return (
    <ViewShell title="Charts">
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-center gap-2">
          <Button
            variant={tab === 'russia' ? 'default' : 'text'}
            onClick={() => setTab('russia')}
          >
            🇷🇺 Россия
          </Button>
          <Button
            variant={tab === 'global' ? 'default' : 'text'}
            onClick={() => setTab('global')}
          >
            🌎 Мир
          </Button>
        </div>

        {loading && <p>Загружаю чарты…</p>}
        {!loading && error && (
          <p className="text-foreground-secondary">Не удалось загрузить чарты: {error}</p>
        )}
        {!loading && !error && !visibleTracks.length && (
          <p className="text-foreground-secondary">Чарт сейчас недоступен.</p>
        )}

        <div className="divide-border divide-y">
          {visibleTracks.map((track) => (
            <div
              key={`${track.source}-${track.rank}-${track.artist}-${track.title}`}
              className="flex items-center gap-4 py-3"
            >
              <span className="text-foreground-secondary w-8 text-right text-sm tabular-nums">
                {track.rank}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{track.title}</div>
                <div className="text-foreground-secondary truncate text-sm">{track.artist}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ViewShell>
  );
}
