import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./test/e2e',
  fullyParallel:true,
  workers:3,
  timeout:30000,
  expect:{timeout:10000},
  outputDir:'.superpowers/sdd/listools-13-tools/browser-results',
  reporter:[['list'],['html',{outputFolder:'.superpowers/sdd/listools-13-tools/browser-report',open:'never'}]],
  webServer:process.env.LISTOOLS_TEST_URL?undefined:{command:'npm run preview -- --port 5174 --strictPort',url:'http://127.0.0.1:5174',reuseExistingServer:true,timeout:30000},
  use:{baseURL:process.env.LISTOOLS_TEST_URL||'http://127.0.0.1:5174',locale:'en-US',viewport:{width:1360,height:960},headless:true,trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{executablePath:process.env.LISTOOLS_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}}
});
