import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Min 3 chars').max(30, 'Max 30 chars'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  password: z.string().min(8, 'At least 8 characters').max(128),
  confirmPassword: z.string()
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword']
});

type FormData = z.infer<typeof schema>;

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data: FormData) => {
    try {
      clearError();
      await registerUser({
        email: data.email,
        username: data.username,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName
      });
      toast.success('Account created. Please login.');
      navigate('/login');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-2xl">V</span>
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-foreground">Create your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">Sign in</Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">First name</label>
              <input {...register('firstName')} className="input w-full" placeholder="Jane" />
              {errors.firstName && <p className="mt-1 text-sm text-destructive">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Last name</label>
              <input {...register('lastName')} className="input w-full" placeholder="Doe" />
              {errors.lastName && <p className="mt-1 text-sm text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Username</label>
            <input {...register('username')} className="input w-full" placeholder="jane_doe" />
            {errors.username && <p className="mt-1 text-sm text-destructive">{errors.username.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email</label>
            <input {...register('email')} type="email" className="input w-full" placeholder="you@example.com" />
            {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Password</label>
            <div className="relative">
              <input {...register('password')} type={showPassword ? 'text' : 'password'} className="input w-full pr-10" placeholder="••••••••" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
            <div className="relative">
              <input {...register('confirmPassword')} type={showConfirm ? 'text' : 'password'} className="input w-full pr-10" placeholder="••••••••" />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">{error}</div>
          )}

          <button type="submit" disabled={isLoading} className="btn btn-primary w-full btn-lg">
            {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>) : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
