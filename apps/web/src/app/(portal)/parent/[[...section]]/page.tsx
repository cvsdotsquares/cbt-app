'use client';

import { useParams } from 'next/navigation';
import { ParentPortalContent, type ParentSection } from '@/components/parent/parent-portal-content';

const VALID: ParentSection[] = ['overview', 'academics', 'fees', 'life'];

function parseSection(raw?: string[]): ParentSection {
  const s = raw?.[0];
  if (s && VALID.includes(s as ParentSection)) return s as ParentSection;
  return 'overview';
}

export default function ParentPortalPage() {
  const params = useParams();
  const section = parseSection(params.section as string[] | undefined);
  return <ParentPortalContent section={section} />;
}
