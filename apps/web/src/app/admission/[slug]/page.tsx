'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Logo } from '@/components/layout/logo';
import { publicAdmissionApi } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { GraduationCap, CheckCircle2 } from 'lucide-react';

export default function PublicAdmissionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: schoolInfo } = useQuery({
    queryKey: ['admission-school', slug],
    queryFn: () => publicAdmissionApi.getSchoolInfo(slug),
    enabled: !!slug,
  });
  const [tab, setTab] = useState<'enquiry' | 'apply'>('enquiry');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleEnquiry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await publicAdmissionApi.submitEnquiry(slug, {
        studentName: fd.get('studentName') as string,
        parentName: fd.get('parentName') as string,
        phone: fd.get('phone') as string,
        email: (fd.get('email') as string) || '',
        classApplied: fd.get('classApplied') as string,
        notes: (fd.get('notes') as string) || '',
      });
      setSubmitted(true);
      toast({ title: 'Enquiry submitted', description: 'We will contact you shortly.' });
    } catch {
      toast({ title: 'Error', description: 'Could not submit enquiry.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await publicAdmissionApi.submitApplication(slug, {
        studentName: fd.get('studentName') as string,
        parentName: fd.get('parentName') as string,
        parentPhone: fd.get('parentPhone') as string,
        parentEmail: (fd.get('parentEmail') as string) || undefined,
        classApplied: fd.get('classApplied') as string,
        dateOfBirth: (fd.get('dateOfBirth') as string) || undefined,
        gender: (fd.get('gender') as string) || undefined,
        address: (fd.get('address') as string) || undefined,
        previousSchool: (fd.get('previousSchool') as string) || undefined,
      });
      setSubmitted(true);
      toast({ title: 'Application submitted', description: 'Your application is under review.' });
    } catch {
      toast({ title: 'Error', description: 'Could not submit application.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-dvh items-center justify-center mesh-bg p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4 pt-8">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="text-xl font-bold">Thank you!</h2>
            <p className="text-muted-foreground">Your submission has been received. The school will contact you soon.</p>
            <Button onClick={() => setSubmitted(false)}>Submit another</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh mesh-bg">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Logo />
          <div>
            <h1 className="font-semibold">{schoolInfo?.found ? schoolInfo.name : 'Online Admission'}</h1>
            <p className="text-sm text-muted-foreground">Apply for admission online</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <div className="flex gap-2">
          <Button variant={tab === 'enquiry' ? 'default' : 'outline'} onClick={() => setTab('enquiry')}>Quick Enquiry</Button>
          <Button variant={tab === 'apply' ? 'default' : 'outline'} onClick={() => setTab('apply')}>Full Application</Button>
        </div>

        {tab === 'enquiry' ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Admission Enquiry</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEnquiry} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Student Name</Label><Input name="studentName" required /></div>
                  <div><Label>Class Applying For</Label><Input name="classApplied" placeholder="e.g. Class 9" required /></div>
                  <div><Label>Parent Name</Label><Input name="parentName" required /></div>
                  <div><Label>Phone</Label><Input name="phone" type="tel" required /></div>
                  <div className="sm:col-span-2"><Label>Email</Label><Input name="email" type="email" /></div>
                  <div className="sm:col-span-2"><Label>Notes</Label><Textarea name="notes" /></div>
                </div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? 'Submitting...' : 'Submit Enquiry'}</Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Admission Application</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleApply} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label>Student Name</Label><Input name="studentName" required /></div>
                  <div><Label>Date of Birth</Label><Input name="dateOfBirth" type="date" /></div>
                  <div><Label>Gender</Label><Input name="gender" placeholder="Male / Female / Other" /></div>
                  <div><Label>Class Applying For</Label><Input name="classApplied" required /></div>
                  <div><Label>Previous School</Label><Input name="previousSchool" /></div>
                  <div><Label>Parent Name</Label><Input name="parentName" required /></div>
                  <div><Label>Parent Phone</Label><Input name="parentPhone" type="tel" required /></div>
                  <div><Label>Parent Email</Label><Input name="parentEmail" type="email" /></div>
                  <div className="sm:col-span-2"><Label>Address</Label><Textarea name="address" /></div>
                </div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? 'Submitting...' : 'Submit Application'}</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
