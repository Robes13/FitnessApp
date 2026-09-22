import {
  COLLECTION_ICON_NAMES,
  CollectionIconName,
} from '../../../core/constants/collection-icons';

/** UI icons beyond the collection icons. Paths are copied from the design. */
export const UI_ICON_NAMES = [
  'chevron-left',
  'chevron-right',
  'close',
  'plus',
  'minus',
  'eye',
  'eye-off',
  'scan',
  'check',
  'check-circle',
  'pencil',
  'image',
  'mail',
  'refresh',
  'redo',
  'log-out',
  'tab-food',
  'tab-weight',
  'tab-home',
  'tab-collections',
  'tab-history',
] as const;

export type UiIconName = (typeof UI_ICON_NAMES)[number];

/** All icon names `app-ui-icon` can render: the 30 collection icons plus the UI icons. */
export type IconName = CollectionIconName | UiIconName;

export const ICON_NAMES: readonly IconName[] = [...COLLECTION_ICON_NAMES, ...UI_ICON_NAMES];

/** Collection icons – the design's `colIconDefs` (Lucide paths, 24×24 viewBox). */
const COLLECTION_ICON_PATHS: Record<CollectionIconName, readonly string[]> = {
  egg: [
    'M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z',
  ],
  bolt: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  utensils: [
    'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7',
  ],
  cookie: [
    'M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01',
  ],
  coffee: [
    'M10 2v2M14 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1M6 2v2',
  ],
  salad: [
    'M7 21h10M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9ZM11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1M13 12a2.4 2.4 0 0 0-1.87-3.56M3 12h18',
  ],
  fish: [
    'M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6ZM18 12v.5M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33',
  ],
  flame: [
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  ],
  leaf: [
    'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10ZM2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12',
  ],
  heart: [
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  ],
  star: [
    'm12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  ],
  dumbbell: ['M6 5v14M18 5v14M3 8v8M21 8v8M6 12h12'],
  apple: [
    'M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06ZM10 2c1 .5 2 2 2 5',
  ],
  carrot: [
    'M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14.37l6.36 6.37M18.6 5.4a2 2 0 1 0-2.83-2.83M22 10a2 2 0 1 0-2.83-2.83',
  ],
  sprout: [
    'M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8zM14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z',
  ],
  soup: [
    'M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9ZM7 21h10M19.5 12 22 6M16.25 12l1.5-3.5M11 12l2-5M7.5 12 9 9',
  ],
  pizza: [
    'M15 11h.01M11 15h.01M16 16h.01M2 16l20 6-6-20A20 20 0 0 0 2 16M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4',
  ],
  icecream: ['M12 22 7 10h10L12 22zM17 10a5 5 0 0 0-10 0'],
  cake: [
    'M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3',
  ],
  sandwich: ['M3 11h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2zM4 11 12 5l8 6M7 17v2M17 17v2'],
  milk: ['M8 2h8M9 2v3L6 9v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9l-3-4V2M6 13h12'],
  droplet: [
    'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z',
  ],
  timer: ['M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'],
  sun: [
    'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  ],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  target: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  trophy: [
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z',
  ],
  bike: [
    'M18.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 17.5V14l-3-3 4-3 2 3h2',
  ],
  bag: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6zM3 6h18M16 10a4 4 0 0 1-8 0'],
  sparkles: [
    'm12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3zM5 3v4M19 17v4M3 5h4M17 19h4',
  ],
};

/**
 * UI icons. `rect`/`circle` elements from the design have been rewritten as paths, so
 * `app-ui-icon` only ever needs to render `<path>` elements. The tab icons have two paths
 * (the design's `tabDefs`), `eye` is the design's `pwLoginPath` plus the pupil.
 */
const UI_ICON_PATHS: Record<UiIconName, readonly string[]> = {
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  close: ['M18 6 6 18M6 6l12 12'],
  plus: ['M5 12h14M12 5v14'],
  minus: ['M5 12h14'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'eye-off': [
    'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94m2.84-1.7A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M2 2l20 20',
  ],
  scan: [
    'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8',
  ],
  check: ['M20 6 9 17l-5-5'],
  'check-circle': ['M9 11l3 3L22 4', 'M21 12a9 9 0 11-6.2-8.6'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
  image: [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M9 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    'm21 15-4.35-4.35a2 2 0 0 0-2.83 0L3 21',
  ],
  mail: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7',
  ],
  refresh: ['M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5'],
  redo: ['M3 12a9 9 0 1 0 3-6.7M3 4v5h5'],
  'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'],
  'tab-food': [
    'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7',
  ],
  'tab-weight': [
    'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    'M6.5 7h11l2.5 12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L6.5 7z',
  ],
  'tab-home': ['M3 10.5 12 3l9 7.5', 'M5.5 9.3V21h13V9.3'],
  'tab-collections': ['m12 2 9 5-9 5-9-5 9-5z', 'M3 12l9 5 9-5M3 17l9 5 9-5'],
  'tab-history': ['M12 7v5l3.5 2', 'M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z'],
};

/** All icons' `<path d>` values, one array per icon. */
export const ICON_PATHS: Record<IconName, readonly string[]> = {
  ...COLLECTION_ICON_PATHS,
  ...UI_ICON_PATHS,
};
