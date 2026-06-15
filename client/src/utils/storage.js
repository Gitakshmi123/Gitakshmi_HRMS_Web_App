export function save(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}
export function load(key) {
  const v = sessionStorage.getItem(key);
  return v ? JSON.parse(v) : null;
}
export function remove(key) {
  sessionStorage.removeItem(key);
}
