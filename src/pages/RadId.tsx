import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

function RadId() {
  const [email, setEmail] = useState('') // Changed userId to email
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  // Check for token in URL (from test script) and auto-login
  useState(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
        localStorage.setItem('authToken', token);
        // We need to fetch user details to route correctly
        // Simple hack: route to doctor page, let it resolve user
        // But we store token first
    }

  });

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    
    setIsSubmitting(true)
    setError('')
    
    try {
      // Import login function dynamically or use window object if service exposes it, 
      // but better to import it at top. Assuming it is imported.
      // Need to update imports at top of file
      
      const { login, getUserDetails } = await import('@/services');
      
      const response = await login(email, password);
      
      if (response && response.access_token) {
          localStorage.setItem('authToken', response.access_token);
          localStorage.setItem('userId', response.user.id);
          localStorage.setItem('userRole', response.user.role || 'evaluator');
          
          if (response.user.role === 'supervisor') {
               navigate(`/supervisor/dashboard/${response.user.id}`);
          } else {
               // Navigate to stage selection screen instead of direct dashboard
               navigate(`/select-stage/${response.user.id}`);
          }
      } else {
          setError('Login failed. No token received.');
      }

    } catch (err) {
      console.error('Error logging in:', err)
      setError('Could not login. Please check your email and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full">
      <Card className="w-96">
        <CardHeader>
          <CardTitle className="text-center">Syn-CXR RISE Evaluation</CardTitle>
          <CardDescription className="text-center">Enter your email to access the system</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="doctor@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>

            <Button 
              type="submit"
              disabled={!email.trim() || !password.trim() || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default RadId
