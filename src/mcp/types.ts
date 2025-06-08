import { type ZodSchema } from "zod";
export type ToolDef<TInput, TOutput = TInput> = {
  name: string;
  description: string;
  schema: ZodSchema<TOutput, any, TInput>;
  handler: (args: TOutput) => Promise<string>;
};
