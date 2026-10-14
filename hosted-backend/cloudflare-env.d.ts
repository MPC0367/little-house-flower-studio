declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DEMO_PASSWORD: string;
    DB: D1Database;
    BUCKET: R2Bucket;
  }
}
