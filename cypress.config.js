import { defineConfig } from "cypress";

export default defineConfig({
  projectId: 'p8jro5',
  e2e: {
    baseUrl: "http://localhost:5173",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/e2e.js",
    video: false,
    screenshotsFolder: "cypress/screenshots",
    downloadsFolder: "cypress/downloads",
  },
});
