import type { AnyRouter } from "@tanstack/react-router";
import { App } from "@capacitor/app";
import { backAction } from "./policy";
import { isNativeApp, setAppActive } from "./platform";

export async function setupNativeApp(router: AnyRouter) {
  if (!isNativeApp()) return;
  await App.addListener("appStateChange", ({ isActive }) => setAppActive(isActive));
  await App.addListener("backButton", () => {
    const overlay = !!document.querySelector(
      '[role="dialog"], [role="alertdialog"], [role="menu"]',
    );
    const action = backAction(overlay, router.history.canGoBack(), router.state.location.pathname);
    if (action === "dismiss") {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    } else if (action === "back") router.history.back();
    else if (action === "home") void router.navigate({ to: "/" });
    else void App.minimizeApp();
  });
  setAppActive((await App.getState()).isActive);
}
