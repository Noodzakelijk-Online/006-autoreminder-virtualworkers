import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  timestamp: Date;
}

interface GoalInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string;
  cardName: string;
  onComplete: (goal: any) => void;
}

export function GoalInterviewDialog({
  open,
  onOpenChange,
  cardId,
  cardName,
  onComplete,
}: GoalInterviewDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(true);
  const [confidence, setConfidence] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Start interview when dialog opens
  useEffect(() => {
    if (open && isStarting) {
      startInterview();
    }
  }, [open]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const startInterview = async () => {
    setIsStarting(true);
    try {
      const response = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId }),
      });

      if (!response.ok) throw new Error('Failed to start interview');

      const data = await response.json();
      setMessages([{
        role: 'assistant',
        content: data.firstMessage || 'Interview started. Please answer the following questions.',
        timestamp: new Date(),
      }]);
      setConfidence(data.confidence || 0);
    } catch (error) {
      console.error('Failed to start interview:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setMessages([{
        role: 'assistant',
        content: `Sorry, I encountered an error starting the interview: ${errorMsg}. Please try again.`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message immediately
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);

    try {
      const response = await fetch('/api/trpc/interview.respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, response: userMessage }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      const result = data.result.data;

      // Add AI response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.nextMessage,
        timestamp: new Date(),
      }]);

      setConfidence(result.confidence || 0);

      // Check if interview is complete
      if (result.isComplete && result.finalGoal) {
        setIsComplete(true);
        // Show final goal for 2 seconds, then call onComplete
        setTimeout(() => {
          onComplete(result.finalGoal);
          onOpenChange(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Could you repeat that?',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Goal Clarification Interview</span>
            <div className="flex items-center gap-2 text-sm font-normal">
              <span className="text-muted-foreground">Confidence:</span>
              <div className="flex items-center gap-1">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      confidence >= 70 ? "bg-green-500" : confidence >= 50 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${confidence}%` }}
                  />
                </div>
                <span className={cn(
                  "font-mono text-xs",
                  confidence >= 70 ? "text-green-600" : confidence >= 50 ? "text-yellow-600" : "text-red-600"
                )}>
                  {confidence}%
                </span>
              </div>
            </div>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Card: <span className="font-medium">{cardName}</span>
          </p>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? "justify-end" : "justify-start"
                )}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary">AI</span>
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.role === 'user'
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-primary-foreground">You</span>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-primary">AI</span>
                </div>
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        {!isComplete && (
          <div className="flex gap-2 pt-4 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your answer..."
              disabled={isLoading || isStarting}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading || isStarting}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        )}

        {/* Complete state */}
        {isComplete && (
          <div className="flex items-center justify-center gap-2 py-4 text-green-600 border-t">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Interview complete! Generating execution plan...</span>
          </div>
        )}

        {/* Confidence warning */}
        {confidence < 50 && messages.length > 2 && !isComplete && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Low confidence - please provide more specific details</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
