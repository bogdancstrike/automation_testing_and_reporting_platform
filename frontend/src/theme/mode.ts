import { createContext, useContext } from "react";
import type { Mode } from "./tokens";

/** Current theme mode, provided at the app root so charts/badges can adapt. */
export const ModeContext = createContext<Mode>("light");
export const useMode = (): Mode => useContext(ModeContext);
