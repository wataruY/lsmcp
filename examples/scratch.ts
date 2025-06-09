import { Value } from "./types";

/**
 * debug file for MCP server testing
 */
const bar = 1;

console.log(bar);

export const x = 42;

export function testFunction<T extends string>(
  required: string,
  optional?: number,
  withDefault: boolean = true,
  ...rest: T[]
): { result: string; count: number } {
  return { result: required, count: rest.length };
}

export const arrowFunction = <T>(
  items: T[],
  predicate: (item: T) => boolean
): T[] => {
  return items.filter(predicate);
};

export function getValue(): Value {
  return { v: "value" };
}
