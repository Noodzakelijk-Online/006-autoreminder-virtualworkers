import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { useSettingsSyncStatus } from '@/hooks/useSettings';

export function SettingsSyncStatus() {
  const { syncLog, lastSyncTime, isLoading, refetch } = useSettingsSyncStatus();
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [lastSyncDisplay, setLastSyncDisplay] = useState<string>('Never');
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    if (lastSyncTime) {
      const now = new Date();
      const diff = now.getTime() - lastSyncTime.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) {
        setLastSyncDisplay('Just now');
      } else if (minutes < 60) {
        setLastSyncDisplay(`${minutes}m ago`);
      } else if (hours < 24) {
        setLastSyncDisplay(`${hours}h ago`);
      } else {
        setLastSyncDisplay(`${days}d ago`);
      }
    } else {
      setLastSyncDisplay('Never');
    }
  }, [lastSyncTime]);

  const handleManualSync = async () => {
    try {
      setIsSyncingLocal(true);
      await refetch();
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncingLocal(false);
    }
  };

  // Check connection status
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(navigator.onLine);
    };

    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    checkConnection();

    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, []);

  return (
    <Card className="border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    Connected
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    Offline
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Last sync: <span className="font-medium">{lastSyncDisplay}</span>
            </p>
            {syncLog && syncLog.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Total syncs: <span className="font-medium">{syncLog.length}</span>
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncingLocal || isLoading || !isConnected}
          >
            {isSyncingLocal || isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
