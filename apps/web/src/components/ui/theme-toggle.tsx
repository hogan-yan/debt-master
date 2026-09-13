import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { m } from '@/paraglide/messages';
import { Button } from './button';

export function ThemeToggle() {
  const { effectiveTheme, setTheme } = useTheme();
  const nextTheme = effectiveTheme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      title={m.theme_switchTo({ mode: nextTheme === 'dark' ? m.theme_dark() : m.theme_light() })}
      className="relative overflow-hidden"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100" />
      <span className="sr-only">{m.theme_toggle()}</span>
    </Button>
  );
}
