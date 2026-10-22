import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const lambdaUrl = process.env.LAMBDA_URL;

const lambdaProxy = {
  "/api": {
    target: lambdaUrl,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
    configure: (proxy) =>
      proxy.on("proxyReq", (request) => {
        request.removeHeader("origin");
        request.removeHeader("referer");
      }),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: lambdaUrl ? lambdaProxy : undefined },
});
