import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Reachable from phones on the same Wi-Fi at http://<laptop-ip>:5173.
    host: true,
  },
});