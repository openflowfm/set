import { defineConfig } from 'vitest/config';

// One project per area, so a run can be read — or taken — an area at a time:
// `npm test -- --project=set/hooks`, and a named group in the report rather
// than every file in one list.
const module = (name: string, include: string[]) => ({
  test: { name, include, environment: 'node' as const },
});

export default defineConfig({
  test: {
    projects: [
      module('set/lib', ['src/lib/**/*.test.ts']),
      module('set/components', ['src/components/**/*.test.ts']),
      module('set/hooks', ['src/hooks/**/*.test.ts']),
    ],
    // Vitest 5's HTML reporter takes a directory rather than outputFile.
    // Keep report/ as the complete publishable site, including coverage.
    reporters: ['default', ['html', { outputDir: 'report' }]],
    coverage: {
      provider: 'v8',
      // Off by default, which means a failing run writes no report at all —
      // and a failing run is when the report is most worth having.
      reportOnFailure: true,
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      // Spelled out rather than inferred from what the tests imported: a file
      // nobody imports is the interesting case, and it should read 0% rather
      // than go missing.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.d.ts'],
    },
  },
});
