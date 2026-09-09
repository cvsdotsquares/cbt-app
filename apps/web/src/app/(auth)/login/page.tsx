'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { normalizeRoles } from '@/lib/roles';
import { getSafeRedirectPath } from '@/lib/safe-redirect';
import { Logo } from '@/components/layout/logo';
import { BookOpen, BarChart3, GraduationCap, Sparkles, Eye } from 'lucide-react';

const features = [
  { icon: BookOpen, title: 'NCERT Books', desc: 'Upload Class 9–12 PDFs — chapters extracted automatically' },
  { icon: GraduationCap, title: 'Class & Batch Management', desc: 'Organize students by NCERT class and academic year' },
  { icon: Sparkles, title: 'AI Class Tests', desc: 'Chapter-wise questions from your uploaded syllabus' },
  { icon: BarChart3, title: 'Progress Tracking', desc: 'Syllabus completion and topic mastery per student' },
];

const stats = [
  { value: '9–12', label: 'NCERT Classes' },
  { value: '4', label: 'Core Subjects' },
  { value: 'AI', label: 'Syllabus-aligned Tests' },
];

export default function LoginPage() {
  const router = useRouter();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Wake Render free-tier API + DB while the user reads the login form
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(getSafeRedirectPath(params.get('redirect')));
    fetch('/api/v1/health/ready', { cache: 'no-store' }).catch(() => {});
  }, []);

  function readCredentials(form: HTMLFormElement) {
    const formData = new FormData(form);
    return {
      email: String(formData.get('email') ?? email).trim().toLowerCase(),
      password: String(formData.get('password') ?? password),
    };
  }

  async function loginWithCredentials(credentials: { email: string; password: string }) {
    setEmail(credentials.email);
    setPassword(credentials.password);
    setError('');
    setLoading(true);
    try {
      // Clear stale session in background — don't block login on cookie cleanup
      const store = useAuthStore.getState();
      if (store.isAuthenticated) {
        useAuthStore.setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
        import('@/lib/auth-session').then(({ clearAuthSession }) => clearAuthSession().catch(() => {}));
      }
      const result = await authApi.login(credentials) as {
        mfaRequired?: boolean;
        mfaToken?: string;
        accessToken?: string;
        refreshToken?: string;
        user?: { id: string; email: string; firstName: string; lastName: string; roles: string[]; tenantId: string; mfaEnabled: boolean };
      };
      if (result.mfaRequired && result.mfaToken) {
        sessionStorage.setItem('mfa-token', result.mfaToken);
        router.push('/mfa');
        return;
      }
      if (result.accessToken && result.refreshToken && result.user) {
        const roles = normalizeRoles(result.user.roles);
        const isAdminUser = await setAuth({ ...result.user, roles } as never, result.accessToken, result.refreshToken);
        const { getPortalHome } = await import('@/lib/roles');
        router.replace(redirectTo ?? (isAdminUser ? '/dashboard' : getPortalHome(roles)));
        return;
      }
      setError('Login failed. Please try again.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await loginWithCredentials(readCredentials(e.currentTarget));
  }

  async function fillDemo(role: 'teacher' | 'candidate') {
    const credentials =
      role === 'teacher'
        ? { email: 'teacher@example.com', password: 'Teacher@123' }
        : { email: 'candidate@example.com', password: 'Candidate@123' };
    await loginWithCredentials(credentials);
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[48%] overflow-hidden auth-gradient lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 grid-pattern opacity-[0.03]" />
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="relative p-12">
          <Logo variant="light" />
        </div>

        <div className="relative space-y-10 px-12">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur-sm">
              <Eye className="h-3.5 w-3.5" /> NCERT · Classes 9–12
            </p>
            <h1 className="text-[42px] font-bold leading-[1.15] tracking-tight text-white">
              Institute examinations<br />
              <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
                aligned to your syllabus
              </span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
              Upload NCERT books, track chapter progress by class and batch, and run AI-generated class tests from material your students have studied.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.07]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-semibold text-white">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/50">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-8 border-t border-white/10 pt-8">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative px-12 pb-10 text-xs text-white/30">© 2026 NCERT Institute Platform · Classes 9–12</p>
      </div>

      {/* Login form */}
      <div className="relative flex flex-1 items-center justify-center mesh-bg p-4 sm:p-6 md:p-10">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="relative w-full max-w-[420px] space-y-6 animate-fade-in-up sm:space-y-8">
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to your institute account</p>
          </div>

          <form onSubmit={handleSubmit} className="glass-panel space-y-5 p-5 sm:p-8">
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-semibold">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="teacher@institute.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-semibold">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          {process.env.NODE_ENV !== 'production' && (
          <div className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Demo Credentials</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" disabled={loading} onClick={() => fillDemo('teacher')}>
                Sign in as Teacher
              </Button>
              <Button type="button" variant="outline" disabled={loading} onClick={() => fillDemo('candidate')}>
                Sign in as Student
              </Button>
            </div>
            <p className="pt-3 text-center text-xs text-muted-foreground">
              Teacher: <span className="font-semibold text-foreground">teacher@example.com</span>
              {' / '}
              <span className="font-semibold text-foreground">Teacher@123</span>
              {' · '}
              Student: <span className="font-semibold text-foreground">Candidate@123</span>
            </p>
          </div>
          )}

          {(process.env.NEXT_PUBLIC_ALLOW_PUBLIC_REGISTRATION === 'true'
            || process.env.NODE_ENV !== 'production') && (
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">Create account</Link>
          </p>
          )}
        </div>
      </div>
    </div>
  );
}
