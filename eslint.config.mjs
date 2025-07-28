// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
  {
    ignores: [
      '**/.vscode-test',
      '**/out',
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    plugins: {
      '@stylistic': stylistic,
      'unused-imports': unusedImports,
    },
    rules: {
      'curly': 'warn',
      '@stylistic/semi': ['warn', 'always'],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          'selector': 'import',
          'format': ['camelCase', 'PascalCase']
        }
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          'argsIgnorePattern': '^_'
        }
      ],
      'indent': ['error', 2]
    }
  }
);
