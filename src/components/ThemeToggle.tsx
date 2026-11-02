import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  return <Button variant="outline" size="icon" className="fixed right-3 bottom-3 z-40 h-9 w-9 bg-background" aria-label={dark ? "Helles Design" : "Dunkles Design"} title={dark ? "Helles Design" : "Dunkles Design"} onClick={() => setTheme(dark ? "light" : "dark")}>
    {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
  </Button>;
}