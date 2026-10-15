import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("UI Notification Guidelines - Static Code Verification", () => {
  const srcDir = path.resolve(__dirname, "..");

  function getAllCodeFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        getAllCodeFiles(fullPath, fileList);
      } else if (
        (file.endsWith(".ts") || file.endsWith(".tsx")) &&
        !file.endsWith(".test.ts") &&
        !file.endsWith(".test.tsx") &&
        !file.endsWith(".d.ts")
      ) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  it("should not contain any window.alert, window.confirm, or window.prompt in src/", () => {
    const files = getAllCodeFiles(srcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    const browserDialogRegex = /\bwindow\.(alert|confirm|prompt)\s*\(/;

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        // Exclude commented-out lines
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

        if (browserDialogRegex.test(line)) {
          violations.push({
            file: path.relative(srcDir, file),
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found forbidden browser dialog calls (window.alert/confirm/prompt):\n${violations
        .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
        .join("\n")}`
    ).toEqual([]);
  });

  it("should not contain unqualified alert(), confirm(), or prompt() calls in src/", () => {
    const files = getAllCodeFiles(srcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    // Match alert(, confirm(, prompt( that are NOT properties of an object (not preceded by .)
    const unqualifiedDialogRegex = /(?<![\.\w])(alert|confirm|prompt)\s*\(/;

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

        if (unqualifiedDialogRegex.test(line)) {
          violations.push({
            file: path.relative(srcDir, file),
            line: index + 1,
            text: line.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found forbidden unqualified dialog calls (alert/confirm/prompt):\n${violations
        .map((v) => `  ${v.file}:${v.line} -> ${v.text}`)
        .join("\n")}`
    ).toEqual([]);
  });

  it("should have ToastContext and ConfirmDialog present in codebase", () => {
    const toastContextPath = path.join(srcDir, "context", "ToastContext.tsx");
    const confirmDialogPath = path.join(srcDir, "components", "ConfirmDialog.tsx");

    expect(fs.existsSync(toastContextPath)).toBe(true);
    expect(fs.existsSync(confirmDialogPath)).toBe(true);
  });
});
