const pino = require('pino');
const { AsyncLocalStorage } = require('async_hooks');

const base = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'password', 'token', 'jwt'],
        remove: true,
    },
});

// Issue #33 — request-scoped context.  A single API call may emit
// log lines from auth middleware, sanitizer, route handler, mongoose
// callbacks, etc.; without a shared correlation key these are
// impossible to grep on a busy hour.
//
// The middleware in server/index.js seeds { reqId, userId? } into this
// store and we proxy every pino method to read it and merge into
// `bindings` automatically.  AsyncLocalStorage propagation is free
// for short async chains.
const requestContext = new AsyncLocalStorage();

function ctx() {
    return requestContext.getStore() || {};
}

// Mutate the in-flight context (e.g. when requireAuth resolves the
// user — we then want every later log line on this request to carry
// `userId`).
function setContextField(key, value) {
    const store = requestContext.getStore();
    if (store) store[key] = value;
}

function wrap(method) {
    return function (...args) {
        const c = ctx();
        if (!c.reqId && !c.userId) return base[method](...args);
        if (args.length > 0 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
            return base[method]({ ...c, ...args[0] }, ...args.slice(1));
        }
        return base[method](c, ...args);
    };
}

const logger = {
    trace: wrap('trace'),
    debug: wrap('debug'),
    info: wrap('info'),
    warn: wrap('warn'),
    error: wrap('error'),
    fatal: wrap('fatal'),
    child: (bindings) => base.child(bindings),
    requestContext,
    setContextField,
};

module.exports = logger;
