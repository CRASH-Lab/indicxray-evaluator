import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Stethoscope, BrainCircuit } from 'lucide-react'

function StageSelection() {
  const { userId } = useParams()
  const navigate = useNavigate()

  const handleLogout = () => {
      localStorage.removeItem('authToken')
      localStorage.removeItem('userId')
      localStorage.removeItem('userRole')
      navigate('/')
  }

  return (
    <div className="container mx-auto max-w-4xl py-20 relative">
      <div className="absolute top-4 right-4">
          <Button variant="ghost" className="text-white hover:text-white/80" onClick={handleLogout}>
              Logout
          </Button>
      </div>
      
      <h1 className="text-3xl font-bold text-center mb-10 text-white">Select Evaluation Stage</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Stage 1 Option */}
        <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-medical-dark-gray border-medical-gray" onClick={() => navigate(`/doctor/${userId}`)}>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-blue-500/10 p-4 rounded-full w-fit mb-4">
              <Stethoscope className="w-12 h-12 text-blue-400" />
            </div>
            <CardTitle className="text-2xl text-white">Stage 1: Clinical Diagnosis</CardTitle>
            <CardDescription>Evaluate X-ray images for clinical findings and write reports.</CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-4">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">Enter Stage 1</Button>
          </CardContent>
        </Card>

        {/* Stage 2 Option */}
        <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-medical-dark-gray border-medical-gray" onClick={() => navigate(`/doctor/${userId}/gallery`)}>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-purple-500/10 p-4 rounded-full w-fit mb-4">
              <BrainCircuit className="w-12 h-12 text-purple-400" />
            </div>
            <CardTitle className="text-2xl text-white">Stage 2: AI Detection</CardTitle>
             <CardDescription>Rate the likelihood of images being AI-generated vs Real.</CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-4">
            <Button className="w-full bg-purple-600 hover:bg-purple-700">Enter Stage 2</Button>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

export default StageSelection
