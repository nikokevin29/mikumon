module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['auth', 'router', 'profile', 'hotspot', 'voucher', 'report', 'dashboard', 'ws', 'db', 'api', 'web', 'shared', 'utils', 'ci', 'deps'],
    ],
  },
}
