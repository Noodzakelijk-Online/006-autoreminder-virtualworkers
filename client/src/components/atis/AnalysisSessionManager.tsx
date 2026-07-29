import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, Trash2, Download, RefreshCw } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface Session {
  sessionId: string;
  taskId: string;
  taskTitle: string;
  createdAt: string;
  updatedAt: string;
  overallConfidence: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  completedPhases: number;
  totalPhases: number;
}

interface AnalysisSessionManagerProps {
  taskId: string;
  currentSessionId: string;
}

export default function AnalysisSessionManager({
  taskId,
  currentSessionId,
}: AnalysisSessionManagerProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load sessions for the task
  useEffect(() => {
    if (taskId) {
      loadSessions();
    }
  }, [taskId]);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/atis/phases/sessions?taskId=${taskId}`);
      if (!response.ok) throw new Error('Failed to load sessions');
      const data = await response.json();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      const response = await fetch(`/api/atis/phases/session/${sessionId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete session');
      setSessions(sessions.filter(s => s.sessionId !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDownloadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/atis/phases/session/${sessionId}`);
      if (!response.ok) throw new Error('Failed to download session');
      const data = await response.json();

      // Create a blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atis-session-${sessionId.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    // This would typically reload the session data into the main dashboard
    window.location.hash = `#session=${sessionId}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <h3 className="font-semibold">Analysis Sessions</h3>
        </div>
        <Button onClick={loadSessions} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No analysis sessions found for this task</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card
              key={session.sessionId}
              className={session.sessionId === currentSessionId ? 'border-primary bg-primary/5' : ''}
            >
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {/* Session Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{session.taskTitle}</p>
                        {session.sessionId === currentSessionId && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Session: {session.sessionId.slice(0, 12)}...
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{session.overallConfidence}%</p>
                      <p className="text-xs text-muted-foreground">confidence</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {session.completedPhases}/{session.totalPhases} phases
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${(session.completedPhases / session.totalPhases) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Status & Dates */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium capitalize">{session.status}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">{new Date(session.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleResumeSession(session.sessionId)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Resume
                    </Button>
                    <Button
                      onClick={() => handleDownloadSession(session.sessionId)}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteSession(session.sessionId)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
