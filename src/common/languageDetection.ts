/**
 * Language detection utilities for multi-language MCP support
 */

import { extname } from "path";
import { existsSync } from "fs";
import { join } from "path";

export interface LanguageInfo {
  languageId: string;
  fileExtensions: string[];
  lspCommand?: string;
  lspArgs?: string[];
}

// Language configurations
export const LANGUAGE_CONFIGS: Record<string, LanguageInfo> = {
  typescript: {
    languageId: "typescript",
    fileExtensions: [".ts", ".tsx", ".mts", ".cts"],
    lspCommand: "typescript-language-server",
    lspArgs: ["--stdio"],
  },
  javascript: {
    languageId: "javascript", 
    fileExtensions: [".js", ".jsx", ".mjs", ".cjs"],
    lspCommand: "typescript-language-server",
    lspArgs: ["--stdio"],
  },
  moonbit: {
    languageId: "moonbit",
    fileExtensions: [".mbt"],
    // LSP command is determined dynamically
  },
  rust: {
    languageId: "rust",
    fileExtensions: [".rs"],
    lspCommand: "rust-analyzer",
    lspArgs: [],
  },
  python: {
    languageId: "python",
    fileExtensions: [".py", ".pyi"],
    lspCommand: "pylsp",
    lspArgs: [],
  },
  go: {
    languageId: "go",
    fileExtensions: [".go"],
    lspCommand: "gopls",
    lspArgs: [],
  },
  java: {
    languageId: "java",
    fileExtensions: [".java"],
    lspCommand: "jdtls",
    lspArgs: [],
  },
  cpp: {
    languageId: "cpp",
    fileExtensions: [".cpp", ".cc", ".cxx", ".hpp", ".h", ".hxx"],
    lspCommand: "clangd",
    lspArgs: [],
  },
  c: {
    languageId: "c",
    fileExtensions: [".c", ".h"],
    lspCommand: "clangd", 
    lspArgs: [],
  },
};

/**
 * Detect language from file path
 */
export function detectLanguageFromPath(filePath: string): LanguageInfo | null {
  const ext = extname(filePath).toLowerCase();
  
  for (const [, langInfo] of Object.entries(LANGUAGE_CONFIGS)) {
    if (langInfo.fileExtensions.includes(ext)) {
      return langInfo;
    }
  }
  
  return null;
}

/**
 * Get language info by ID
 */
export function getLanguageInfo(languageId: string): LanguageInfo | null {
  return LANGUAGE_CONFIGS[languageId] || null;
}

/**
 * Check if a file is supported by a specific language
 */
export function isFileSupported(filePath: string, languageId: string): boolean {
  const langInfo = getLanguageInfo(languageId);
  if (!langInfo) return false;
  
  const ext = extname(filePath).toLowerCase();
  return langInfo.fileExtensions.includes(ext);
}

/**
 * Get all supported file extensions for a language
 */
export function getSupportedExtensions(languageId: string): string[] {
  const langInfo = getLanguageInfo(languageId);
  return langInfo?.fileExtensions || [];
}

/**
 * Detect project language based on configuration files
 */
export function detectProjectLanguage(projectRoot: string): LanguageInfo | null {
  // Check for language-specific configuration files
  const configChecks = [
    { file: "tsconfig.json", language: "typescript" },
    { file: "package.json", language: "javascript" },
    { file: "moon.mod.json", language: "moonbit" },
    { file: "Cargo.toml", language: "rust" },
    { file: "pyproject.toml", language: "python" },
    { file: "requirements.txt", language: "python" },
    { file: "go.mod", language: "go" },
    { file: "pom.xml", language: "java" },
    { file: "build.gradle", language: "java" },
    { file: "CMakeLists.txt", language: "cpp" },
    { file: "Makefile", language: "c" },
  ];

  for (const { file, language } of configChecks) {
    if (existsSync(join(projectRoot, file))) {
      return getLanguageInfo(language);
    }
  }

  return null;
}