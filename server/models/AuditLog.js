const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
        type: String,
        required: true,
        enum: [
            'test.create',
            'test.import',
            'test.generate',
            'test.generate-from-file',
            'test.edit',
            'test.delete',
            'flag.resolve',
            'flag.dismiss'
        ]
    },
    targetType: { type: String, required: true, enum: ['Test', 'Flag'] },
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
