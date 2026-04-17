import React, { useState } from 'react';
import { Info } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CardWithTooltipProps {
  title: string;
  tooltipContent: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * Reusable card component with tooltip for settings pages
 * Displays a card with a title and optional tooltip on hover or keyboard focus
 * Supports keyboard navigation: Tab to focus, Enter/Space to open tooltip
 */
export const CardWithTooltip: React.FC<CardWithTooltipProps> = ({
  title,
  tooltipContent,
  icon,
  children,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          {icon && icon}
          {title}
          <TooltipProvider>
            <Tooltip open={isOpen} onOpenChange={setIsOpen}>
              <TooltipTrigger
                asChild
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="button"
                aria-label={`Show information about ${title}`}
              >
                <Info className="h-4 w-4 text-muted-foreground cursor-help focus:outline-none focus:ring-2 focus:ring-primary rounded" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{tooltipContent}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 md:space-y-4">
        {children}
      </CardContent>
    </Card>
  );
};
