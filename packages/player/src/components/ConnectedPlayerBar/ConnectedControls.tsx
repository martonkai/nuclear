import { FC } from 'react';
import {
  HeartIcon,
  ListMusicIcon,
  Mic2Icon,
  WavesIcon,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { useTranslation } from '@nuclearplayer/i18n';
import { RepeatMode } from '@nuclearplayer/plugin-sdk';
import { Button, PlayerBar } from '@nuclearplayer/ui';

import { useCoreSetting } from '../../hooks/useCoreSetting';
import { useProviders } from '../../hooks/useProviders';
import {
  favoriteShuffle,
  openLyricsForCurrentTrack,
  startWave,
} from '../../services/powertools';
import { playbackManager } from '../../services/playback';
import { useFavoritesStore } from '../../stores/favoritesStore';
import { useLyricsStore } from '../../stores/lyricsStore';
import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';

export const ConnectedControls: FC = () => {
  const { t } = useTranslation('playerBar');
  const [shuffleEnabled, setShuffleEnabled] =
    useCoreSetting<boolean>('playback.shuffle');
  const [repeatMode, setRepeatMode] =
    useCoreSetting<RepeatMode>('playback.repeat');
  const [discoveryEnabled, setDiscoveryEnabled] =
    useCoreSetting<boolean>('playback.discovery');
  const hasDiscoveryProviders = useProviders('discovery').length > 0;
  const lyricsOpen = useLyricsStore((state) => state.isOpen);
  const currentTrack = useQueueStore((state) => state.getCurrentItem()?.track);
  const isFavorite = useFavoritesStore((state) =>
    currentTrack ? state.isTrackFavorite(currentTrack.source) : false,
  );

  const { goToNext, goToPrevious } = useQueueStore(
    useShallow((state) => ({
      goToNext: state.goToNext,
      goToPrevious: state.goToPrevious,
    })),
  );
  const status = useSoundStore((state) => state.status);

  const handleToggleShuffle = () => setShuffleEnabled(!shuffleEnabled);
  const handleToggleDiscovery = () => setDiscoveryEnabled(!discoveryEnabled);

  const handleToggleRepeat = () => {
    const modes: Array<RepeatMode> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode ?? 'off');
    const nextIndex = (currentIndex + 1) % modes.length;
    setRepeatMode(modes[nextIndex]);
  };

  const toggleFavorite = () => {
    if (!currentTrack) return;

    if (isFavorite) {
      void useFavoritesStore.getState().removeTrack(currentTrack.source);
    } else {
      void useFavoritesStore.getState().addTrack(currentTrack);
    }
  };

  return (
    <div className="flex min-w-0 items-center justify-center gap-1">
      <div className="flex items-center gap-1">
        <Button
          variant="text"
          size="icon-sm"
          aria-label="My Wave"
          title="My Wave"
          onClick={() => void startWave()}
        >
          <WavesIcon size={17} />
        </Button>
        <Button
          variant="text"
          size="icon-sm"
          aria-label="Shuffle Favorites"
          title="Shuffle Favorites"
          onClick={() => favoriteShuffle()}
        >
          <ListMusicIcon size={17} />
        </Button>
        <Button
          variant={isFavorite ? 'default' : 'text'}
          size="icon-sm"
          aria-label="Favorite"
          title="Favorite"
          disabled={!currentTrack}
          onClick={toggleFavorite}
        >
          <HeartIcon size={17} />
        </Button>
        <Button
          variant={lyricsOpen ? 'default' : 'text'}
          size="icon-sm"
          aria-label="Lyrics"
          title="Lyrics"
          onClick={() => void openLyricsForCurrentTrack()}
          disabled={!currentTrack}
        >
          <Mic2Icon size={17} />
        </Button>
      </div>

      <PlayerBar.Controls
        isPlaying={status === 'playing'}
        isShuffleActive={Boolean(shuffleEnabled)}
        repeatMode={repeatMode ?? 'off'}
        onPlayPause={playbackManager.toggle}
        onNext={goToNext}
        onPrevious={goToPrevious}
        onShuffleToggle={handleToggleShuffle}
        onRepeatToggle={handleToggleRepeat}
        isDiscoveryActive={hasDiscoveryProviders && Boolean(discoveryEnabled)}
        onDiscoveryToggle={
          hasDiscoveryProviders ? handleToggleDiscovery : undefined
        }
        showDiscovery={hasDiscoveryProviders}
        labels={{
          shuffleOn: t('shuffleOn'),
          shuffleOff: t('shuffleOff'),
          repeatOff: t('repeatOff'),
          repeatAll: t('repeatAll'),
          repeatOne: t('repeatOne'),
          discoveryOn: t('discoveryOn'),
          discoveryOff: t('discoveryOff'),
        }}
      />
    </div>
  );
};
