import react from '/home/claude/repo/node_modules/@vitejs/plugin-react/dist/index.js';
import { defineConfig } from '/home/claude/repo/node_modules/vite/dist/node/index.js';
export default defineConfig({
  root: '/home/claude/repo',
  build: { outDir: '/tmp/e2e/dist', emptyOutDir: true, minify: false },
  define: { 'import.meta.env.VITE_SUPABASE_URL': '"http://test"' },
  plugins: [
    react(),
    {
      name: 'e2e-mocks',
      enforce: 'pre',
      async resolveId(source, importer) {
        if (!importer) return null;
        const r = await this.resolve(source, importer, { skipSelf: true });
        if (r && r.id.endsWith('/src/lib/supabase.js')) return '/tmp/e2e/supabase.mock.js';
        return null;
      },
      transform(code, id) {
        if (id.endsWith('/src/context/AppContext.jsx')) return code.replace('return <AppCtx.Provider value={value}>', 'window.__app = value; window.__state = stateRef; return <AppCtx.Provider value={value}>');
        return null;
      },
    },
  ],
});
