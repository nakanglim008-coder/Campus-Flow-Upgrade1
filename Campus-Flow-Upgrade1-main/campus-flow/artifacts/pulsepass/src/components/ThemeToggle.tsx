import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-[var(--color-secondary)] transition-colors"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-[var(--color-muted-foreground)]" />
      ) : (
        <Moon className="w-4 h-4 text-[var(--color-muted-foreground)]" />
      )}
    </motion.button>
  );
}
