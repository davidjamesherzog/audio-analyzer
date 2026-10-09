# Audio Analyzer Project Instructions

## Project stack

- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Use Quasar components and the existing Vite configuration.
- Keep TypeScript strict and prefer type-only imports where applicable.
- Follow the repository's Prettier and ESLint configuration: single quotes, no semicolons, and a 100-character print width.
- Use the `src` alias for imports across directories and relative imports within the same directory.

## Implementation guidelines

- Preserve browser-only, local audio processing; do not introduce server uploads for audio data.
- Keep composables focused on reactive state and orchestration. Put reusable signal-processing and encoding logic in `src/utils`.
- Treat browser resources as owned resources: close `AudioContext` instances and revoke object URLs when replaced or unmounted.
- Keep worker message payloads typed and correlate asynchronous responses with request IDs.
- Surface actionable errors to the UI instead of silently swallowing failures.
- Avoid unrelated refactors when implementing a scoped change.

## Testing

- Use Vitest and Vue Test Utils.
- Place tests beside their source using the `*.test.ts` suffix.
- Add or update tests for every behavior change, including failure and cleanup paths.
- For Vue component tests, stub Quasar primitives used by the rendered component so test output has no unresolved-component warnings.
- Mock browser APIs and heavyweight model dependencies; unit tests must not download models, access the network, or run real inference.
- Target 100% statements, branches, functions, and lines for each modified source file when practical.
- Keep test stderr clean. Treat unexpected Vue warnings and unhandled errors as test failures to investigate.

## Verification

Run the narrowest relevant test while developing, then verify the completed change with:

```bash
npm run test:coverage
npm run lint
npx vue-tsc --noEmit
```

Do not run coverage generation and `vue-tsc` concurrently because the generated coverage directory can race with TypeScript file discovery.

## Change safety

- Preserve existing user changes and avoid destructive Git commands.
- Do not commit generated `coverage`, Quasar build, or dependency artifacts.
- Report the tests and checks run, including any failures that remain unrelated to the change.
