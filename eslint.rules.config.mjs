import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*']
  },
  {
    files: ['**/*.rules'],
    plugins: {
      '@firebase/security-rules': firebaseRulesPlugin,
    },
    languageOptions: {
      parser: firebaseRulesPlugin.preprocessors['.rules'],
    },
    rules: {
      ...firebaseRulesPlugin.configs.recommended.rules,
    },
  }
];
