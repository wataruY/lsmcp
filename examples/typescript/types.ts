export type Value = {
  v: string;
};

export type ValueWithOptional = {
  v: string;
  o?: string;
};

export function getValue(): Value {
  return { v: "value" };
}
