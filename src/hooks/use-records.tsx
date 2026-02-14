import { getAssignmentDetails } from '@/services'
import { Record } from '@/types'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/hooks/use-toast'

function useRecords(radId: string) {
  const [records, setRecords] = useState<Record[] | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const runOnceRef = useRef(false)
  const { toast } = useToast()

  useEffect(() => {
    if (runOnceRef.current || !radId) {
      return
    }

    runOnceRef.current = true

    
    ;(async () => {
      try {
        // Get doctorId from URL
        const urlParams = new URLSearchParams(window.location.search)
        const doctorId = urlParams.get('doctorId')

        if (!doctorId) {
          console.error('No doctorId found in URL')
          toast({
            title: "Error",
            description: "Missing doctor ID in URL",
            variant: "destructive",
          })
          return
        }

        // Fetch unified list if 'all' is passed
        const { getAllAssignedImages, getAssignmentDetails } = await import('@/services');

        try {
          let _records;
          if (radId === 'all') {
             _records = await getAllAssignedImages();
          } else {

              _records = await getAssignmentDetails(radId);
          }


          
          if (!_records.data || _records.data.length === 0) {
             // If 'all' returns empty, maybe no assignments?
             if (radId === 'all') {
                console.warn('No assigned images found.');
             } else {
                throw new Error('No records returned from API');
             }
          }

          // Check if we have all required data (if records exist)
          if (_records.data && _records.data.length > 0) {
              const record = _records.data[0]
              // Basic validation
              if (!record.imageUrl) console.warn('Record missing image URL');
          }

          setRecords(_records.data)
          return
        } catch (err) {
          console.error('Error fetching specific case:', err)
          throw err
        }
      } catch (err) {
        console.error('Error in records fetch:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to load case details",
          variant: "destructive",
        })
      }
    })()
  }, [radId, toast])

  return records
}

export default useRecords
