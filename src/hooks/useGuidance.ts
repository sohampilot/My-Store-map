import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { estimateWalkingMinutes, positionAlongRoute, stepIndexAtDistance, toSpeakable } from '../algorithms/directions';
import type { NavigationNode, RouteResult } from '../models/types';
import type { SpeechController } from './useSpeech';

export type GuidanceStatus = 'idle' | 'guiding' | 'paused' | 'arrived';

/** Average indoor walking speed in meters per second. */
export const WALKING_SPEED = 1.3;
const TICK_MS = 100;
/** Distance before a maneuver at which the "In N meters…" heads-up is spoken. */
export const ADVANCE_WARNING_METERS = 10;

export const routeOverview = (route: RouteResult, destinationName?: string): string => {
  const minutes = estimateWalkingMinutes(route.walkingDistance, WALKING_SPEED);
  const meters = Math.round(route.walkingDistance);
  const target = destinationName ? ` to ${destinationName}` : '';
  return toSpeakable(`Route${target}: ${meters} meters, about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} on foot.`);
};

interface UseGuidanceArgs {
  route: RouteResult | null;
  nodes: NavigationNode[];
  speech: SpeechController;
  destinationName?: string;
}

/**
 * Google-Maps-style guidance controller.
 *
 * - Manual mode: the user taps Next / Back and each instruction is read aloud.
 * - Simulated walk: a "you are here" marker walks the route at a realistic pace,
 *   announcing each maneuver as it is reached plus an advance warning before it.
 */
