import type { Maneuver } from '../models/types';

interface ManeuverIconProps {
  maneuver: Maneuver;
  className?: string;
}

/** Simple arrow glyphs for each maneuver, drawn on a 24x24 grid. */
const paths: Record<string, string> = {
  straight: 'M12 20V4 M6 10l6-6 6 6',
  depart: 'M12 20V4 M6 10l6-6 6 6',
  'slight-left': 'M14 20v-7l-6-6 M8 13V7h6',
  'slight-right': 'M10 20v-7l6-6 M16 13V7h-6',
  left: 'M16 20v-8a2 2 0 0 0-2-2H5 M9 6l-4 4 4 4',
  right: 'M8 20v-8a2 2 0 0 1 2-2h9 M15 6l4 4-4 4',
  'u-turn': 'M8 20V9a4 4 0 0 1 8 0v6 M12 12l4 4 4-4',
  'enter-store': 'M4 20h16 M6 20V8l6-4 6 4v12 M12 10v6 M9 13l3 3 3-3',
  'exit-store': 'M4 20h16 M6 20V8l6-4 6 4v12 M12 16v-6 M9 13l3-3 3 3',
  'elevator-up': 'M5 3h14v18H5z M12 17V8 M9 11l3-3 3 3',
  'elevator-down': 'M5 3h14v18H5z M12 7v9 M9 13l3 3 3-3',
  'exit-elevator': 'M5 3h14v18H5z M12 3v18',
  'stairs-up': 'M3 20h5v-5h5v-5h5V5h3 M14 4h4v4',
  'stairs-down': 'M3 5h5v5h5v5h5v5h3 M17 20h4v-4',
  'exit-stairs': 'M3 20h5v-5h5v-5h5V5h3',
  waypoint: 'M6 21V4 M6 4h11l-2 4 2 4H6',
  arrive: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
};

export function ManeuverIcon({ maneuver, className = 'h-6 w-6' }: ManeuverIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[maneuver] ?? paths.straight} />
    </svg>
  );
}
