export function clone<T = Record<string, unknown>>(obj: T): T {
    if (obj == null || typeof obj != 'object') return obj;

    return JSON.parse(JSON.stringify(obj));
}