import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,

  {
    name: 'app/security-and-style',
    rules: {
      // Never render API data as HTML (XSS): text interpolation only.
      'vue/no-v-html': 'error',
      'vue/no-v-text-v-html-on-component': 'error',
      'vue/require-default-prop': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/attributes-order': 'off',
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Pas de stockage persistant de données sensibles (jeton en mémoire uniquement).' },
        { object: 'window', property: 'sessionStorage', message: 'Pas de stockage persistant de données sensibles (jeton en mémoire uniquement).' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Le jeton d’accès reste en mémoire (store Pinia).' },
        { name: 'sessionStorage', message: 'Le jeton d’accès reste en mémoire (store Pinia).' },
      ],
    },
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/**'],
    rules: {
      ...pluginVitest.configs.recommended.rules,
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
)
