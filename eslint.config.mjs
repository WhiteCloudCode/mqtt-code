import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    ignores: [
      "out/",
      "dist/",
      "**/*.d.ts",
      "esbuild.js"
    ]
  },
  {
    rules: {
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          "selector": "default",
          "format": ["camelCase"]
        },
        {
          "selector": "variable",
          "format": ["camelCase", "UPPER_CASE"]
        },
        {
          "selector": "parameter",
          "format": ["camelCase"],
          "leadingUnderscore": "allow"
        },
        {
          "selector": [
            "classProperty",
            "objectLiteralProperty",
            "typeProperty",
            "classMethod",
            "objectLiteralMethod",
            "typeMethod",
            "accessor",
            "enumMember"
          ],
          "format": null,
          "modifiers": ["requiresQuotes"]
        },
        {
          "selector": "memberLike",
          "modifiers": ["private"],
          "format": ["camelCase"],
          "leadingUnderscore": "allow"
        },
        {
          "selector": "typeLike",
          "format": ["PascalCase"]
        },
        {
          "selector": "enumMember",
          "format": ["UPPER_CASE"]
        },
        {
          "selector": "import",
          "format": ["camelCase", "PascalCase"]
        }
      ],
      "curly": "warn",
      "eqeqeq": "warn",
      "no-throw-literal": "warn"
    }
  }
);
