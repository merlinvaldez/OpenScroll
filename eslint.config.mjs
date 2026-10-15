import { defineConfig, globalIgnores } from "eslint/config";
import reactPlugin from "eslint-plugin-react";

export default defineConfig([
  globalIgnores([
    "**/.next/**",
    "**/node_modules/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "packages/contracts/baseline/**"
  ]),
  {
    files: ["**/*.js", "**/*.mjs"],
    plugins: {
      react: reactPlugin
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      "react/jsx-uses-vars": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "off"
    }
  }
]);
