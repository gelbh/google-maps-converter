import { defineConfig } from "vite";

export default defineConfig({
  base: "/google-maps-converter/",
  root: ".",
  publicDir: "public",
  server: {
    port: 3000,
    open: true,
  },
});
