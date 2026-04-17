const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'password', 'token', 'jwt'],
        remove: true,
    },
});

module.exports = logger;
