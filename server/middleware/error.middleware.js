const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  const errorCode = err.code || (statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'SERVER_ERROR');

  if (statusCode >= 500) {
    console.error(`[Taskora Server Error] ${err.stack || err.message}`);
  } else {
    console.warn(`[Taskora Client Error ${statusCode}] ${err.message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'Internal Server Error'
    }
  });
};

module.exports = errorHandler;
