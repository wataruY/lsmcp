import { type ZodType } from "zod";

export interface ToolDef<S extends ZodType> {
  name: string;
  description: string;
  schema: S;
  handler: (args: S["_output"]) => Promise<string>;
}
