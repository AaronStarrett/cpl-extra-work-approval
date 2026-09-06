if (process.env.CF_PAGES || (process.env.WORKERS_CI_BRANCH && process.env.WORKERS_CI_BRANCH !== 'main')) {
  throw new Error('Production deployment is restricted to the main branch. Use isolated preview infrastructure for other branches.');
}
