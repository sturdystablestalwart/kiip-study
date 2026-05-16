/**
 * Canonical KIIP level enum values.
 *
 * Mirrors `server/models/Test.js` -> `TestSchema.level.enum`:
 *   ['0', '1', '2', '3', '4', '5-basic', '5-advanced']
 *
 * The `value` is what gets sent to the API (must match the server enum).
 * The `label` is what the user sees in the filter dropdown.
 *
 * Keep this list in sync with the server enum.  When a new level is added
 * server-side, append it here.
 */

export const LEVEL_VALUES = ['0', '1', '2', '3', '4', '5-basic', '5-advanced'];

export const LEVEL_OPTIONS = [
  { value: '0', label: 'Level 0' },
  { value: '1', label: 'Level 1' },
  { value: '2', label: 'Level 2' },
  { value: '3', label: 'Level 3' },
  { value: '4', label: 'Level 4' },
  { value: '5-basic', label: 'Level 5 (Basic)' },
  { value: '5-advanced', label: 'Level 5 (Advanced)' },
];
