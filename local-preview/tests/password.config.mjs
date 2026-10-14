import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'.', testMatch:'studio-password.e2e.mjs', timeout:90000, workers:1, retries:0,
  reporter:'list', use:{browserName:'webkit',serviceWorkers:'block',viewport:{width:390,height:844},reducedMotion:'reduce'},
  webServer:{cwd:process.cwd(),command:'node server/main.mjs',url:'http://127.0.0.1:5474/api/health',reuseExistingServer:false,
    env:{CUSTOMER_PORT:'5473',ADMIN_PORT:'5474',API_PORT:'9087',LHF_DATA_DIR:'data/qa-password-'+Date.now()}}
});
