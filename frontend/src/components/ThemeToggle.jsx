import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // adjust this path to match your project structure
import { useTheme } from "@/context/ThemeProvider";

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value)}>
      <SelectTrigger className="w-30 h-10">
        <SelectValue placeholder="Select theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">Light Mode</SelectItem>
        <SelectItem value="dark">Dark Mode</SelectItem>
      </SelectContent>
    </Select>
  );
}
