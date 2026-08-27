import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Les specs e2e bootent chacune une app Nest qui lance `synchronize` sur la même
    // base ; on force une exécution séquentielle pour éviter les courses de migration.
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
