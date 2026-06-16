import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import obfuscator from 'vite-plugin-javascript-obfuscator'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  const DEV_PORT = env.VITE_DEV_PORT ? Number(env.VITE_DEV_PORT) : 5173;
  const DEV_HOST = env.VITE_DEV_HOST || 'localhost';
  const enableObfuscation = String(env.VITE_ENABLE_OBFUSCATION || '').toLowerCase() === 'true';
  const rawAppBaseUrl =
    env.VITE_APP_BASE_URL ||
    env.VITE_BASE_URL ||
    env.BACKEND_URL ||
    env.VITE_HRMS_API_ROOT ||
    env.VITE_API_URL ||
    '';
  const normalizeBackendUrl = (value) =>
    String(value || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  const BACKEND_URL = normalizeBackendUrl(rawAppBaseUrl) || 'http://localhost:5003';
  const HMR_PROTOCOL = env.VITE_HMR_PROTOCOL || 'ws';
  const HMR_HOST = env.VITE_HMR_HOST;
  const HMR_PORT = env.VITE_HMR_PORT ? Number(env.VITE_HMR_PORT) : DEV_PORT;

  return {
    plugins: [
      react(),
      mode === 'production' && enableObfuscation && obfuscator({
        include: [/\.(js|jsx)$/],
        exclude: [/node_modules/],
        options: {
          compact: true,
          controlFlowFlattening: false,
          controlFlowFlatteningThreshold: 0.15,
          deadCodeInjection: false,
          deadCodeInjectionThreshold: 0,
          debugProtection: true,
          debugProtectionInterval: 0,
          disableConsoleOutput: true,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          numbersToExpressions: true,
          renameGlobals: false,
          selfDefending: false,
          simplify: true,
          splitStrings: true,
          splitStringsChunkLength: 8,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayEncoding: ['base64'],
          stringArrayThreshold: 0.6,
          transformObjectKeys: true,
          unicodeEscapeSequence: false
        }
      })
    ].filter(Boolean),
    server: {
      host: DEV_HOST,
      port: DEV_PORT,
      strictPort: true, // Keep a stable dev URL so auth redirects never land on a stale port
      hmr: {
        protocol: HMR_PROTOCOL,
        host: HMR_HOST || DEV_HOST,
        port: HMR_PORT,
        clientPort: HMR_PORT,
      },
      watch: {
        usePolling: false,
      },
      proxy: {
        '/socket.io': {
          target: BACKEND_URL,
          changeOrigin: true,
          ws: true,
        },
        '/api': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        '/uploads': {
          target: BACKEND_URL,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {

      },
    },
    define: {
      global: 'window',
    },
    optimizeDeps: {
      include: [
        '@tiptap/react',
        '@tiptap/starter-kit',
        '@tiptap/extension-image',
        '@tiptap/extension-text-align',
        '@tiptap/extension-underline',
        '@tiptap/extension-link',
        '@tiptap/extension-placeholder',
        'react-signature-canvas',
        'signature_pad'
      ],
      exclude: ['face-api.js']
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      cssCodeSplit: true,
      reportCompressedSize: false,
      assetsDir: 'assets',
      minify: 'terser',
      terserOptions: {
        mangle: {
          safari10: true,
        },
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.info', 'console.debug', 'console.warn'],
        },
        format: {
          comments: false,
          ascii_only: true,
        },
      },
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/app-[hash].js',
          chunkFileNames: 'assets/chunk-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
