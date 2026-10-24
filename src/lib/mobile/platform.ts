import { Capacitor } from "@capacitor/core";
export const isNativeApp = () => Capacitor.isNativePlatform();
let appActive = true;
export const isAppActive = () => appActive;
export function setAppActive(active: boolean) {
  appActive = active;
  // The game's existing lifecycle subscribers save the board and stop/resume its clock.
  document.dispatchEvent(new Event("visibilitychange"));
}
