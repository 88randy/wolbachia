import "./routes.ts";
import { registerScreen } from "../../navigation/screen-registry.ts";
import { CommunityScreen } from "./CommunityScreen.tsx";

registerScreen("communityActivity", CommunityScreen);
