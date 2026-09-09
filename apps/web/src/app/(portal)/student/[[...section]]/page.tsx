'use client';

import { useParams } from 'next/navigation';
import { StudentPortalContent, type StudentSection } from '@/components/student/student-portal-content';

const VALID: StudentSection[] = ['home', 'school', 'exams', 'results', 'progress'];

function parseSection(raw?: string[]): StudentSection {
  const s = raw?.[0];
  if (s && VALID.includes(s as StudentSection)) return s as StudentSection;
  return 'home';
}

export default function StudentPortalPage() {
  const params = useParams();
  const section = parseSection(params.section as string[] | undefined);
  return <StudentPortalContent section={section} />;
}
