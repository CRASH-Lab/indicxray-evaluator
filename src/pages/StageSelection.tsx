import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { Stethoscope, Play } from 'lucide-react'
// import { BrainCircuit } from 'lucide-react'

function StageSelection() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)

  const handleLogout = () => {
      localStorage.removeItem('authToken')
      localStorage.removeItem('userId')
      localStorage.removeItem('userRole')
      navigate('/', { replace: true })
  }

  return (
    <div className="container mx-auto max-w-4xl py-20 relative">
      <div className="absolute top-4 right-4">
          <Button variant="ghost" className="text-white hover:text-white/80" onClick={handleLogout}>
              Logout
          </Button>
      </div>
      
      <h1 className="text-3xl font-bold text-center mb-10 text-white">Select Evaluation Stage</h1>
      
      <div className="grid grid-cols-1 gap-8">
        
        {/* Stage 1 Option */}
        <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-medical-dark-gray border-medical-gray" onClick={() => navigate(`/doctor/${userId}`)}>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-blue-500/10 p-4 rounded-full w-fit mb-4">
              <Stethoscope className="w-12 h-12 text-blue-400" />
            </div>
            <CardTitle className="text-2xl text-white">Stage 1: Clinical Diagnosis</CardTitle>
            <CardDescription>Evaluate X-ray images for clinical findings and write reports.</CardDescription>
          </CardHeader>
          <CardContent className="text-center pt-4 space-y-3">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">Enter Stage 1</Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={(e) => {
                e.stopPropagation()
                setIsTutorialOpen(true)
              }}
            >
              <Play className="w-4 h-4 mr-2" />
              Watch Tutorial
            </Button>
          </CardContent>
        </Card>

        {/* Stage 2 is temporarily hidden for evaluators. Keep this block for easy re-enable later. */}
        {/*
        <Card className="hover:border-primary/50 transition-colors cursor-pointer bg-medical-dark-gray border-medical-gray" onClick={() => navigate(`/stage2/${userId}`)}>
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
        */}
      </div>

      {/* Tutorial Modal - Placeholder for Video/GIF */}
      <Dialog open={isTutorialOpen} onOpenChange={setIsTutorialOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stage 1: Clinical Diagnosis Tutorial</DialogTitle>
          </DialogHeader>
          
          <div className="w-full bg-slate-900/50 rounded-lg p-12 flex flex-col items-center justify-center min-h-96 border-2 border-dashed border-slate-700">
            <Play className="w-16 h-16 text-blue-400 mb-4 opacity-50" />
            <p className="text-gray-400 text-center text-lg mb-2">Tutorial Video Placeholder</p>
            <p className="text-gray-500 text-sm text-center">
              Tutorial content will be displayed here.<br />
              This will be replaced with a video file or GIF from Supabase storage.
            </p>
          </div>

          <div className="mt-6 text-sm text-gray-400 bg-slate-800/50 rounded p-4">
            <p className="font-semibold text-white mb-2">Tutorial Topics:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>How to navigate X-ray images</li>
              <li>Identifying clinical findings</li>
              <li>Writing effective clinical reports</li>
              <li>Submitting your evaluation</li>
            </ul>
          </div>

          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setIsTutorialOpen(false)}
              className="flex-1"
            >
              Close
            </Button>
            <Button 
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setIsTutorialOpen(false)
                navigate(`/doctor/${userId}`)
              }}
            >
              Proceed to Stage 1
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default StageSelection
