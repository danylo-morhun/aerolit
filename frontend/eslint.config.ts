import js from '@eslint/js';
import prettierSkipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,vue}'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'mock-data/**'],
  },

  js.configs.recommended,
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,

  {
    name: 'app/language-options',
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  {
    name: 'app/rules',
    rules: {
      // Component names: multi-word everywhere except the routed pages, which
      // are named for their route.
      'vue/multi-word-component-names': ['error', { ignores: [] }],
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/define-macros-order': [
        'error',
        { order: ['defineOptions', 'defineProps', 'defineEmits', 'defineSlots'] },
      ],
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],

      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  {
    // The domain layer is pure by contract: no framework, no I/O, no ambient
    // clock. Enforced here rather than by convention, because every metric in
    // the UI is only trustworthy if this holds.
    name: 'app/domain-purity',
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['vue', 'pinia', 'vue-router', '@/api/*', '@/stores/*'],
              message: 'src/domain must stay free of framework and I/O imports.',
            },
          ],
        },
      ],
      // Date *arithmetic* is fine and unavoidable here; reading the ambient
      // clock is not. The dataset is a fixed snapshot, so "now" is a value the
      // caller supplies — a hidden `Date.now()` would silently make every
      // derived metric depend on when the page happened to be opened.
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'Pass the snapshot instant in explicitly instead of reading the clock.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'src/domain must stay free of I/O.' },
      ],
    },
  },

  {
    name: 'app/tests',
    files: ['**/*.spec.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  {
    name: 'app/node-scripts',
    files: ['*.config.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  prettierSkipFormatting,
);
