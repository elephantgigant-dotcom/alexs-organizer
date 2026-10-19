import { defineConfig } from 'vitest/config'

// Security-rules tests. They need the Firestore emulator, so run them with:
//   npm run test:rules
export default defineConfig({
  test: {
    include: ['tests/**/*.rules.test.js'],
    testTimeout: 20000,
    fileParallelism: false,
  },
})
