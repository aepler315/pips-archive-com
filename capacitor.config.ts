import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aepler315.pipsarchive",
  appName: "Pips Archive",
  webDir: "dist/mobile",
  backgroundColor: "#efe6d6",
  android: { allowMixedContent: false },
};
export default config;
