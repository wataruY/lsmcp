import { describe, it, expect } from "vitest";
import { formatMoveFileResult } from "./move_file.ts";
import type { MoveFileResult } from "./move_file.ts";

describe("move_file", () => {
  describe("formatMoveFileResult", () => {
    it("should format successful move with no import updates", async () => {
      const result: MoveFileResult = {
        message: "Moved file from 'src/old.ts' to 'src/new.ts'",
        changedFiles: ["/project/src/old.ts"],
      };

      const formatted = await formatMoveFileResult(
        result,
        "/project/src/old.ts",
        "/project/src/new.ts",
        "/project"
      );
      
      expect(formatted).toMatch("Moved file from 'src/old.ts' to 'src/new.ts'. Updated imports in 1 file(s).");
      expect(formatted).toMatch("File moved: src/old.ts → src/new.ts");
    });

    it("should format successful move with single import update", async () => {
      const result: MoveFileResult = {
        message: "Moved file from 'utils/helper.ts' to 'lib/helper.ts'",
        changedFiles: ["/project/utils/helper.ts", "/project/src/index.ts"],
      };

      const formatted = await formatMoveFileResult(
        result,
        "/project/utils/helper.ts",
        "/project/lib/helper.ts",
        "/project"
      );
      
      expect(formatted).toMatch("Moved file from 'utils/helper.ts' to 'lib/helper.ts'. Updated imports in 2 file(s).");
      expect(formatted).toMatch("File moved: utils/helper.ts → lib/helper.ts");
      expect(formatted).toMatch("src/index.ts:");
    });

    it("should format successful move with multiple import updates", async () => {
      const result: MoveFileResult = {
        message: "Moved file from 'components/Button.tsx' to 'ui/Button.tsx'",
        changedFiles: [
          "/project/components/Button.tsx",
          "/project/src/App.tsx",
          "/project/src/pages/Home.tsx",
          "/project/src/pages/About.tsx",
          "/project/src/components/Form.tsx",
        ],
      };

      const formatted = await formatMoveFileResult(
        result,
        "/project/components/Button.tsx",
        "/project/ui/Button.tsx",
        "/project"
      );
      
      expect(formatted).toMatch("Moved file from 'components/Button.tsx' to 'ui/Button.tsx'. Updated imports in 5 file(s).");
      expect(formatted).toMatch("File moved: components/Button.tsx → ui/Button.tsx");
      expect(formatted).toMatch("src/App.tsx:");
      expect(formatted).toMatch("src/pages/Home.tsx:");
      expect(formatted).toMatch("src/pages/About.tsx:");
      expect(formatted).toMatch("src/components/Form.tsx:");
    });

    it("should format move to different directory", async () => {
      const result: MoveFileResult = {
        message: "Moved file from 'src/utils/math.ts' to 'lib/math/index.ts'",
        changedFiles: [
          "/project/src/utils/math.ts",
          "/project/src/calculator.ts",
          "/project/src/statistics.ts",
        ],
      };

      const formatted = await formatMoveFileResult(
        result,
        "/project/src/utils/math.ts",
        "/project/lib/math/index.ts",
        "/project"
      );
      
      expect(formatted).toMatch("Moved file from 'src/utils/math.ts' to 'lib/math/index.ts'. Updated imports in 3 file(s).");
      expect(formatted).toMatch("File moved: src/utils/math.ts → lib/math/index.ts");
      expect(formatted).toMatch("src/calculator.ts:");
      expect(formatted).toMatch("src/statistics.ts:");
    });

    it("should format rename within same directory", async () => {
      const result: MoveFileResult = {
        message: "Moved file from 'types/user.ts' to 'types/User.ts'",
        changedFiles: [
          "/project/types/user.ts",
          "/project/src/models/user.model.ts",
          "/project/src/services/auth.service.ts",
          "/project/src/api/users.api.ts",
        ],
      };

      const formatted = await formatMoveFileResult(
        result,
        "/project/types/user.ts",
        "/project/types/User.ts",
        "/project"
      );
      
      expect(formatted).toMatch("Moved file from 'types/user.ts' to 'types/User.ts'. Updated imports in 4 file(s).");
      expect(formatted).toMatch("File moved: types/user.ts → types/User.ts");
      expect(formatted).toMatch("src/models/user.model.ts:");
      expect(formatted).toMatch("src/services/auth.service.ts:");
      expect(formatted).toMatch("src/api/users.api.ts:");
    });
  });
});