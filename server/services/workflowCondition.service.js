function valueAt(source, path) {
  return String(path || '').split('.').filter(Boolean)
    .reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function compare(condition, context) {
  const op = String(condition.operator || condition.op || 'eq').toLowerCase();
  const actual = valueAt(context, condition.field || condition.path || condition.key);
  const expected = condition.value;
  if (op === 'eq' || op === '=') return String(actual) === String(expected);
  if (op === 'neq' || op === '!=') return String(actual) !== String(expected);
  if (op === 'in') return Array.isArray(expected) && expected.map(String).includes(String(actual));
  if (op === 'not_in') return Array.isArray(expected) && !expected.map(String).includes(String(actual));
  if (op === 'contains') return Array.isArray(actual)
    ? actual.map(String).includes(String(expected))
    : String(actual || '').includes(String(expected));

  const left = Number(actual);
  const right = Number(expected);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (op === 'gt' || op === '>') return left > right;
  if (op === 'gte' || op === '>=') return left >= right;
  if (op === 'lt' || op === '<') return left < right;
  if (op === 'lte' || op === '<=') return left <= right;
  return false;
}

function orderedActiveSteps(definition = {}, context = {}) {
  return (definition.steps || [])
    .filter((step) => !step.conditions?.length || step.conditions.every((item) => compare(item, context)))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

module.exports = { orderedActiveSteps };
