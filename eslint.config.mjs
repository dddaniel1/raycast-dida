import baseConfig from "@raycast/eslint-config";

export default [
  ...baseConfig,
  {
    ignores: ["node_modules/**", "assets/**", "**/*.md"],
  },
];
