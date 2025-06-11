import { describe, it, expect } from "vitest";
import { formatGetDiagnosticsResult } from "./ts_get_diagnostics.ts";
import type { GetDiagnosticsResult } from "./ts_get_diagnostics.ts";

describe("get_diagnostics", () => {
  describe("formatGetDiagnosticsResult", () => {
    it("should format diagnostics with errors", () => {
      const result: GetDiagnosticsResult = {
        message: `src/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.

10     const count: number = "hello";
       ~~~~~

src/index.ts:15:3 - error TS2304: Cannot find name 'unknownFunction'.

15   unknownFunction();
     ~~~~~~~~~~~~~~~`,
      };

      expect(formatGetDiagnosticsResult(result)).toMatchInlineSnapshot(`
        "src/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.

        10     const count: number = "hello";
               ~~~~~

        src/index.ts:15:3 - error TS2304: Cannot find name 'unknownFunction'.

        15   unknownFunction();
             ~~~~~~~~~~~~~~~"
      `);
    });

    it("should format diagnostics with warnings", () => {
      const result: GetDiagnosticsResult = {
        message: `src/utils.ts:5:7 - warning TS6133: 'unusedVar' is declared but its value is never read.

5       const unusedVar = 42;
        ~~~~~~~~~`,
      };

      expect(formatGetDiagnosticsResult(result)).toMatchInlineSnapshot(`
        "src/utils.ts:5:7 - warning TS6133: 'unusedVar' is declared but its value is never read.

        5       const unusedVar = 42;
                ~~~~~~~~~"
      `);
    });

    it("should format no diagnostics", () => {
      const result: GetDiagnosticsResult = {
        message: "No diagnostics found in 1 file.",
      };

      expect(formatGetDiagnosticsResult(result)).toMatchInlineSnapshot(
        `"No diagnostics found in 1 file."`
      );
    });

    it("should format mixed diagnostics", () => {
      const result: GetDiagnosticsResult = {
        message: `src/app.ts:3:1 - error TS1128: Declaration or statement expected.

3 }
  ~

src/app.ts:7:10 - warning TS6133: 'name' is declared but its value is never read.

7 function greet(name: string) {
           ~~~~~

Found 1 error and 1 warning in 1 file.`,
      };

      expect(formatGetDiagnosticsResult(result)).toMatchInlineSnapshot(`
        "src/app.ts:3:1 - error TS1128: Declaration or statement expected.

        3 }
          ~

        src/app.ts:7:10 - warning TS6133: 'name' is declared but its value is never read.

        7 function greet(name: string) {
                   ~~~~~

        Found 1 error and 1 warning in 1 file."
      `);
    });
  });
});