export const useGuidance = ({ route, nodes, speech, destinationName }: UseGuidanceArgs) => {
  const [status, setStatus] = useState<GuidanceStatus>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [traveled, setTraveled] = useState(0);
  const [simulateWalk, setSimulateWalk] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(3);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const steps = useMemo(() => route?.steps ?? [], [route]);
  const total = route ? route.totalWeight : 0;

  const { speak, stop: stopSpeech, settings } = speech;
  /** Mutable mirror of progress, read by the simulation timer without re-subscribing every tick. */
  const stateRef = useRef({ stepIndex: 0, traveled: 0, warnedFor: -1 });

  const setProgress = useCallback((index: number, distance: number) => {
    stateRef.current.stepIndex = index;
    stateRef.current.traveled = distance;
    stateRef.current.warnedFor = -1;
    setStepIndex(index);
    setTraveled(distance);
  }, []);

  // Reset whenever a new route is calculated (adjusting state during render).
  const [previousRoute, setPreviousRoute] = useState(route);
  if (route !== previousRoute) {
    setPreviousRoute(route);
    setStatus('idle');
    setStepIndex(0);
    setTraveled(0);
  }

  // Speech side effects for a new route.
  const announceRef = useRef({ speak, stopSpeech, autoAnnounce: settings.autoAnnounce, destinationName });
  useEffect(() => {
    announceRef.current = { speak, stopSpeech, autoAnnounce: settings.autoAnnounce, destinationName };
  }, [destinationName, settings.autoAnnounce, speak, stopSpeech]);
  useEffect(() => {
    const announce = announceRef.current;
    stateRef.current = { stepIndex: 0, traveled: 0, warnedFor: -1 };
    announce.stopSpeech();
    if (route && announce.autoAnnounce) {
      announce.speak(`${routeOverview(route, announce.destinationName)} ${route.steps[0]?.spoken ?? ''}`);
    }
  }, [route]);

  const speakStep = useCallback(
    (index: number, interrupt = true) => {
      const step = steps[index];
      if (step) speak(step.spoken, { interrupt });
    },
    [speak, steps],
  );

  const goToStep = useCallback(
    (index: number, options: { speak?: boolean } = {}) => {
      if (steps.length === 0) return;
      const clamped = Math.max(0, Math.min(steps.length - 1, index));
      setProgress(clamped, steps[clamped].startDistance);
      setStatus((current) => {
        if (clamped === steps.length - 1) return 'arrived';
        return current === 'idle' || current === 'arrived' ? 'paused' : current;
      });
      if (options.speak ?? true) speakStep(clamped);
    },
    [setProgress, speakStep, steps],
  );

  const start = useCallback(() => {
    if (!route || steps.length === 0) return;
    const restarting = status === 'idle' || status === 'arrived';
    if (restarting) {
      setProgress(0, 0);
      speak(`${routeOverview(route, destinationName)} ${steps[0].spoken}`);
    } else {
      speakStep(stateRef.current.stepIndex);
    }
    setStatus(steps.length === 1 ? 'arrived' : 'guiding');
  }, [destinationName, route, setProgress, speak, speakStep, status, steps]);

  const pause = useCallback(() => {
    setStatus('paused');
    stopSpeech();
  }, [stopSpeech]);

  const stop = useCallback(() => {
    setStatus('idle');
    setProgress(0, 0);
    stopSpeech();
  }, [setProgress, stopSpeech]);

  const next = useCallback(() => goToStep(stateRef.current.stepIndex + 1), [goToStep]);
  const previous = useCallback(() => goToStep(stateRef.current.stepIndex - 1), [goToStep]);
  const repeat = useCallback(() => speakStep(stateRef.current.stepIndex), [speakStep]);

  // Simulated walk ticker.
  useEffect(() => {
    if (status !== 'guiding' || !simulateWalk || steps.length === 0) return;
    const timer = window.setInterval(() => {
      const state = stateRef.current;
      const nextTraveled = Math.min(total, state.traveled + (WALKING_SPEED * speedMultiplier * TICK_MS) / 1000);
      const nextIndex = stepIndexAtDistance(steps, nextTraveled);

      if (nextIndex !== state.stepIndex) {
        state.stepIndex = nextIndex;
        setStepIndex(nextIndex);
        speakStep(nextIndex, false);
      } else {
        const upcoming = steps[nextIndex + 1];
        const current = steps[nextIndex];
        const remaining = upcoming ? upcoming.startDistance - nextTraveled : Infinity;
        if (
          upcoming &&
          current.distance >= ADVANCE_WARNING_METERS * 2 &&
          remaining <= ADVANCE_WARNING_METERS &&
          state.warnedFor !== nextIndex
        ) {
          state.warnedFor = nextIndex;
          speak(`In ${ADVANCE_WARNING_METERS} meters, ${upcoming.preview}.`, { interrupt: false });
        }
      }

      state.traveled = nextTraveled;
      setTraveled(nextTraveled);
      if (nextTraveled >= total) {
        setStatus('arrived');
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [simulateWalk, speak, speakStep, speedMultiplier, status, steps, total]);

  // In manual mode, "you are here" sits on the current maneuver point.
  const position = useMemo(() => {
    if (!route || status === 'idle') return null;
    if (route.segments.length === 0) {
      const node = nodeMap.get(route.nodeIds[0]);
      return node ? { floorId: node.floorId, x: node.x, y: node.y } : null;
    }
    return positionAlongRoute(route.segments, nodeMap, traveled);
  }, [nodeMap, route, status, traveled]);

  const currentStep = steps[stepIndex] ?? null;
  const remainingDistance = route
    ? Math.max(
        0,
        route.segments
          .filter((segment) => !segment.vertical)
          .reduce((sum, segment) => {
            const end = segment.startDistance + segment.weight;
            if (end <= traveled) return sum;
            return sum + Math.min(segment.weight, end - traveled);
          }, 0),
      )
    : 0;
  const distanceToNextManeuver = currentStep && steps[stepIndex + 1] ? Math.max(0, steps[stepIndex + 1].startDistance - traveled) : 0;

  return {
    status,
    stepIndex,
    currentStep,
    steps,
    traveled,
    position,
    remainingDistance,
    distanceToNextManeuver,
    simulateWalk,
    setSimulateWalk,
    speedMultiplier,
    setSpeedMultiplier,
    start,
    pause,
    stop,
    next,
    previous,
    repeat,
    goToStep,
  };
};

export type GuidanceController = ReturnType<typeof useGuidance>;
