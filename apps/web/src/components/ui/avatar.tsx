import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full', className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted', // unslop-ignore: avatar circle
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

// Enhanced Avatar component with built-in fallback generation
interface EnhancedAvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'sm' | 'default' | 'lg' | 'xl';
  className?: string;
  fallbackClassName?: string;
}

const sizeVariants = {
  sm: 'h-7 w-7 text-xs',
  default: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-20 w-20 text-xl',
};

function generateInitials(name?: string): string {
  if (!name) return '?';

  return name
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function colorFromHash(hash: number, palette: readonly string[]): string {
  if (palette.length === 0) {
    return 'bg-gray-500';
  }
  const color = palette[Math.abs(hash) % palette.length];
  if (color == null) {
    return 'bg-gray-500';
  }
  return color;
}

export function getInitialsColor(name?: string): string {
  if (!name) return 'bg-gray-500';

  // Generate a consistent color based on the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    'bg-zinc-400',
    'bg-zinc-500',
    'bg-zinc-600',
    'bg-neutral-400',
    'bg-neutral-500',
    'bg-stone-400',
    'bg-stone-500',
    'bg-gray-400',
    'bg-gray-500',
    'bg-slate-400',
  ] as const;

  return colorFromHash(hash, colors);
}

export function EnhancedAvatar({
  src,
  alt = '',
  name = '',
  size = 'default',
  className = '',
  fallbackClassName = '',
}: EnhancedAvatarProps) {
  const initials = generateInitials(name);
  const colorClass = getInitialsColor(name);

  return (
    <Avatar className={cn(sizeVariants[size], className)}>
      {src && <AvatarImage src={src} alt={alt || name || ''} />}
      <AvatarFallback
        className={cn(colorClass, 'cursor-default text-white font-medium', fallbackClassName)}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export { Avatar, AvatarFallback, AvatarImage };
