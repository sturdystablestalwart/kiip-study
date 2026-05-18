// Issue #460 — single source of truth lives in shared/scoring.cjs.
// Vite + Rolldown handle CJS interop: the default import gives us
// the module.exports object, and we re-export the named function so
// existing client callers `import { scoreQuestion } from '...scoring'`
// keep working.
import sharedScoring from '../../../shared/scoring.cjs';

export const scoreQuestion = sharedScoring.scoreQuestion;
