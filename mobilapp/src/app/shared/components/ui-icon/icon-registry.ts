/** All icon names `app-ui-icon` can render. */
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
  'redo',
  'log-out',
  'trash',
  'utensils',
  'bolt',
  'moon',
  'star',
  'tab-food',
  'tab-weight',
  'tab-home',
  'tab-collections',
  'tab-history',
] as const;

export type IconName = (typeof UI_ICON_NAMES)[number];

/** The cutlery icon is shared by the collections and the food tab. */
const UTENSILS_PATH = [
  'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7',
] as const;

/**
 * All icons' `<path d>` values, one array per icon (Lucide paths, 24×24 viewBox). `rect`/`circle`
 * elements from the design have been rewritten as paths, so `app-ui-icon` only ever needs to
 * render `<path>` elements. The tab icons have two paths (the design's `tabDefs`), `eye` is the
 * design's `pwLoginPath` plus the pupil.
 */
export const ICON_PATHS: Record<IconName, readonly string[]> = {
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
  redo: ['M3 12a9 9 0 1 0 3-6.7M3 4v5h5'],
  'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6M14 11v6',
  ],
  utensils: UTENSILS_PATH,
  bolt: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  star: [
    'm12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  ],
  'tab-food': UTENSILS_PATH,
  'tab-weight': [
    'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    'M6.5 7h11l2.5 12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L6.5 7z',
  ],
  'tab-home': ['M3 10.5 12 3l9 7.5', 'M5.5 9.3V21h13V9.3'],
  'tab-collections': ['m12 2 9 5-9 5-9-5 9-5z', 'M3 12l9 5 9-5M3 17l9 5 9-5'],
  'tab-history': ['M12 7v5l3.5 2', 'M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z'],
};
