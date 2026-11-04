module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Generated dependency tables and release notes can exceed 100 characters.
    'body-max-line-length': [0],
  },
};
