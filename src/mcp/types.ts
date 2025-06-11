import { type ZodType } from "zod";

export interface ToolDef<S extends ZodType> {
  name: string;
  description: string;
  schema: S;
  execute: (args: S["_output"]) => Promise<string>;
}
