import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4 text-center">
      <div className="w-20 h-20 bg-[#2d3748] rounded-full flex items-center justify-center mb-6">
        <span className="text-3xl font-bold text-gray-400">404</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
      <p className="text-gray-400 mb-8 max-w-xs mx-auto">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link 
        href="/" 
        className="flex items-center gap-2 bg-[#4CAF50] text-[#0D1117] px-6 py-3 rounded-xl font-bold shadow-[0_4px_14px_rgba(76,175,80,0.3)]"
      >
        <ArrowLeft className="w-5 h-5" /> Back to Home
      </Link>
    </div>
  );
}
