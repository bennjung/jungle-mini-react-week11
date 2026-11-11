import { defineConfig } from 'vite';

/**
 * Phase 2 예제 전용 dev 설정.
 * 기본 vite.config.ts의 Phase 1 진입점(main.html)과 포트를 분리한다.
 */
export default defineConfig({
  server: {
    port: 5174
  }
});
