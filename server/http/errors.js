'use strict';
// Uniform error responses. Clients get { error, code } and nothing else:
// never a stack trace, an internal path or tool output.

function sendError(res, status, code, error) {
  return res.status(status).json({ error, code });
}

// Wrap an async handler so a rejection reaches the final error handler.
const handle = (fn) => function asyncHandler(req, res, next) {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function createErrorHandler(log = console) {
  // Express recognises error handlers by arity; keep all four parameters.
  // eslint-disable-next-line no-unused-vars
  return function finalErrorHandler(err, req, res, next) {
    if (res.headersSent) return;
    if (err && err.type === 'entity.parse.failed') return sendError(res, 400, 'BAD_JSON', 'The request body is not valid JSON.');
    if (err && err.type === 'entity.too.large') return sendError(res, 413, 'TOO_LARGE', 'The request body is too large.');
    if (err && err.type === 'charset.unsupported') return sendError(res, 415, 'UNSUPPORTED', 'Unsupported request encoding.');
    // Upload limits (multer): never echo the internal message.
    if (err && err.name === 'MulterError') {
      return err.code === 'LIMIT_FILE_SIZE'
        ? sendError(res, 413, 'TOO_LARGE', 'The file is too large.')
        : sendError(res, 400, 'BAD_UPLOAD', 'The upload was not in the expected form (one file, field "file").');
    }
    log.error(`[error] ${req.method} ${req.path}: ${err && err.message}`);
    return sendError(res, 500, 'INTERNAL', 'Something went wrong. Try again, or contact your administrator.');
  };
}

module.exports = { sendError, handle, createErrorHandler };
