'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { batchesApi, learningApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { GraduationCap, TrendingDown, Users, BarChart3 } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/layout/stat-card';

export default function TeacherPage() {
  const { accessToken } = useRequireAuth(true);
  const [selectedBatch, setSelectedBatch] = useState<string>('');

  const { data: batches } = useQuery({
    queryKey: ['batches'],
    queryFn: () => batchesApi.list(accessToken!) as Promise<{ id: string; name: string; academicClass: { name: string } }[]>,
    enabled: !!accessToken,
  });

  const activeBatch = selectedBatch || batches?.[0]?.id;

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['teacher-analytics', activeBatch],
    queryFn: () => learningApi.teacherAnalytics(accessToken!, activeBatch!) as Promise<{
      batch: { name: string; class: string };
      studentCount: number;
      batchAverage: number;
      chapterPerformance: { topicId: string; topic: string; avgAccuracy: number; studentCount: number }[];
      weakTopics: { topic: string; avgAccuracy: number }[];
    }>,
    enabled: !!accessToken && !!activeBatch,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Hub"
        highlight="Hub"
        description="Monitor batch performance, identify weak topics, and track chapter-wise analytics"
        badge="NCERT · Classes 9–12"
      />

      <div className="flex flex-wrap gap-2">
        {(batches ?? []).map((b) => (
          <Badge
            key={b.id}
            variant={activeBatch === b.id ? 'default' : 'outline'}
            className="cursor-pointer px-4 py-2"
            onClick={() => setSelectedBatch(b.id)}
          >
            {b.name} ({b.academicClass.name})
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : analytics ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            <StatCard title="Students" value={analytics.studentCount} icon={Users} />
            <StatCard title="Batch Average" value={`${analytics.batchAverage.toFixed(1)}%`} icon={BarChart3} />
            <StatCard title="Weak Topics" value={analytics.weakTopics.length} icon={TrendingDown} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="h-5 w-5" />
                  Chapter-wise Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.chapterPerformance.map((ch) => (
                  <div key={ch.topicId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="truncate pr-2">{ch.topic}</span>
                      <span className={ch.avgAccuracy < 50 ? 'text-destructive font-medium' : 'text-emerald-600'}>
                        {ch.avgAccuracy.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          ch.avgAccuracy < 50 ? 'bg-destructive/70' : ch.avgAccuracy < 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(ch.avgAccuracy, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {!analytics.chapterPerformance.length && (
                  <p className="text-sm text-muted-foreground text-center py-4">No performance data yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <TrendingDown className="h-5 w-5" />
                  Weak Areas — Revision Needed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {analytics.weakTopics.map((w, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                    <span className="text-sm font-medium">{w.topic}</span>
                    <Badge variant="destructive">{w.avgAccuracy.toFixed(0)}% avg</Badge>
                  </div>
                ))}
                {!analytics.weakTopics.length && (
                  <p className="text-sm text-muted-foreground text-center py-4">No weak areas identified</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Create a batch and assign students to see analytics</CardContent></Card>
      )}
    </div>
  );
}
