/**
 * Single source of truth for the product version shown in the UI and written
 * into exported documents. Keep it in sync with `manifest.json` and
 * `package.json` (the release script verifies this).
 */
export const APP_VERSION = '1.2.0';
export const APP_NAME = 'A.max';
export const APP_AUTHOR = 'Arash Makki';
export const GENERATOR_LABEL = `${APP_NAME} ${APP_VERSION}`;
