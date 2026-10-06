// ESLint 9 flat config, satu file untuk seluruh monorepo (02-monorepo.md §4).
import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/dist_*/**',
      '**/node_modules/**',
      '**/.vercel/**',
      'apps/web/public/**',
      'packages/shared/src/api-client/schema.d.ts',
      'apps/api/tools/hermes-tools.json',
      // Bundle hasil esbuild (scripts/build-function.mjs), bukan kode sumber — lihat src/vercel-handler.ts.
      'apps/api/api/index.js',
      // Edge function LAMA: runtime Deno (import URL, global Deno), bukan Node/bundler.
      // Linting/typecheck-nya di luar toolchain pnpm ini; dihapus Fase 4/6 (lihat CLAUDE.md).
      'supabase/functions/**',
    ],
  },
  js.configs.recommended,
  // TypeScript (apps/api, packages/shared, file .ts/.tsx di apps/web)
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
    },
  },
  // JS/JSX lama di apps/web (belum dikonversi TSX, ADR-14: "dibiarkan sampai disentuh").
  // eslint-plugin-react dipakai supaya import yang hanya dipakai di JSX (mis. <LandingPage />)
  // tidak dianggap "unused" oleh no-unused-vars bawaan (false positive tanpa plugin ini).
  // no-undef/no-unused-vars/no-useless-escape diturunkan ke warning untuk kode LAMA: beberapa
  // file punya pola closure dalam JSX yang salah dideteksi parser dasar (bukan dicek ulang
  // dengan babel/TS parser di Fase 1), dan beberapa unused var memang sudah ada sebelumnya.
  // Tidak diperbaiki di sini supaya tidak melanggar "pindahkan apa adanya, tanpa ubah perilaku".
  // File baru (.tsx) tetap kena aturan ketat lewat blok TypeScript di atas.
  {
    files: ['apps/web/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { react },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unescaped-entities': 'off',
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
      'no-useless-escape': 'warn',
    },
  },
  // React hooks rules untuk semua file React di apps/web
  {
    files: ['apps/web/**/*.{jsx,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Node (apps/api)
  {
    files: ['apps/api/**/*.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Fase 4 (F4-T6): apps/web tidak boleh lagi query tabel Supabase atau panggil edge function
  // langsung — semua data domain lewat apps/api (07-frontend.md §1). Supabase client di apps/web
  // dipakai HANYA untuk auth (lib/supabase.js, supabase.auth.*), jadi .from()/.functions tetap
  // dilarang tanpa pengecualian file.
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name="from"][callee.object.name="supabase"]',
          message: 'apps/web tidak boleh query tabel Supabase langsung (supabase.from). Pakai hook di apps/web/src/hooks/** yang memanggil apps/api.',
        },
        {
          selector: 'MemberExpression[property.name="functions"][object.name="supabase"]',
          message: 'apps/web tidak boleh memanggil edge function Supabase langsung. Pakai endpoint apps/api yang sepadan.',
        },
      ],
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/services/api', '**/services/api.js'], message: 'callEdge/services/api.js sudah dihapus Fase 4 — pakai apps/web/src/api/client.ts.' }] },
      ],
    },
  },
  prettier,
]
