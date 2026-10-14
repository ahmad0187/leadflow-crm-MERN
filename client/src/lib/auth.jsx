import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api('/auth/me').then((d) => d.user).catch((e) => (e.status === 401 ? null : Promise.reject(e))),
    staleTime: Infinity,
  });
  const login = useMutation({
    mutationFn: (body) => api('/auth/login', { method: 'POST', body }),
    onSuccess: (d) => qc.setQueryData(['me'], d.user),
  });
  const register = useMutation({
    mutationFn: (body) => api('/auth/register', { method: 'POST', body }),
    onSuccess: (d) => qc.setQueryData(['me'], d.user),
  });
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    qc.clear();
    qc.setQueryData(['me'], null);
  };
  return <AuthContext.Provider value={{ user: me.data, loading: me.isLoading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
