import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; 
import { useTheme } from "@/context/ThemeProvider";

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value)}>
      <SelectTrigger className="w-30 h-10 cursor-pointer">
        <SelectValue placeholder="Select theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light" className="cursor-pointer">Light Mode</SelectItem>
        <SelectItem value="dark" className="cursor-pointer">Dark Mode</SelectItem>
      </SelectContent>
    </Select>
  );
}
