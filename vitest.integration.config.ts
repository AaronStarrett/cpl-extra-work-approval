import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
export default defineConfig(async () => ({
 plugins:[cloudflareTest({wrangler:{configPath:'./wrangler.jsonc',environment:'local'},miniflare:{bindings:{ENVIRONMENT:'test',ALLOW_TEST_PROTECTION:'true',CREATE_LIMIT_PER_HOUR:'5',RATE_LIMIT_PER_MINUTE:'180',TEST_MIGRATIONS:await readD1Migrations('migrations')}}})],
 test:{include:['tests/integration/**/*.test.ts'],setupFiles:['tests/integration/setup.ts'],fileParallelism:false}
}));
