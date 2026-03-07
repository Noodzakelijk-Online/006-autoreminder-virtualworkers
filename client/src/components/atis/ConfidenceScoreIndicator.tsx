import React from 'react';
import { AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';

interface ConfidenceScoreIndicatorProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function ConfidenceScoreIndicator({
  score,
  size = 'md',
  showLabel = true,
}: ConfidenceScoreIndicatorProps) {
  const getColor = (value: number) => {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-blue-600';
    if (value >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBackgroundColor = (value: number) => {
    if (value >= 80) return 'bg-green-50';
    if (value >= 60) return 'bg-blue-50';
    if (value >= 40) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  const getLabel = (value: number) => {
    if (value >= 80) return 'Excellent';
    if (value >= 60) return 'Good';
    if (value >= 40) return 'Fair';
    return 'Low';
  };

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${sizeClasses[size]}`}>
        {/* Background circle */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-secondary"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`transition-all duration-500 ${getColor(score)}`}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${textSizeClasses[size]} ${getColor(score)}`}>
            {Math.round(score)}%
          </span>
        </div>
      </div>

      {showLabel && (
        <div className="text-center">
          <p className={`font-medium ${getColor(score)}`}>{getLabel(score)}</p>
          <p className="text-xs text-muted-foreground">Confidence</p>
        </div>
      )}
    </div>
  );
}
