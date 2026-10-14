import {defineConfig} from '@playwright/test';
process.env.LHF_STAFF_TEST_ORIGIN='http://127.0.0.1:5374';
process.env.LHF_STAFF_TEST_DATA||=process.cwd()+'/data/qa-staff-followup-'+Date.now();
export default defineConfig({testDir:'.',testMatch:'staff-followup.spec.mjs',timeout:30000,workers:1,reporter:'list',use:{browserName:'webkit',viewport:{width:1440,height:1000},reducedMotion:'reduce'},webServer:{cwd:process.cwd(),command:'node server/main.mjs',url:'http://127.0.0.1:5374/api/health',reuseExistingServer:false,env:{CUSTOMER_PORT:'5373',ADMIN_PORT:'5374',API_PORT:'8987',LHF_DATA_DIR:process.env.LHF_STAFF_TEST_DATA}}});
