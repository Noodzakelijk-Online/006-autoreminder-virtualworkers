import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface InfoTooltipProps {
  content: string | React.ReactNode;
  /** Size of the icon in pixels (default 13) */
  size?: number;
  /** Extra class names for the trigger wrapper */
  className?: string;
  /** Side the tooltip appears on (default "top") */
  side?: "top" | "right" | "bottom" | "left";
  /** Max width of the tooltip box in px (default 280) */
  maxWidth?: number;
}

/**
 * A small ? icon that shows a tooltip on hover.
 * Use this to hide instructional/explanatory text behind an info icon,
 * keeping the dashboard surface clean and action-focused.
 *
 * Usage:
 *   <InfoTooltip content="This step processes all unread emails and links them to Trello cards." />
 */
export function InfoTooltip({
  content,
  size = 13,
  className = "",
  side = "top",
  maxWidth = 280,
}: InfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center justify-center cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors ${className}`}
            aria-label="More information"
          >
            <HelpCircle style={{ width: size, height: size }} />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="text-xs leading-relaxed"
          style={{ maxWidth }}
        >
          {typeof content === "string" ? <p>{content}</p> : content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
