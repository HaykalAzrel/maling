
  import { useEffect } from "react";
  import { Capacitor } from "@capacitor/core";
  import { App as CapacitorApp } from "@capacitor/app";
  import { StatusBar, Style } from "@capacitor/status-bar";
  import { SplashScreen } from "@capacitor/splash-screen";
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { AppThemeProvider } from "./app/theme-provider";
  import "./styles/index.css";

  function NativeBootstrap() {
    const isNativePlatform = Capacitor.isNativePlatform();

    useEffect(() => {
      if (!isNativePlatform) {
        return;
      }

      void SplashScreen.hide();
    }, [isNativePlatform]);

    useEffect(() => {
      if (!isNativePlatform) {
        return;
      }

      void StatusBar.setBackgroundColor({ color: "#09111f" });
      void StatusBar.setStyle({ style: Style.Dark });

      const handleBackButton = CapacitorApp.addListener("backButton", () => {
        window.history.length > 1 ? window.history.back() : CapacitorApp.exitApp();
      });

      return () => {
        void handleBackButton.then((listener) => listener.remove());
      };
    }, [isNativePlatform]);

    return null;
  }

  createRoot(document.getElementById("root")!).render(
    <AppThemeProvider>
      <NativeBootstrap />
      <App />
    </AppThemeProvider>
  );
  