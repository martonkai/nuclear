import { FC } from 'react';
import { XIcon } from 'lucide-react';

import { Button } from '@nuclearplayer/ui';

import { useLyricsStore } from '../stores/lyricsStore';

export const LyricsPanel: FC = () => {
  const { data, error, isLoading, isOpen, setOpen } = useLyricsStore();

  if (!isOpen) {
    return null;
  }

  return (
    <section className="border-border bg-background-secondary max-h-72 overflow-y-auto border-t px-6 py-4">
      <div className="mx-auto flex max-w-4xl items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">
                {data?.title ?? 'Текст песни'}
              </h2>
              {data?.artist && (
                <p className="text-foreground-secondary truncate text-sm">
                  {data.artist} · {data.source}
                </p>
              )}
            </div>
          </div>

          {isLoading && (
            <p className="text-foreground-secondary text-sm">Загружаю текст…</p>
          )}

          {!isLoading && error && (
            <p className="text-foreground-secondary text-sm">
              Текст для этого трека не найден.
            </p>
          )}

          {!isLoading && data?.text && (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-6">
              {data.text}
            </pre>
          )}
        </div>

        <Button
          variant="text"
          size="icon-sm"
          aria-label="Закрыть текст песни"
          onClick={() => setOpen(false)}
        >
          <XIcon size={18} />
        </Button>
      </div>
    </section>
  );
};
