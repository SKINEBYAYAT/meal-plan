import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter, Link, useLocation } from 'wouter';
import { Home, Calendar, CheckSquare, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pages (to be implemented)
import HomePage from '@/pages/home';
import MealsPage from '@/pages/meals';
import HabitsPage from '@/pages/habits';
import ProgressPage from '@/pages/progress';
import SettingsPage from '@/pages/settings';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

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
    <nav className="fixed bottom-0 left-0 right-0 bg-[#161B22]/95 backdrop-blur-md border-t border-[#2d3748] z-50 safe-pb">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center w-16 h-full gap-1 tap-highlight-transparent">
              <item.icon 
                className={cn(
                  "w-6 h-6 transition-all duration-200", 
                  isActive ? "text-[#4CAF50] scale-110" : "text-gray-400"
                )} 
              />
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                isActive ? "text-[#4CAF50]" : "text-gray-400"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0D1117]">
      <main className="flex-1 pb-20 overflow-y-auto overflow-x-hidden safe-pt">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/meals" component={MealsPage} />
          <Route path="/habits" component={HabitsPage} />
          <Route path="/progress" component={ProgressPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNav />
    </div>
  );
}

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
