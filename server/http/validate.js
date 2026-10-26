'use strict';
// Request validation. Every route that accepts a body declares its fields;
// anything undeclared is refused, so a client can never slip an extra field
// (a role, a created_by) into a handler. Validated values land on req.valid.
//
// Field spec: { type: 'string'|'password'|'object'|'array'|'boolean'|'integer'|'intArray', required?, min?, max?, enum?, pattern? }

function check(spec, value, name) {
  switch (spec.type) {
    case 'string': {
      if (typeof value !== 'string') return `${name} must be text.`;
      const v = value.trim();
      if (spec.required && !v) return `${name} is required.`;
      if (spec.min != null && v.length < spec.min) return `${name} is too short.`;
      if (spec.max != null && value.length > spec.max) return `${name} is too long.`;
      if (spec.enum && !spec.enum.includes(v)) return `${name} is not one of the allowed values.`;
      if (spec.pattern && v && !spec.pattern.test(v)) return `${name} is not in the expected format.`;
      return null;
    }
    case 'password': {
      // Not trimmed; length cap only. Policy is applied by the handler.
      if (typeof value !== 'string') return `${name} must be text.`;
      if (spec.required && !value) return `${name} is required.`;
      if (value.length > (spec.max || 256)) return `${name} is too long.`;
      return null;
    }
    case 'object':
      // A plain object; its own fields are validated by the handler with validateObject.
      return value && typeof value === 'object' && !Array.isArray(value) ? null : `${name} must be an object.`;
    case 'array':
      // A list; its items are validated by the handler (e.g. the publication tree).
      return Array.isArray(value) && value.length <= (spec.max || 1000) ? null : `${name} must be a list.`;
    case 'boolean':
      return typeof value === 'boolean' ? null : `${name} must be true or false.`;
    case 'integer':
      return Number.isInteger(value) && (spec.min == null || value >= spec.min) && (spec.max == null || value <= spec.max)
        ? null : `${name} must be a whole number in range.`;
    case 'intArray':
      if (!Array.isArray(value) || value.length > (spec.max || 200) || !value.every((x) => Number.isInteger(x) && x > 0)) {
        return `${name} must be a list of ids.`;
      }
      return null;
    default:
      return `${name} has an unsupported type.`;
  }
}

function validateObject(schema, input, { where = 'body' } = {}) {
  if (input == null) input = {};
  if (typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: `The request ${where} must be an object.`, code: 'BAD_REQUEST' };
  for (const key of Object.keys(input)) {
    if (!Object.prototype.hasOwnProperty.call(schema, key)) {
      return { ok: false, error: `Unknown field: ${key.slice(0, 40)}.`, code: 'UNKNOWN_FIELD' };
    }
  }
  const out = {};
  for (const [key, spec] of Object.entries(schema)) {
    const present = input[key] !== undefined && input[key] !== null && !(where === 'query' && input[key] === '');
    if (!present) {
      if (spec.required) return { ok: false, error: `${spec.label || key} is required.`, code: 'VALIDATION' };
      continue;
    }
    const err = check(spec, input[key], spec.label || key);
    if (err) return { ok: false, error: err, code: 'VALIDATION' };
    out[key] = spec.type === 'string' ? input[key].trim() : input[key];
  }
  return { ok: true, value: out };
}

// Middleware: body(schema). Use body({}) for routes that take no body.
function body(schema) {
  return function validateBody(req, res, next) {
    const r = validateObject(schema, req.body, { where: 'body' });
    if (!r.ok) return res.status(400).json({ error: r.error, code: r.code });
    req.valid = r.value;
    next();
  };
}

// Middleware: query(schema). Unknown query parameters are refused as well.
function query(schema) {
  return function validateQuery(req, res, next) {
    const r = validateObject(schema, { ...req.query }, { where: 'query' });
    if (!r.ok) return res.status(400).json({ error: r.error, code: r.code });
    req.validQuery = r.value;
    next();
  };
}

module.exports = { body, query, validateObject };
