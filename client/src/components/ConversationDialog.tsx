import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, 
  Bot, 
  User, 
  Clock, 
  Send, 
  RefreshCw,
  ExternalLink,
  Loader2 
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Conversation {
  id: number;
  cardId: string;
  cardName: string;
  messageType: 'command' | 'response' | 'checkin' | 'reminder';
  command: string | null;
  authorName: string;
  authorId: string;
  botResponse: string | null;
  createdAt: string;
}

interface ConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardId: string | null;
  cardName: string | null;
}

export function ConversationDialog({ 
  open, 
  onOpenChange, 
  cardId, 
  cardName 
}: ConversationDialogProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    if (conversations.length > 0) {
      scrollToBottom();
    }
  }, [conversations]);

  const loadConversations = async () => {
    if (!cardId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/trello-webhook/history/${cardId}?limit=50`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && cardId) {
      loadConversations();
    }
  }, [open, cardId]);

  const handleSendMessage = async () => {
    if (!cardId || !message.trim()) return;

    setSending(true);
    try {
      const response = await fetch('/api/trello-webhook/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cardId,
          message: message.trim(),
        }),
      });

      if (response.ok) {
        toast.success('Message sent to Trello');
        setMessage('');
        // Reload conversations after a short delay
        setTimeout(loadConversations, 1000);
      } else {
        toast.error('Failed to send message');
      }
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleTriggerCheckin = async () => {
    if (!cardId) return;

    setSending(true);
    try {
      const response = await fetch('/api/trello-webhook/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cardId,
          type: 'midday',
        }),
      });

      if (response.ok) {
        toast.success('Check-in sent');
        setTimeout(loadConversations, 1000);
      } else {
        toast.error('Failed to send check-in');
      }
    } catch (error) {
      toast.error('Failed to send check-in');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'command':
        return <User className="h-4 w-4" />;
      case 'response':
        return <Bot className="h-4 w-4" />;
      case 'checkin':
        return <Clock className="h-4 w-4" />;
      case 'reminder':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getMessageColor = (type: string) => {
    switch (type) {
      case 'command':
        return 'bg-blue-500';
      case 'response':
        return 'bg-purple-500';
      case 'checkin':
        return 'bg-yellow-500';
      case 'reminder':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] !flex !flex-col p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            Conversations
          </DialogTitle>
          <DialogDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs sm:text-sm">
            <span className="truncate max-w-[280px] sm:max-w-[400px] font-medium text-foreground/80">
              {cardName || 'Card conversations'}
            </span>
            {cardId && (
              <a
                href={`https://trello.com/c/${cardId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="h-3 w-3" />
                View in Trello
              </a>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 pb-2 border-b">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerCheckin}
            disabled={sending}
          >
            <Clock className="h-4 w-4 mr-1" />
            Send Check-in
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadConversations}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1 min-h-0 h-0 pr-2">
          {loading ? (
            <div className="space-y-4 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No conversations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Use @bot commands in Trello comments to start a conversation
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {conversations.map((conv) => (
                <div key={conv.id} className="flex gap-3">
                  {/* Avatar */}
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-white flex-shrink-0",
                    getMessageColor(conv.messageType)
                  )}>
                    {getMessageIcon(conv.messageType)}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {conv.messageType === 'response' ? '@bot' : conv.authorName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {conv.messageType}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(conv.createdAt)}
                      </span>
                    </div>

                    {/* Command */}
                    {conv.command && (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm">
                        <code className="text-primary">{conv.command}</code>
                      </div>
                    )}

                    {/* Bot Response */}
                    {conv.botResponse && (
                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mt-2 text-sm whitespace-pre-wrap">
                        {conv.botResponse}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Send Message */}
        <div className="flex gap-2 pt-2 border-t">
          <Input
            placeholder="Send a message to this card..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            disabled={sending}
          />
          <Button onClick={handleSendMessage} disabled={sending || !message.trim()}>
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ConversationDialog;
