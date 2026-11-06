import "@fontsource/inter/latin-400.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@wolbachia/tokens/tokens.css";
import "./styles/global.css";
import { startApp } from "./app/start-app";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

startApp(container, import.meta.env).catch((error: unknown) => {
  console.error("The app failed to start", error);
});
