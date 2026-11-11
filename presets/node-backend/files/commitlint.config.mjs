// Enforces Conventional Commits. See the git-commit-and-workflow skill.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Subject line (header) at most 72 characters.
    'header-max-length': [2, 'always', 72],
    // Body lines: warn above 100 chars (URLs and stack traces can be long).
    'body-max-line-length': [1, 'always', 100],
    // Uncomment to restrict scopes to your project's modules:
    // 'scope-enum': [2, 'always', ['auth', 'checkout', 'api', 'db', 'ui', 'deps', 'release']],
  },
};
