import React from 'react';
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
 * Displays a card with a title and optional tooltip on hover
 */
export const CardWithTooltip: React.FC<CardWithTooltipProps> = ({
  title,
  tooltipContent,
  icon,
  children,
  className,
}) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          {icon && icon}
          {title}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
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
