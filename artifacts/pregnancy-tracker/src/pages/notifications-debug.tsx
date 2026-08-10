import { useState, useEffect, useCallback } from 'react';
import { Bell, RefreshCw, Send, Trash2, RotateCcw, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useMeals } from '../hooks/useMeals';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { DayOfWeek, NotificationDebugInfo } from '../types';

const TODAY_DOW: DayOfWeek = (
  ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as DayOfWeek[]
)[new Date().getDay()];

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium',
      ok ? 'bg-[#4CAF50]/10 text-[#4CAF50] border border-[#4CAF50]/20'
         : 'bg-red-500/10 text-red-400 border border-red-500/20',
    )}>
      {ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
      {label}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#2d3748] last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm text-white font-medium text-right max-w-[60%] break-words">{value}</span>
    </div>
  );
}

export default function NotificationsDebugPage() {
  const { dayPlan } = useMeals(TODAY_DOW);
  const {
    permission,
    swStatus,
    isSupported,
    requestPermission,
    scheduleAll,
    cancelAll,
    sendTestNotification,
    getDebugInfo,
  } = useNotifications();

  const { toast } = useToast();
  const [info, setInfo] = useState<NotificationDebugInfo | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setInfo(getDebugInfo());
  }, [getDebugInfo]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleRequestPermission = async () => {
    setLoading('permission');
    const granted = await requestPermission();
    setLoading(null);
    if (granted) {
      toast({ title: 'Permission granted ✅', description: 'Notifications are enabled.' });
      refresh();
    } else {
      toast({
        title: 'Permission denied',
        description: 'Open iOS Settings → Safari → Notifications to enable manually.',
        variant: 'destructive',
      });
    }
  };

  const handleTest = async () => {
    if (permission !== 'granted') {
      toast({ title: 'Permission required', description: 'Enable notifications first.', variant: 'destructive' });
      return;
    }
    setLoading('test');
    await sendTestNotification();
    setLoading(null);
    toast({ title: 'Test notification sent 🔔', description: 'Check your notification tray.' });
    setTimeout(refresh, 500);
  };

  const handleReschedule = () => {
    if (permission !== 'granted') {
      toast({ title: 'Permission required', description: 'Enable notifications first.', variant: 'destructive' });
      return;
    }
    scheduleAll(dayPlan.meals, TODAY_DOW);
    toast({ title: 'Rescheduled ✅', description: `Scheduled reminders for today's meals.` });
    setTimeout(refresh, 200);
  };

  const handleClearAll = () => {
    cancelAll();
    toast({ title: 'Cleared', description: 'All scheduled reminders cancelled.' });
    setTimeout(refresh, 200);
  };

  const fmtTs = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const fmtIso = (iso: string) =>
    new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0D1117]/95 backdrop-blur-sm border-b border-[#2d3748] px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#4CAF50]" /> Notifications
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Debug & status</p>
        </div>
        <button
          onClick={refresh}
          className="w-10 h-10 bg-[#2d3748] rounded-full flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      <div className="p-4 space-y-6 flex-1 overflow-y-auto">

        {/* Status cards */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">System Status</h2>
          <div className="flex flex-col gap-2">
            <StatusBadge ok={isSupported} label={isSupported ? 'Notifications API supported' : 'Not supported in this browser'} />
            <StatusBadge ok={permission === 'granted'} label={`Permission: ${permission}`} />
            <StatusBadge ok={swStatus === 'registered'} label={`Service Worker: ${swStatus}`} />
          </div>

          {permission === 'denied' && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                Notifications are blocked. On iPhone: <strong>Settings → [Your Browser] → Notifications</strong> → enable for this site. Then re-open the app.
              </p>
            </div>
          )}
        </section>

        {/* Metrics */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Scheduler Metrics</h2>
          <div className="bg-[#161B22] border border-[#2d3748] rounded-2xl overflow-hidden">
            <InfoRow
              label="Scheduled reminders"
              value={info ? String(info.scheduledCount) : '…'}
            />
            <InfoRow
              label="Upcoming reminder"
              value={
                info?.upcoming
                  ? `${info.upcoming.mealName} (${info.upcoming.type}) @ ${fmtTs(info.upcoming.timestamp)}`
                  : 'None'
              }
            />
            <InfoRow
              label="Last notification"
              value={
                info?.lastNotification
                  ? `${info.lastNotification.title} — ${fmtIso(info.lastNotification.firedAt)}`
                  : 'None yet'
              }
            />
            <InfoRow
              label="Today's meals"
              value={`${dayPlan.meals.length} total, ${dayPlan.meals.filter(m => m.reminderEnabled).length} with reminders`}
            />
          </div>
        </section>

        {/* Upcoming reminders list */}
        {info && info.scheduledCount > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Scheduled Today ({info.scheduledCount})
            </h2>
            <div className="space-y-2">
              {Object.values(
                (getDebugInfo() as NotificationDebugInfo & { upcoming: typeof info.upcoming })
              )
                .filter(Boolean)
                .slice(0, 1)
                .map(() =>
                  info.upcoming ? (
                    <div key="upcoming" className="bg-[#161B22] border border-[#2d3748] rounded-xl p-3 flex items-center gap-3">
                      <Clock className="w-4 h-4 text-[#4CAF50] flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-white">{info.upcoming.mealName}</p>
                        <p className="text-xs text-gray-400">
                          {info.upcoming.type === 'before' ? '15 min warning' :
                           info.upcoming.type === 'exact' ? 'Meal time' : '30 min follow-up'}
                          {' · '}
                          {fmtTs(info.upcoming.timestamp)}
                        </p>
                      </div>
                    </div>
                  ) : null,
                )}
            </div>
          </section>
        )}

        {/* Errors */}
        {info && info.errors.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Recent Errors ({info.errors.length})
            </h2>
            <div className="space-y-2">
              {info.errors.slice(0, 5).map((err, i) => (
                <div key={i} className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-xs text-red-300 font-mono break-words">{err.message}</p>
                  <p className="text-xs text-red-400/60 mt-1">{fmtIso(err.at)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action buttons */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleTest}
              disabled={loading === 'test'}
              className="flex flex-col items-center gap-2 p-4 bg-[#161B22] border border-[#2d3748] rounded-2xl hover:border-[#4CAF50]/40 transition-colors disabled:opacity-50"
            >
              <Send className="w-5 h-5 text-[#4CAF50]" />
              <span className="text-xs text-gray-300 text-center">Send Test Notification</span>
            </button>

            <button
              onClick={handleReschedule}
              className="flex flex-col items-center gap-2 p-4 bg-[#161B22] border border-[#2d3748] rounded-2xl hover:border-[#4CAF50]/40 transition-colors"
            >
              <RotateCcw className="w-5 h-5 text-blue-400" />
              <span className="text-xs text-gray-300 text-center">Reschedule All</span>
            </button>

            <button
              onClick={handleClearAll}
              className="flex flex-col items-center gap-2 p-4 bg-[#161B22] border border-[#2d3748] rounded-2xl hover:border-red-500/40 transition-colors"
            >
              <Trash2 className="w-5 h-5 text-red-400" />
              <span className="text-xs text-gray-300 text-center">Clear All Reminders</span>
            </button>

            <button
              onClick={refresh}
              className="flex flex-col items-center gap-2 p-4 bg-[#161B22] border border-[#2d3748] rounded-2xl hover:border-[#4CAF50]/40 transition-colors"
            >
              <RefreshCw className="w-5 h-5 text-gray-400" />
              <span className="text-xs text-gray-300 text-center">Refresh Status</span>
            </button>
          </div>
        </section>

        {/* Request permission button */}
        {permission !== 'granted' && (
          <section>
            <button
              onClick={handleRequestPermission}
              disabled={loading === 'permission' || permission === 'denied'}
              className={cn(
                'w-full py-4 rounded-2xl font-bold text-base transition-all',
                permission === 'denied'
                  ? 'bg-[#2d3748] text-gray-500 cursor-not-allowed'
                  : 'bg-[#4CAF50] text-[#0D1117] shadow-[0_4px_14px_rgba(76,175,80,0.3)]',
              )}
            >
              {permission === 'denied' ? 'Permission Denied (see above)' : 'Enable Notifications'}
            </button>
          </section>
        )}

        {/* iPhone tip */}
        <section className="pb-2">
          <div className="bg-[#161B22] border border-[#2d3748] rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">📱 iPhone Tip</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Notifications only work when the app is installed via <strong className="text-gray-200">Share → Add to Home Screen</strong> and iOS 16.4 or later is used. In Safari, notifications work only for installed PWAs.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
