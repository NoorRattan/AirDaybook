import tseslint from "typescript-eslint";

export default [
  { ignores: [".next/**", ".feasibility/**", ".runtime/**", "next-env.d.ts", "public/sw.js"] },
  ...tseslint.configs.recommended,
  { rules: { "no-control-regex": "off" } },
];
