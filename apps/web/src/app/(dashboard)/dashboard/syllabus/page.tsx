'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { curriculumApi } from '@/lib/api';
import { useRequireAuth } from '@/hooks/use-auth';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { TableSkeleton } from '@/components/ui/skeleton';

type AcademicClass = {
  id: string;
  level: number;
  name: string;
  subjects: {
    id: string;
    name: string;
    code: string;
    books: {
      id: string;
      title: string;
      chapters: { id: string; number: number; title: string; topics: { id: string; title: string }[] }[];
    }[];
  }[];
};

export default function SyllabusPage() {
  const { accessToken } = useRequireAuth(true);
  const [expandedClass, setExpandedClass] = useState<number | null>(10);

  const { data: classes, isLoading } = useQuery({
    queryKey: ['curriculum-from-uploads'],
    queryFn: () => curriculumApi.getClasses(accessToken!, { uploadedOnly: true }) as Promise<AcademicClass[]>,
    enabled: !!accessToken,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Syllabus from uploads"
        description="Chapters extracted from your uploaded books — Class → Subject → Chapter"
      />

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : !(classes ?? []).length ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            No syllabus extracted yet. Upload books on Books &amp; Notes — chapters are detected from your PDFs.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {(classes ?? []).map((cls) => (
            <Card key={cls.id} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedClass(expandedClass === cls.level ? null : cls.level)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{cls.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{cls.subjects.length} subjects</p>
                    </div>
                  </div>
                  {expandedClass === cls.level ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              {expandedClass === cls.level && (
                <CardContent className="border-t pt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {cls.subjects.map((subject) => (
                      <div key={subject.id} className="rounded-xl border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant="outline">{subject.code}</Badge>
                          <h3 className="font-semibold">{subject.name}</h3>
                        </div>
                        <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
                          {subject.books.flatMap((book) =>
                            book.chapters.map((ch) => (
                              <div key={ch.id} className="rounded-lg px-2 py-1.5 hover:bg-muted/50">
                                <div className="flex items-start gap-2">
                                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                                    Ch.{ch.number}
                                  </span>
                                  <span className="font-medium">{ch.title}</span>
                                </div>
                              </div>
                            )),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
