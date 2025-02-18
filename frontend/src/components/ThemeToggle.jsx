import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`flex items-center cursor-pointer transition-transform duration-500 ${
        isDark ? "rotate-180" : "rotate-0"
      }`}
    >
      {isDark ? (
        <Sun className="h-8 w-8 text-white rotate-0 transition-all" />
      ) : (
        <Moon className="h-8 w-8 text-black rotate-0 transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </div>
  );
}