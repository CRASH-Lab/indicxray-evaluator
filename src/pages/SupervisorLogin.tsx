import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function SupervisorLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    
    setIsSubmitting(true)
    setError('')

    try {
      const { login } = await import('@/services');
      const response = await login(email, password);
      
      if (response && response.access_token) {
        localStorage.setItem('authToken', response.access_token);
        localStorage.setItem('userId', response.user.id);
        localStorage.setItem('userRole', response.user.role);
        
        if (response.user.role === 'supervisor') {
          navigate(`/supervisor/dashboard/${response.user.id}`)
        } else {
          setError('Access denied: Supervisors only')
        }
      }
    } catch (err) {
      console.error(err)
      setError('Invalid credentials')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="text-center">Supervisor Portal</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="supervisor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <Button 
              type="submit"
              disabled={!email.trim() || !password.trim() || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>
            
            <div className="text-center">
              <Button 
                variant="link" 
                onClick={() => navigate('/')}
                className="text-xs"
              >
                Go to Doctor Login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default SupervisorLogin 