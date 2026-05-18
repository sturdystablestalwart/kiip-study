// Issue #460 — single source of truth lives in shared/scoring.cjs.
// Re-export so existing callers `const { scoreQuestion } = require('../utils/scoring')`
// keep working unchanged.
module.exports = require('../../shared/scoring.cjs');
