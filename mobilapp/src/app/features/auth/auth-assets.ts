/**
 * Billeder fra `public/`, refereret relativt til base href, så de også virker i
 * Capacitor-skallen. Samlet ét sted, så stierne ikke står som strenge i komponenterne.
 */
export const AUTH_ASSET = {
  /** Fotobaggrunden på login og glemt adgangskode. */
  BACKDROP: 'images/login-bg.jpg',
  LOGO: 'images/nutrify-logo.svg',
} as const;
