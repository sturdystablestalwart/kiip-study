const isProd = process.env.NODE_ENV === 'production';
module.exports = (prefix, err) => isProd ? prefix : `${prefix}: ${err.message}`;
