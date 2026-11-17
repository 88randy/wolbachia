import "./routes.ts";
import { registerScreen } from "../../navigation/screen-registry.ts";
import { DiagnosticsScreen } from "./DiagnosticsScreen.tsx";

registerScreen("diagnostics", DiagnosticsScreen);
