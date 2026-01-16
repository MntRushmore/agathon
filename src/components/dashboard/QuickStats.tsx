'use client';

import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, FileText, Layout, LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  highlight?: boolean;
  iconColor?: string;
}

function StatCard({ icon: Icon, label, value, highlight = false, iconColor = 'text-blue-500' }: StatCardProps) {
  return (
    <Card className={`transition-all hover:shadow-md ${highlight ? 'ring-2 ring-orange-500' : ''}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-orange-600' : ''}`}>
              {value}
            </p>
          </div>
          <Icon className={`h-8 w-8 ${iconColor}`} />
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickStatsProps {
  enrolledClassCount: number;
  assignmentCount: number;
  overdueCount?: number;
  boardCount: number;
}

export function QuickStats({
  enrolledClassCount,
  assignmentCount,
  overdueCount = 0,
  boardCount,
}: QuickStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        icon={BookOpen}
        label="Classes"
        value={enrolledClassCount}
        iconColor="text-green-600"
      />
      <StatCard
        icon={FileText}
        label="Assignments"
        value={assignmentCount}
        highlight={overdueCount > 0}
        iconColor={overdueCount > 0 ? 'text-orange-600' : 'text-blue-600'}
      />
      <StatCard
        icon={Layout}
        label="Boards"
        value={boardCount}
        iconColor="text-purple-600"
      />
    </div>
  );
}
