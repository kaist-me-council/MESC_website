import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler 계열 규칙(eslint-config-next 16.4 에서 error 로 승격). 이 저장소에서 걸리는 곳은
    // "마운트 시 fetch 후 await 다음에 setState", "localStorage 로 하이드레이션", "이벤트 핸들러 안의
    // Date.now/ref" 처럼 동작상 문제가 없는 패턴이라 CI 를 막지 않게 경고로 둔다. 새 코드에서는 경고도 피할 것.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
