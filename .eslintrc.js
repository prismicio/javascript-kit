module.exports = {
  "rules": {
    "indent": [1, 2,
      {"VariableDeclarator": { "var": 2, "let": 2, "const": 3}}
    ],
    "linebreak-style": [2, "unix"],
    "semi": [2, "always"],
    "consistent-return": 2,
    "no-console": 0
  },
  "env": {
    "node": true,
    "browser": true
  },
  "extends": "eslint:recommended"
};
