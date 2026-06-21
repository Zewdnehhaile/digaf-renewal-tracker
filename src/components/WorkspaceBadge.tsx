// src/components/WorkspaceBadge.tsx
import React from 'react';

interface WorkspaceBadgeProps {
  workspace: string;
  className?: string;
}

export default function WorkspaceBadge({ workspace, className = '' }: WorkspaceBadgeProps) {
  const getBadgeConfig = (ws: string) => {
    const configs: Record<string, { label: string; bg: string; text: string; border: string }> = {
      first_round: {
        label: '1st Round',
        bg: 'bg-violet-50',
        text: 'text-violet-700',
        border: 'border-violet-200'
      },
      second_round: {
        label: '2nd Round',
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200'
      },
      both: {
        label: 'Both Rounds',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200'
      },
      attendance: {
        label: 'Attendance',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200'
      },
      chat: {
        label: 'Chat',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200'
      },
      attendance_chat: {
        label: 'Attendance & Chat',
        bg: 'bg-teal-50',
        text: 'text-teal-700',
        border: 'border-teal-200'
      }
    };

    return configs[ws] || configs.both;
  };

  const config = getBadgeConfig(workspace);

  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${config.bg} ${config.text} ${config.border} ${className}`}>
      {config.label}
    </span>
  );
}