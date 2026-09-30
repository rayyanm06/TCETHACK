export function errorHandler(err, req, res, next) {
  const validation = ['ZodError', 'ValidationError', 'CastError'].includes(err.name);
  const status = err.status || err.statusCode || (err.code === 11000 ? 409 : err.code === 'LIMIT_FILE_SIZE' ? 413 : validation ? 400 : 500);
  const code = typeof err.code === 'string' ? err.code : status === 409 ? 'CONFLICT' : validation ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR';
  const message = status >= 500 ? 'The service could not complete this request. Please retry.' : err.code === 11000 ? 'This record already exists. Refresh to see its current state.' : validation ? 'Please check the submitted fields.' : err.message;
  if (status >= 500) console.error('[Request failed]', code, err.name);
  res.status(status).json({ error: { code, message, ...(err.fields ? { fields: err.fields } : {}) } });
}
