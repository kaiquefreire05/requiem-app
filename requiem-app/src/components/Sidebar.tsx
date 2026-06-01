import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  apiGetSessions,
  apiCreateSession,
  apiDeleteSession,
  apiRenameSession,
  type ChatSession,
} from '../lib/api';
import requiemLogo from '../assets/requiem-logo-full.svg';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  activeSessionId: string | null;
  onSessionChange: (session: ChatSession | null) => void;
  activeSession?: ChatSession | null;
}

export function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  activeSessionId,
  onSessionChange,
  activeSession,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const { sessions } = await apiGetSessions();
      setSessions(sessions);
    } catch {
      // ignore — backend might not be running
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Reload sessions list whenever activeSession changes to a new value
  // (e.g., auto-created from App.tsx after harmony generation)
  const prevActiveSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevActiveSessionIdRef.current;
    const currId = activeSession?.id ?? null;
    if (currId && currId !== prevId) {
      // A new session appeared — reload list so it shows up in sidebar
      loadSessions();
    }
    prevActiveSessionIdRef.current = currId;
  }, [activeSession?.id, loadSessions]);

  const handleNewSession = async () => {
    // Conta quantas sessões já começam com "Nova Composição" para evitar duplicatas
    const BASE = 'Nova Composição';
    const existingCount = sessions.filter(s => s.title === BASE || s.title.startsWith(`${BASE} (`)).length;
    const title = existingCount === 0 ? BASE : `${BASE} (${existingCount + 1})`;

    try {
      const { session } = await apiCreateSession(title);
      setSessions(prev => [session, ...prev]);
      onSessionChange(session);
    } catch {
      // If backend is down, create a local-only session
      const localSession: ChatSession = {
        id: Date.now().toString(),
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSessionChange(localSession);
    }
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiDeleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) onSessionChange(null);
    } catch {
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleStartRename = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setRenamingId(session.id);
    setRenameValue(session.title);
  };

  const handleCommitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== sessions.find(s => s.id === id)?.title) {
      try {
        await apiRenameSession(id, trimmed);
        setSessions(prev => prev.map(s => s.id === id ? { ...s, title: trimmed } : s));
      } catch {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, title: trimmed } : s));
      }
    }
    setRenamingId(null);
  };

  // Group sessions by date
  const groupedSessions = sessions.reduce<Record<string, ChatSession[]>>((acc, session) => {
    const date = new Date(session.updatedAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let group: string;
    if (date.toDateString() === today.toDateString()) {
      group = 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      group = 'Ontem';
    } else if (date >= sevenDaysAgo) {
      group = 'Últimos 7 dias';
    } else {
      group = 'Mais antigo';
    }

    if (!acc[group]) acc[group] = [];
    acc[group].push(session);
    return acc;
  }, {});

  const groupOrder = ['Hoje', 'Ontem', 'Últimos 7 dias', 'Mais antigo'];

  return (
    <aside
      className={`flex flex-col bg-black transition-all duration-300 ease-in-out relative z-20 border-r border-white/10 ${
        isSidebarOpen ? 'w-72' : 'w-[68px]'
      }`}
    >
      {/* Toggle + Logo */}
      <div className="flex items-center h-16 px-3 pt-2">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2.5 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
          aria-label="Alternar menu"
        >
          <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className={`ml-2 flex items-center overflow-hidden transition-opacity duration-300 ${
          isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
        }`}>
          <img src={requiemLogo} alt="Requiem Logo" className="h-7 w-auto drop-shadow-[0_0_8px_rgba(220,38,38,0.5)]" />
        </div>
      </div>

      {/* New Composition Button */}
      <div className="px-3 mt-8">
        <button
          onClick={handleNewSession}
          className={`flex items-center p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/5 ${
            isSidebarOpen ? 'w-full rounded-2xl' : 'w-11 justify-center'
          }`}
        >
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          <span className={`ml-3 text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${
            isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'
          }`}>
            Nova Composição
          </span>
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto mt-8 px-3 scrollbar-hide">
        {isSidebarOpen && (
          <>
            {isLoadingSessions ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-8 rounded-lg bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-white/25 text-center mt-4 px-2">
                Nenhuma composição ainda.<br />Clique em "Nova Composição" para começar.
              </p>
            ) : (
              groupOrder
                .filter(g => groupedSessions[g]?.length > 0)
                .map(group => (
                  <div key={group} className="mb-4">
                    <h3 className="text-[10px] font-semibold text-white/30 mb-2 ml-2 uppercase tracking-wider">
                      {group}
                    </h3>
                    <ul className="space-y-0.5">
                      {groupedSessions[group].map(session => (
                        <li key={session.id} className="group relative">
                          {renamingId === session.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={() => handleCommitRename(session.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleCommitRename(session.id);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              className="w-full px-3 py-2 text-sm text-white bg-white/10 border border-red-500/40 rounded-lg outline-none"
                            />
                          ) : (
                            <button
                              onClick={() => onSessionChange(session)}
                              onDoubleClick={e => handleStartRename(e, session)}
                              className={`flex items-center w-full px-3 py-2 rounded-lg text-left transition-colors group ${
                                activeSessionId === session.id
                                  ? 'bg-white/10 text-white'
                                  : 'text-white/60 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                              <span className="ml-2.5 text-sm truncate flex-1">{session.title}</span>

                              {/* Delete button (hover) */}
                              <button
                                onClick={e => handleDeleteSession(e, session.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-400 ml-1 flex-shrink-0"
                                title="Excluir"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
            )}
          </>
        )}

        {/* Collapsed: just icons */}
        {!isSidebarOpen && sessions.slice(0, 8).map(session => (
          <button
            key={session.id}
            onClick={() => onSessionChange(session)}
            title={session.title}
            className={`flex items-center justify-center w-full p-2.5 rounded-lg transition-colors mb-0.5 ${
              activeSessionId === session.id ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </button>
        ))}
      </div>

      {/* User Profile Footer */}
      <div className={`px-3 pb-4 mt-2 border-t border-white/5 pt-3 relative ${!isSidebarOpen ? 'flex justify-center' : ''}`}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className={`flex items-center gap-3 w-full rounded-xl p-2.5 hover:bg-white/5 transition-colors ${
            !isSidebarOpen ? 'justify-center w-11' : ''
          }`}
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm shadow-md">
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </div>

          {isSidebarOpen && (
            <div className="flex-1 text-left overflow-hidden">
              <div className="text-sm font-medium text-white/90 truncate">{user?.name}</div>
              <div className="text-xs text-white/35 truncate">{user?.email}</div>
            </div>
          )}
        </button>

        {/* User dropdown */}
        {showUserMenu && isSidebarOpen && (
          <div
            className="absolute bottom-16 left-3 right-3 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
            onClick={() => setShowUserMenu(false)}
          >
            <div className="p-3 border-b border-white/5">
              <div className="text-xs text-white/40">Conectado como</div>
              <div className="text-sm font-medium text-white mt-0.5">{user?.email}</div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sair
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
