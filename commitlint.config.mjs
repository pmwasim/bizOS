export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 100],
    "scope-enum": [
      2,
      "always",
      [
        "api",
        "architecture",
        "auth",
        "ci",
        "database",
        "deps",
        "docs",
        "infra",
        "repo",
        "security",
        "ui",
        "web",
        "workflow",
      ],
    ],
  },
};
