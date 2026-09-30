export function errorHandler(err, req, res, next) {
  console.error('[Error]', err);

  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');
  const message = err.message || 'An unexpected error occurred.';

  const response = {
    error: {
      code,
      message,
    },
  };

  if (err.fields) {
    response.error.fields = err.fields;
  }

  res.status(status).json(response);
}
