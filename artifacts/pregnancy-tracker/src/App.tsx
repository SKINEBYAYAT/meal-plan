import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Link, useLocation } from 'wouter';
import { Home, Calendar, CheckSquare, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pages
import HomePage from '@/pages/home';
import MealsPage from '@/pages/meals';
import HabitsPage from '@/pages/habits';
import ProgressPage from '@/pages/progress';
import SettingsPage from '@/pages/settings';
import NotificationsDebugPage from '@/pages/notifications-debug';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

// ─── Bottom Navigation ────────────────────────────────────────────────────────

function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/meals', icon: Calendar, label: 'Meals' },
    { href: '/habits', icon: CheckSquare, label: 'Habits' },
    { href: '/progress', icon: BarChart3, label: 'Progress' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-[#161B22]/95 backdrop-blur-md border-t border-[#2d3748] z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-[49px] px-1">
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== '/' && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5"
            >
              <item.icon
                className={cn(
                  'w-[22px] h-[22px] transition-all duration-200',
                  isActive ? 'text-[#4CAF50]' : 'text-gray-400',
                )}
              />
              <span
                className={cn(
                  'text-[11px] font-medium transition-colors leading-none',
                  isActive ? 'text-[#4CAF50]' : 'text-gray-400',
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Global notification SW message handler ───────────────────────────────────

function NotificationMessageBridge() {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent<{ type: string; mealId?: string }>) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        // Navigate to meals page; MealsPage will read the mealId and open the sheet
        const mealId = event.data.mealId;
        navigate(mealId ? `/meals?highlight=${encodeURIComponent(mealId)}` : '/meals');
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [navigate]);

  return null;
}

// ─── Router ───────────────────────────────────────────────────────────────────

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0D1117]">
      <NotificationMessageBridge />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden safe-pt"
        style={{ paddingBottom: 'calc(49px + env(safe-area-inset-bottom, 0px))' }}
      >
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/meals" component={MealsPage} />
          <Route path="/habits" component={HabitsPage} />
          <Route path="/progress" component={ProgressPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/notifications-debug" component={NotificationsDebugPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNav />
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
