const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Issue #137 — drop the action enum.  New audit-able admin actions
    // (test.share, test.bulk-import, …) are added all the time and
    // forcing a schema migration each time meant they got skipped.
    // The field is still bounded (≤100 chars) and queryable via the
    // existing { userId, createdAt } / { targetType, targetId } indexes.
    action: { type: String, required: true, trim: true, maxlength: 100 },
    targetType: { type: String, required: true, trim: true, maxlength: 50 },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    details: { type: mongoose.Schema.Types.Mixed }, // contextual info e.g. { title: '...' }
    createdAt: { type: Date, default: Date.now }
});

// Sort audit trail newest-first by default
AuditLogSchema.index({ createdAt: -1 });

// Look up all actions by a specific admin
AuditLogSchema.index({ userId: 1, createdAt: -1 });

// Look up all audit entries for a given document (test or flag)
AuditLogSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
