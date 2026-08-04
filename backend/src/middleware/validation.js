// Lightweight request-body validation helpers.
// Used by the admin routes to reject malformed payloads early (402/400) instead
// of silently persisting them into SQLite. No schema library (Joi/Zod) by design:
// rules are declared inline per endpoint to keep the diff small and explicit.

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Ensure required fields are present with the expected type.
 * `rules` is a map of { field: expectedType } where expectedType is one of
 * "string" | "number" | "array" | "object" | "boolean" | "*".
 * Returns { ok: true } or { ok: false, error: message }.
 */
export function validateBody(body, rules = {}) {
  const result = { ok: true };
  const errors = [];

  for (const [field, expected] of Object.entries(rules)) {
    const value = body?.[field];

    if (value === undefined || value === null) {
      // Required unless the field is marked optional with a trailing "?"
      if (!expected.endsWith("?")) {
        errors.push(`Campo obligatorio: ${field}`);
      }
      continue;
    }

    const type = expected.replace("?", "");
    if (type === "*") continue;

    const okType =
      type === "string" ? typeof value === "string"
        : type === "number" ? typeof value === "number" && Number.isFinite(value)
          : type === "array" ? Array.isArray(value)
            : type === "object" ? isPlainObject(value)
              : type === "boolean" ? typeof value === "boolean"
                : true;

    if (!okType) {
      errors.push(`Campo ${field} debe ser ${type === "string" ? "texto" : type === "number" ? "número" : type === "array" ? "lista" : type === "object" ? "objeto" : type === "boolean" ? "booleano" : type}`);
    }
  }

  if (errors.length) {
    result.ok = false;
    result.error = errors.join("; ");
  }
  return result;
}

/** Middleware factory: validates req.body against `rules` BEFORE route handlers. */
export function requireBody(rules) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "El cuerpo debe ser un objeto JSON" });
    }
    const validation = validateBody(req.body, rules);
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }
    next();
  };
}

/** Middleware factory: validates numeric :id query/params when present. */
export function requireParams(rules = {}) {
  return (req, res, next) => {
    for (const [field, type] of Object.entries(rules)) {
      const value = req.params[field] ?? req.query[field];
      if (value === undefined || value === null) continue;
      if (type === "number" && !/^\d+$/.test(String(value))) {
        return res.status(400).json({ error: `Parámetro ${field} debe ser un número` });
      }
    }
    next();
  };
}

export default { validateBody, requireBody, requireParams };