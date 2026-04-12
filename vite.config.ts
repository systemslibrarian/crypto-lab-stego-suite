import { defineConfig } from "vite";

export default defineConfig(() => ({
  base: "/crypto-lab-stego-suite/",
  server: {
    host: true,
    port: 5173
  }
}));
