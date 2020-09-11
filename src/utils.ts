export function clone<T = Record<string, unknown>>(obj: T): T {
    if (obj == null || typeof obj != 'object') return obj;

    return JSON.parse(JSON.stringify(obj));
}

export function Maximize(a: number, b: number) {
    return a >= b;
}

export function Minimize(a: number, b: number) {
    return a < b;
}
