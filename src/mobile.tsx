import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { setupNativeApp } from "./lib/mobile/native";
import "@fontsource-variable/figtree";
import "@fontsource-variable/fraunces";
import "./styles.css";
import "./mobile.css";

const router = getRouter();
void setupNativeApp(router).catch((error) =>
  console.error("Android lifecycle setup failed", error),
);
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
