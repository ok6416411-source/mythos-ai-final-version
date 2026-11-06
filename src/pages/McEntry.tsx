import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { setEntry } from "@/lib/entry";

/** Minecraft-Einstieg (/mc, /minecraft): merkt sich den Einstieg, dann weiter in den Support-Chat. */
export default function McEntry() {
  useEffect(() => { setEntry("mc"); }, []);
  setEntry("mc");
  return <Navigate to="/app?mode=support" replace />;
}
