import { useCallback, useEffect, useState } from 'react';

/**
 * Step-by-step playback controller used by both MST visualisations.
 * `index` is the number of steps revealed so far (0 = nothing yet, total = finished).
 * Playback restarts automatically whenever `resetKey` changes (e.g. a new trip plan).
 */
export const useStepPlayback = (total: number, intervalMs: number, resetKey: unknown, autoPlay = false) => {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [previousKey, setPreviousKey] = useState(resetKey);
  if (resetKey !== previousKey) {
    setPreviousKey(resetKey);
    setIndex(0);
    setPlaying(autoPlay && total > 0);
  }

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setIndex((current) => Math.min(total, current + 1));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, playing, total]);

  // Stop once everything has been revealed.
  const finished = index >= total;
  if (playing && finished) setPlaying(false);

  const play = useCallback(() => {
    setIndex((current) => (current >= total ? 0 : current));
    setPlaying(true);
  }, [total]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [pause, play, playing]);
  const next = useCallback(() => {
    setPlaying(false);
    setIndex((current) => Math.min(total, current + 1));
  }, [total]);
  const previous = useCallback(() => {
    setPlaying(false);
    setIndex((current) => Math.max(0, current - 1));
  }, []);
  const reset = useCallback(() => {
    setPlaying(false);
    setIndex(0);
  }, []);
  const showAll = useCallback(() => {
    setPlaying(false);
    setIndex(total);
  }, [total]);

  return { index, playing, finished, play, pause, toggle, next, previous, reset, showAll };
};

export type StepPlayback = ReturnType<typeof useStepPlayback>;
