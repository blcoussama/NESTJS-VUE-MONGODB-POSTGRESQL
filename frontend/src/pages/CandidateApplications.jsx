import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { 
  getCandidateApplications, 
  withdrawApplication, 
  clearCandidateApplications,
  clearApplicationMessages  // NEW action
} from '../store/applicationSlice'
import moment from 'moment'

// Shadcn UI Components
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import LoadingSpinner from '@/components/LoadingSpinner'

const CandidateApplications = () => {
  const dispatch = useDispatch()
  const { candidateApplications, loading, error, message } = useSelector((state) => state.application)
  
  // State for the dialog popup
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedApplicationId, setSelectedApplicationId] = useState(null)

  // Fetch candidate applications on mount
  useEffect(() => {
    dispatch(getCandidateApplications())
    return () => {
      dispatch(clearCandidateApplications())
    }
  }, [dispatch])

  // When a success or error message appears, re-fetch applications and clear the messages after 3 seconds.
  useEffect(() => {
    if (message || error) {
      dispatch(getCandidateApplications())
      const timer = setTimeout(() => {
        dispatch(clearApplicationMessages())
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [message, error, dispatch])

  // Opens the custom dialog for withdrawal
  const openWithdrawDialog = (applicationId) => {
    setSelectedApplicationId(applicationId)
    setDialogOpen(true)
  }

  const confirmWithdraw = async () => {
    if (!selectedApplicationId) return
    try {
      await dispatch(withdrawApplication(selectedApplicationId)).unwrap()
      dispatch(getCandidateApplications())
    } catch (err) {
      console.error('Error withdrawing application:', err)
    } finally {
      setDialogOpen(false)
      setSelectedApplicationId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">My Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {candidateApplications.length === 0 ? (
            <p>You have not applied for any jobs yet.</p>
          ) : (
            <div className="space-y-4">
              {candidateApplications.map((application) => (
                <Card key={application._id} className="shadow rounded">
                  <CardHeader>
                    <div className="flex justify-between items-center w-full">
                      <div>
                        <h3 className="text-xl font-bold capitalize mb-5">
                          {application.job?.title}
                        </h3>
                        <p>{application.job?.location}</p>
                        <p className="text-sm text-gray-400">
                          Applied {moment(application.createdAt).fromNow()}
                        </p>
                      </div>
                      <div>
                        <Badge
                          className="px-2 py-1 rounded text-base capitalize font-normal"
                          variant={
                            application.status === "accepted"
                              ? "accepted"
                              : application.status === "rejected"
                              ? "rejected"
                              : application.status === "withdrawn"
                              ? "withdrawn"
                              : "pending"
                          }
                        >
                          {application.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      <span className="font-medium text-base">Experience:</span>{' '}
                      {application.experienceYears} year
                      {application.experienceYears > 1 ? 's' : ''} ({application.experienceLevel})
                    </p>
                    <p className="text-sm">
                      <span className="font-medium text-base">Skills:</span>{' '}
                      {Array.isArray(application.skills)
                        ? application.skills.join(', ')
                        : application.skills}
                    </p>
                  </CardContent>
                  {application.status === 'pending' && (
                    <CardFooter className="flex justify-end">
                      <Button
                        variant="destructive"
                        onClick={() => openWithdrawDialog(application._id)}
                        className="cursor-pointer"
                      >
                        Withdraw
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shadcn UI Dialog for withdrawal confirmation */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Withdrawal</DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw your application?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmWithdraw} className="cursor-pointer">
              Withdraw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CandidateApplications
