'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { EmptyState } from '@/components/layout/data-table';
import { curriculumApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { TableSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  BookOpen, ChevronDown, ChevronRight, Upload, Layers, GraduationCap,
  Library, Sparkles, Hash,
} from 'lucide-react';

type Topic = { id: string; title: string };
type Chapter = { id: string; number: number; title: string; topics: Topic[] };
type Book = { id: string; title: string; chapters: Chapter[] };
type Subject = { id: string; name: string; code: string; books: Book[] };
type AcademicClass = {
  id: string;
  level: number;
  name: string;
  subjects: Subject[];
};

const SUBJECT_ACCENTS: Record<string, string> = {
  MATH: 'from-blue-500/15 to-indigo-500/5 text-blue-600 border-blue-500/20',
  SCI: 'from-emerald-500/15 to-teal-500/5 text-emerald-600 border-emerald-500/20',
  SST: 'from-amber-500/15 to-orange-500/5 text-amber-700 border-amber-500/20',
  ENG: 'from-violet-500/15 to-purple-500/5 text-violet-600 border-violet-500/20',
  PHY: 'from-sky-500/15 to-cyan-500/5 text-sky-600 border-sky-500/20',
  CHEM: 'from-rose-500/15 to-pink-500/5 text-rose-600 border-rose-500/20',
  BIO: 'from-lime-500/15 to-green-500/5 text-lime-700 border-lime-500/20',
};

function subjectAccent(code: string) {
  return SUBJECT_ACCENTS[code] ?? 'from-primary/10 to-primary/5 text-primary border-primary/20';
}

function chapterCount(subject: Subject) {
  return subject.books.reduce((sum, b) => sum + b.chapters.length, 0);
}

function topicCount(subject: Subject) {
  return subject.books.reduce(
    (sum, b) => sum + b.chapters.reduce((n, ch) => n + ch.topics.length, 0),
    0,
  );
}

export default function SyllabusPage() {
  const { accessToken } = useRequireAuth(true);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const { data: classes, isLoading } = useQuery({
    queryKey: ['curriculum-from-uploads'],
    queryFn: () => curriculumApi.getClasses(accessToken!, { uploadedOnly: true }) as Promise<AcademicClass[]>,
    enabled: !!accessToken,
  });

  const sortedClasses = useMemo(
    () => [...(classes ?? [])].sort((a, b) => a.level - b.level),
    [classes],
  );

  const activeLevel = selectedLevel ?? sortedClasses[0]?.level ?? null;
  const activeClass = sortedClasses.find((c) => c.level === activeLevel) ?? null;

  const totals = useMemo(() => {
    const subjects = sortedClasses.reduce((n, c) => n + c.subjects.length, 0);
    const chapters = sortedClasses.reduce(
      (n, c) => n + c.subjects.reduce((s, sub) => s + chapterCount(sub), 0),
      0,
    );
    const topics = sortedClasses.reduce(
      (n, c) => n + c.subjects.reduce((s, sub) => s + topicCount(sub), 0),
      0,
    );
    return { classes: sortedClasses.length, subjects, chapters, topics };
  }, [sortedClasses]);

  function toggleSubject(id: string) {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleChapter(id: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAllSubjects() {
    if (!activeClass) return;
    setExpandedSubjects(new Set(activeClass.subjects.map((s) => s.id)));
  }

  function collapseAll() {
    setExpandedSubjects(new Set());
    setExpandedChapters(new Set());
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="NCERT Syllabus"
        highlight="Syllabus"
        description="Chapter tree extracted from your uploaded books. Mark studied chapters on Classes & Batches to scope AI class tests."
        badge="Classes 9–12"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/materials">
            <Upload className="mr-2 h-4 w-4" /> Upload books
          </Link>
        </Button>
        <Button size="sm" asChild>
          <Link href="/dashboard/batches">
            <GraduationCap className="mr-2 h-4 w-4" /> Mark progress
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard title="Classes covered" value={totals.classes} icon={GraduationCap} accent="blue" />
        <StatCard title="Subjects" value={totals.subjects} icon={Library} accent="violet" />
        <StatCard title="Chapters" value={totals.chapters} icon={BookOpen} accent="green" />
        <StatCard title="Topics" value={totals.topics} icon={Layers} accent="amber" />
      </div>

      {isLoading ? (
        <TableSkeleton rows={4} cols={1} />
      ) : sortedClasses.length === 0 ? (
        <Card className="surface-card">
          <EmptyState
            icon={BookOpen}
            title="No syllabus extracted yet"
            description="Upload NCERT Class 9–12 PDFs on NCERT Books. Chapters and topics are detected automatically from your files."
          />
          <div className="flex justify-center gap-3 pb-8">
            <Button asChild>
              <Link href="/dashboard/materials">
                <Upload className="mr-2 h-4 w-4" /> Upload NCERT books
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/ai-tests">
                <Sparkles className="mr-2 h-4 w-4" /> Create Class Test
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Class filter pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {sortedClasses.map((cls) => {
                const chapters = cls.subjects.reduce((n, s) => n + chapterCount(s), 0);
                const active = cls.level === activeLevel;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      setSelectedLevel(cls.level);
                      setExpandedSubjects(new Set());
                      setExpandedChapters(new Set());
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all',
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
                    )}
                  >
                    {cls.name}
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                      active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
                    )}>
                      {chapters}
                    </span>
                  </button>
                );
              })}
            </div>
            {activeClass && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={expandAllSubjects}>Expand all</Button>
                <Button variant="ghost" size="sm" onClick={collapseAll}>Collapse</Button>
              </div>
            )}
          </div>

          {activeClass && (
            <>
              <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-violet-500/[0.04]">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <GraduationCap className="h-7 w-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight">{activeClass.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {activeClass.subjects.length} subject{activeClass.subjects.length === 1 ? '' : 's'}
                        {' · '}
                        {activeClass.subjects.reduce((n, s) => n + chapterCount(s), 0)} chapters from uploads
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="normal-case tracking-normal">
                    NCERT · Upload-sourced
                  </Badge>
                </CardContent>
              </Card>

              <div className="columns-1 gap-4 space-y-4 md:columns-2">
                {activeClass.subjects.map((subject) => {
                  const chapters = subject.books.flatMap((b) => b.chapters);
                  const topics = topicCount(subject);
                  const open = expandedSubjects.has(subject.id);
                  const accent = subjectAccent(subject.code);

                  return (
                    <Card
                      key={subject.id}
                      className={cn(
                        'surface-card mb-4 break-inside-avoid overflow-hidden transition-shadow',
                        open && 'ring-1 ring-primary/20 shadow-md',
                      )}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => toggleSubject(subject.id)}
                      >
                        <CardHeader className="pb-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br',
                                accent,
                              )}>
                                <BookOpen className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="font-mono text-[10px]">{subject.code}</Badge>
                                  <CardTitle className="text-base">{subject.name}</CardTitle>
                                </div>
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                  {chapters.length} chapter{chapters.length === 1 ? '' : 's'}
                                  {topics > 0 ? ` · ${topics} topics` : ''}
                                </p>
                              </div>
                            </div>
                            {open ? (
                              <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                            )}
                          </div>
                        </CardHeader>
                      </button>

                      {open && (
                        <CardContent className="space-y-2 border-t border-border/60 pt-4">
                          {chapters.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                              No chapters extracted for this subject yet.
                            </p>
                          ) : (
                            chapters
                              .slice()
                              .sort((a, b) => a.number - b.number)
                              .map((ch) => {
                                const chOpen = expandedChapters.has(ch.id);
                                const hasTopics = ch.topics.length > 0;
                                return (
                                  <div
                                    key={ch.id}
                                    className="rounded-xl border border-border/50 bg-muted/20 transition-colors hover:bg-muted/40"
                                  >
                                    <button
                                      type="button"
                                      className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
                                      onClick={() => hasTopics && toggleChapter(ch.id)}
                                      disabled={!hasTopics}
                                    >
                                      <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-background px-1.5 font-mono text-[11px] font-bold text-primary shadow-sm">
                                        {ch.number}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold leading-snug">{ch.title}</p>
                                        {hasTopics && (
                                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <Hash className="h-3 w-3" />
                                            {ch.topics.length} topic{ch.topics.length === 1 ? '' : 's'}
                                          </p>
                                        )}
                                      </div>
                                      {hasTopics && (
                                        chOpen
                                          ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                          : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                      )}
                                    </button>

                                    {chOpen && hasTopics && (
                                      <ul className="space-y-1 border-t border-border/40 px-3.5 py-2.5">
                                        {ch.topics.map((t) => (
                                          <li
                                            key={t.id}
                                            className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground"
                                          >
                                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
                                            <span>{t.title}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                );
                              })
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>

              {activeClass.subjects.length === 0 && (
                <Card className="surface-card">
                  <EmptyState
                    icon={Library}
                    title={`No subjects for ${activeClass.name} yet`}
                    description="Upload books tagged to this class on NCERT Books."
                  />
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
