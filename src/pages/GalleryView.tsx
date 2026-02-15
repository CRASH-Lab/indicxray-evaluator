import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { getStage2Images, saveStage2Evaluation, getUserDetails } from '@/services'
import { Loader2, CheckCircle, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Stage2Image {
    id: string
    image_url: string
    source: string
    score: number | null
}

function GalleryView() {
  const { doctorId } = useParams()
  const navigate = useNavigate()
  const [images, setImages] = useState<Stage2Image[]>([])
  const [loading, setLoading] = useState(true)
  const [doctorName, setDoctorName] = useState('')
  const [stats, setStats] = useState({ total: 0, completed: 0 })
  
  // Modal state
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const [userData, imagesData] = await Promise.all([
             getUserDetails(doctorId),
             getStage2Images()
        ])
        
        setDoctorName(userData.name)
        setImages(imagesData.images || [])
        setStats({
            total: imagesData.total_count || 0,
            completed: imagesData.completed_count || 0
        })
      } catch (error) {
        toast.error("Failed to load data")
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    
    if (doctorId) {
        fetchData()
    }
  }, [doctorId])

  const handleScore = async (index: number, score: number) => {
      if (index < 0 || index >= images.length) return
      
      const image = images[index]
      const oldImages = [...images]
      
      // Optimistic update
      const newImages = [...images]
      newImages[index] = { ...image, score }
      setImages(newImages)
      
      // Update stats if this was previously unscored
      const wasUnscored = image.score === null
      if (wasUnscored) {
          setStats(prev => ({ ...prev, completed: prev.completed + 1 }))
      }

      try {
          await saveStage2Evaluation(image.id, score)
      } catch (error) {
          toast.error("Failed to save score")
          // Revert
          setImages(oldImages)
          if (wasUnscored) {
             setStats(prev => ({ ...prev, completed: prev.completed - 1 }))
          }
      }
  }

  const handleNext = useCallback(() => {
      if (selectedIndex !== null && selectedIndex < images.length - 1) {
          setSelectedIndex(selectedIndex + 1)
      }
  }, [selectedIndex, images.length])

  const handlePrev = useCallback(() => {
      if (selectedIndex !== null && selectedIndex > 0) {
          setSelectedIndex(selectedIndex - 1)
      }
  }, [selectedIndex])

  // Keyboard navigation
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (!isModalOpen) return
          
          if (e.key === 'ArrowRight') handleNext()
          if (e.key === 'ArrowLeft') handlePrev()
          
          // Number keys for scoring
          if (selectedIndex !== null) {
              if (e.key === '0') handleScore(selectedIndex, 0)
              if (e.key === '1') handleScore(selectedIndex, 1)
              if (e.key === '2') handleScore(selectedIndex, 2)
          }
      }
      
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen, selectedIndex, handleNext, handlePrev, images]) // Added handleScore deps via images/closure? Actually handleScore is stable enough or needs ref in closure. 
  // Better to pass current index to handleScore inside effect or use ref, but for now simple reliancy on state is fine as long as dependencies match. We re-bind on index change.

  // Swipe handlers
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  
  // Minimum swipe distance (in px) 
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null) // Reset touch end
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe) {
      handleNext()
    }
    
    if (isRightSwipe) {
      handlePrev()
    }
  }

  if (loading) {
      return (
          <div className="flex h-screen items-center justify-center bg-medical-darkest-gray text-white">
              <Loader2 className="w-8 h-8 animate-spin mr-2" />
              Loading gallery...
          </div>
      )
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 bg-medical-dark-gray p-4 rounded-lg border border-medical-gray sticker top-0 z-10 backdrop-blur-md bg-opacity-90">
        <div>
            <h1 className="text-2xl font-bold text-white">Stage 2: AI Detection</h1>
            <p className="text-gray-400">Evaluator: {doctorName}</p>
        </div>
        <div className="flex items-center gap-4">
             <div className="text-lg font-medium text-white bg-black/30 px-4 py-2 rounded-full border border-gray-700">
                 Progress: <span className={stats.completed === stats.total ? "text-green-400" : "text-blue-400"}>{stats.completed}</span> / {stats.total}
             </div>
             <Button variant="outline" onClick={() => navigate(`/select-stage/${doctorId}`)}>
                 Exit
             </Button>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {images.map((image, index) => (
            <div key={image.id} onClick={() => { setSelectedIndex(index); setIsModalOpen(true); }}>
                <Card className={cn(
                    "overflow-hidden border-2 transition-all cursor-pointer bg-black hover:ring-2 hover:ring-primary h-full relative group",
                    image.score !== null ? "border-green-500/70" : "border-gray-800 hover:border-gray-600"
                )}>
                    <div className="relative aspect-square bg-gray-900">
                        <img 
                            src={image.image_url} 
                            alt={`X-ray ${index + 1}`} 
                            className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity"
                            loading="lazy"
                        />
                        
                        {/* Status Validations Overlay */}
                        {image.score !== null && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg z-10">
                                <CheckCircle className="w-4 h-4" />
                            </div>
                        )}
                        
                        {/* Score Badge */}
                        {image.score !== null && (
                            <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs border border-gray-700 font-mono">
                                Score: {image.score}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        ))}
      </div>

      {/* Image Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col p-0 bg-medical-darkest-gray border-medical-gray text-white" aria-description="Image Detail View">
             {/* Accessibility fix: Added aria-description or ensure description exists if required by Dialog content */}
             <DialogDescription className="sr-only">Detail view of image for AI likelihood evaluation</DialogDescription>
             
            {selectedIndex !== null && images[selectedIndex] && (
                <div className="flex flex-col h-full">
                    {/* Modal Header / Toolbar */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-medical-dark-gray">
                        <div>
                            <h2 className="text-lg font-bold">Image {selectedIndex + 1} of {images.length}</h2>
                            <p className="text-xs text-gray-400">ID: {images[selectedIndex].id.split('-')[0]}...</p>
                        </div>
                        {/* Native Dialog close button handles closing */}
                    </div>

                    {/* Main Content Area - Swipe Handlers Attached Here */}
                    <div 
                        className="flex-1 flex overflow-hidden relative group/main"
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    >
                        {/* Navigation - Left (Desktop) */}
                        <div className="hidden md:flex w-16 items-center justify-center bg-black/20 hover:bg-black/40 transition-colors z-10">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-full w-full rounded-none disabled:opacity-30" 
                                onClick={handlePrev}
                                disabled={selectedIndex === 0}
                            >
                                <ChevronLeft className="w-8 h-8" />
                            </Button>
                        </div>

                        {/* Image */}
                        <div className="flex-1 flex items-center justify-center bg-black relative p-4">
                            <img 
                                src={images[selectedIndex].image_url} 
                                alt="Detail View" 
                                className="max-w-full max-h-full object-contain pointer-events-none select-none" // prevent img drag interfering with swipe
                            />
                            
                            {/* Mobile Navigation Overlays */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-0"
                                onClick={handlePrev}
                                disabled={selectedIndex === 0}
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </Button>
                            
                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full hover:bg-black/70 disabled:opacity-0"
                                onClick={handleNext}
                                disabled={selectedIndex === images.length - 1}
                            >
                                <ChevronRight className="w-6 h-6" />
                            </Button>
                        </div>

                        {/* Navigation - Right (Desktop) */}
                        <div className="hidden md:flex w-16 items-center justify-center bg-black/20 hover:bg-black/40 transition-colors z-10">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-full w-full rounded-none disabled:opacity-30" 
                                onClick={handleNext}
                                disabled={selectedIndex === images.length - 1}
                            >
                                <ChevronRight className="w-8 h-8" />
                            </Button>
                        </div>
                    </div>

                    {/* Footer / Controls */}
                    <div className="p-4 md:p-6 border-t border-gray-800 bg-medical-dark-gray">
                        <div className="flex flex-col items-center gap-3 md:gap-4">
                            <p className="text-sm font-medium text-gray-300 text-center">
                                How likely is this image to be AI-generated? (0 = Real, 2 = AI)
                            </p>
                            
                            <div className="grid grid-cols-3 gap-2 md:gap-4 w-full max-w-md">
                                <Button 
                                    size="lg"
                                    className={cn(
                                        "flex flex-col h-auto py-2 md:py-3 gap-0.5 md:gap-1",
                                        images[selectedIndex].score === 0 
                                            ? "bg-blue-600 hover:bg-blue-700 ring-2 ring-white" 
                                            : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                                    )}
                                    onClick={() => handleScore(selectedIndex, 0)}
                                >
                                    <span className="text-lg md:text-xl font-bold">0</span>
                                    <span className="text-[10px] md:text-xs opacity-80 uppercase tracking-wider">Likely Real</span>
                                </Button>
                                
                                <Button 
                                    size="lg"
                                    className={cn(
                                        "flex flex-col h-auto py-2 md:py-3 gap-0.5 md:gap-1",
                                        images[selectedIndex].score === 1 
                                            ? "bg-yellow-600 hover:bg-yellow-700 ring-2 ring-white" 
                                            : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                                    )}
                                    onClick={() => handleScore(selectedIndex, 1)}
                                >
                                    <span className="text-lg md:text-xl font-bold">1</span>
                                    <span className="text-[10px] md:text-xs opacity-80 uppercase tracking-wider">Uncertain</span>
                                </Button>
                                
                                <Button 
                                    size="lg"
                                    className={cn(
                                        "flex flex-col h-auto py-2 md:py-3 gap-0.5 md:gap-1",
                                        images[selectedIndex].score === 2 
                                            ? "bg-red-600 hover:bg-red-700 ring-2 ring-white" 
                                            : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                                    )}
                                    onClick={() => handleScore(selectedIndex, 2)}
                                >
                                    <span className="text-lg md:text-xl font-bold">2</span>
                                    <span className="text-[10px] md:text-xs opacity-80 uppercase tracking-wider">Likely AI</span>
                                </Button>
                            </div>
                            
                            <p className="hidden md:block text-xs text-gray-500 mt-2">
                                Tip: Use Arrow keys to navigate, and number keys (0, 1, 2) to score quickly.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default GalleryView
