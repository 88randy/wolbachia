import "./routes.ts";
import { registerScreen } from "../../navigation/screen-registry.ts";
import { HelpScreen } from "./HelpScreen.tsx";

registerScreen("help", HelpScreen);
