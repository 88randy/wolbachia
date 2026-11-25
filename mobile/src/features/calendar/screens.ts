import "./routes.ts";
import { registerScreen } from "../../navigation/screen-registry.ts";
import { P33bScreen } from "./P33bScreen.tsx";
import { P33Screen } from "./P33Screen.tsx";

registerScreen("calendar", P33Screen);
registerScreen("calendarTrack", P33bScreen);
