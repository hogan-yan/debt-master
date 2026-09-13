import { Spinner } from '@/components/ui/spinner';
import { m } from '@/paraglide/messages';

interface FullscreenLoaderProps {
  message?: string;
}

export function FullscreenLoader({ message }: FullscreenLoaderProps) {
  const resolvedMessage = message ?? m.common_loading();
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <Spinner className="h-10 w-10" />
      <p className="mt-4 text-sm text-muted-foreground">{resolvedMessage}</p>
    </div>
  );
}
