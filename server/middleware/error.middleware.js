const errorHandler = (err, req, res, next) => {
  console.error(`[Taskora Error] ${err.stack || err.message}`);

  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  const errorCode = err.code || (statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 404 ? 'NOT_FOUND' : 'SERVER_ERROR');

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'Internal Server Error'
    }
  });
};

module.exports = errorHandler;
