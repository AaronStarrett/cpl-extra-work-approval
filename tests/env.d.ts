import type { D1Migration } from '@cloudflare/vitest-pool-workers';
declare global {
 namespace Cloudflare {
  interface Env {DB:D1Database; TEST_MIGRATIONS:D1Migration[]; ENVIRONMENT:string; ALLOW_TEST_PROTECTION:string}
 }
}
