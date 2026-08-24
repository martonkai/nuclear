import { FC } from 'react';

import { PlayerBar } from '@nuclearplayer/ui';

import { useCoreSetting } from '../../hooks/useCoreSetting';

export const ConnectedVolume: FC = () => {
  const [volume, setVolume] = useCoreSetting<number>('playback.volume');
  const percentage = Math.round((volume ?? 1) * 100);

  const handleVolumeChange = (value: number) => {
    setVolume(value / 100);
  };

  return (
    <div className="flex items-center gap-2">
      <PlayerBar.Volume
        value={percentage}
        onValueChange={handleVolumeChange}
      />
      <span className="text-foreground-secondary min-w-10 text-right text-xs tabular-nums">
        {percentage}%
      </span>
    </div>
  );
};
