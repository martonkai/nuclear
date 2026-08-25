import { create } from 'zustand';

export type LyricsData = {
  title: string;
  artist: string;
  album: string;
  url: string;
  text: string;
  synced?: string | null;
  source: string;
};

type LyricsState = {
  trackKey: string | null;
  data: LyricsData | null;
  isLoading: boolean;
  isOpen: boolean;
  error: string | null;
  setLoading: (trackKey: string) => void;
  setData: (trackKey: string, data: LyricsData) => void;
  setError: (trackKey: string, error: string) => void;
  setOpen: (isOpen: boolean) => void;
  clear: () => void;
};

export const useLyricsStore = create<LyricsState>((set) => ({
  trackKey: null,
  data: null,
  isLoading: false,
  isOpen: false,
  error: null,
  setLoading: (trackKey) =>
    set({ trackKey, isLoading: true, error: null, data: null }),
  setData: (trackKey, data) =>
    set({ trackKey, data, isLoading: false, error: null }),
  setError: (trackKey, error) =>
    set({ trackKey, data: null, isLoading: false, error }),
  setOpen: (isOpen) => set({ isOpen }),
  clear: () =>
    set({ trackKey: null, data: null, isLoading: false, isOpen: false, error: null }),
}));
