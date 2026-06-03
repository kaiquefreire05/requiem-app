import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import requiemLogo from '../assets/requiem-logo-full.svg';
import { Starfield } from './Starfield';

type AuthMode = 'login' | 'register';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login');
    setError(null);
    setEmail('');
    setName('');
    setPassword('');
  };

  return (
    <div className="relative min-h-screen w-full bg-black flex items-center justify-center overflow-hidden">
      {/* Animated starfield background */}
      <Starfield animated={true} numStars={250} />

      {/* Radial gradient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/5 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-white/5 blur-[80px]" />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src={requiemLogo}
            alt="Requiem"
            className="h-10 w-auto drop-shadow-[0_0_20px_rgba(220,38,38,0.6)]"
          />
        </div>

        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(15, 15, 18, 0.85)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05) inset',
          }}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                {mode === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
              </h1>
              <p className="text-sm text-white/40 mt-1">
                {mode === 'login'
                  ? 'Entre para continuar compondo'
                  : 'Comece a criar harmonia hoje'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                    Nome
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome"
                    required
                    className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                    onFocus={e => {
                      e.target.style.border = '1px solid rgba(255,255,255,0.3)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.05)';
                    }}
                    onBlur={e => {
                      e.target.style.border = '1px solid rgba(255,255,255,0.08)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.3)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.05)';
                  }}
                  onBlur={e => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.08)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                  Senha
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.3)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(255,255,255,0.05)';
                  }}
                  onBlur={e => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.08)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-fade-in">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit button */}
              <button
                id="auth-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-bold text-sm text-black bg-white hover:bg-gray-100 transition-all duration-200 relative overflow-hidden mt-2"
                style={{
                  boxShadow: isLoading ? 'none' : '0 4px 20px rgba(255,255,255,0.2)',
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {mode === 'login' ? 'Entrando...' : 'Criando conta...'}
                  </span>
                ) : (
                  mode === 'login' ? 'Entrar' : 'Criar conta'
                )}
              </button>
            </form>

            {/* Switch mode */}
            <div className="mt-6 text-center">
              <span className="text-white/30 text-sm">
                {mode === 'login' ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              </span>{' '}
              <button
                onClick={switchMode}
                className="text-white/70 hover:text-white text-sm font-medium transition-colors"
              >
                {mode === 'login' ? 'Criar conta' : 'Entrar'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] font-mono tracking-[0.2em] text-white/20 mt-6">
          © {new Date().getFullYear()} REQUIEM LABS · HARMONY ENGINE v1.0
        </p>
      </div>
    </div>
  );
}
