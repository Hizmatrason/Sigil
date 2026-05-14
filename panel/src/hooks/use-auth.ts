import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface User {
  id: string
  email: string
  displayName: string | null
  isOperator: boolean
}

interface LoginRequest {
  email: string
  password: string
}

export function useAuth() {
  const queryClient = useQueryClient()

  const userQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const { data } = await api.get<User>('/panel/auth/me')
        return data
      } catch {
        return null
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  })

  const loginMutation = useMutation({
    mutationFn: async (req: LoginRequest) => {
      const { data } = await api.post<User>('/panel/auth/login', req)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await api.post('/panel/auth/logout')
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null)
      window.location.href = '/login'
    },
  })

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isAuthenticated: !!userQuery.data,
    isOperator: userQuery.data?.isOperator ?? false,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loginLoading: loginMutation.isPending,
  }
}
