declare module "node:test" {
  type TestFn = () => void | Promise<void>;
  export default function test(name: string, fn: TestFn): void;
}

declare module "node:assert/strict" {
  export function equal<T>(actual: T, expected: T, message?: string): void;
  export function deepEqual<T>(actual: T, expected: T, message?: string): void;
  export function notEqual<T>(actual: T, expected: T, message?: string): void;
  export function ok(value: unknown, message?: string): asserts value;
  export function match(actual: string, expected: RegExp, message?: string): void;
  export function throws(fn: () => unknown, expected?: RegExp): void;
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}
