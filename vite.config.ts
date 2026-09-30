import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      // 미리보기 도구가 PORT를 정해 주면 그 포트를 쓴다 (5173이 다른 프로그램에 잡혀 있을 때)
      port: Number(env.PORT) || 5173,
      // 백엔드에 CORS 설정이 없어 개발 서버가 대신 전달한다 (real 모드)
      proxy: {
        '/v1': { target: env.VITE_BACKEND_URL ?? 'http://localhost:8000', changeOrigin: true },
        // 원고 업로드 presigned URL(s3mock)도 같은 이유로 프록시를 거친다. Host는 서명과 맞도록 대상 주소로 바꾼다
        '/__s3': {
          target: env.VITE_S3_URL ?? 'http://localhost:9000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/__s3/, ''),
        },
      },
    },
  }
})
