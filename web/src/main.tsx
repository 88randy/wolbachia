import { startApp } from "./app/start-app";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element in index.html");
}

startApp(container, import.meta.env).catch((error: unknown) => {
  console.error("The app failed to start", error);
});
