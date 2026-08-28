/**
 * theme/index.ts
 * --------------
 * One convenient import point. Anywhere in the app:
 *
 *   import { colors, spacing, radius, textStyles, shadows } from '../theme';
 *
 * instead of importing from four separate files.
 */

export { colors } from './colors';
export type { Colors } from './colors';
export { spacing, radius, screenPadding } from './spacing';
export { fontFamily, textStyles } from './typography';
export { shadows } from './shadows';
export { glass, neo } from './effects';
