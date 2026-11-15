import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { MascotBunny } from '../components/common/MascotBunny';
import { Home, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-dream-bg dark:bg-[#130E26] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-6">
        <MascotBunny mood="confused" size={140} className="mx-auto animate-bounce-subtle" />

        <div className="space-y-2">
          <span className="text-4xl font-extrabold font-heading text-primary">
            404
          </span>
          <h2 className="text-2xl font-bold font-heading text-deep-purple dark:text-white">
            Oops! You've Wandered Off the Study Trail
          </h2>
          <p className="text-xs text-muted-purple max-w-sm mx-auto leading-relaxed">
            The page or resource you are looking for has been relocated or doesn't exist. Bramble is just as surprised as you are! 🐰
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Link to="/dashboard">
            <Button size="md" pill>
              <Home className="w-4 h-4 mr-1.5" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
          <Link to="/tasks">
            <Button variant="outline" size="md" pill>
              <span>View Tasks</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
