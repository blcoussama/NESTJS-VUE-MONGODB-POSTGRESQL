import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams, useNavigate } from 'react-router-dom'
import { viewCompany, deleteCompany } from '../store/companySlice'
import { Clock, Globe, MapPin} from 'lucide-react'
import JobsByCompany from '../components/JobsByCompany'

// Shadcn UI Components
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import LoadingSpinner from '@/components/LoadingSpinner'
import moment from 'moment'

const CompanyDetails = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { id } = useParams()
  const { currentCompany, isLoading, error } = useSelector((state) => state.company)
  const { user } = useSelector((state) => state.auth)

  // Determine if the current user is the owner (logged-in recruiter who created the company)
  const isOwner = user?.role === 'recruiter' && currentCompany && user._id === currentCompany.userId

  // State for delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (id) {
      dispatch(viewCompany(id))
    }
  }, [id, dispatch])

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await dispatch(deleteCompany(id)).unwrap()
      // After deletion, navigate back to the previous page or companies list
      navigate(-1)
    } catch (err) {
      console.error('Error deleting company:', err)
    } finally {
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-120">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!currentCompany) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p>Company not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="rounded-xl shadow-lg overflow-hidden">
        {/* Header Section */}
        <div className="relative h-48 bg-gradient-to-r from-background to-muted">
          {currentCompany.logo && (
            <div className="absolute -bottom-16 left-6">
              <img
                src={currentCompany.logo}
                alt={`${currentCompany.name} logo`}
                className="w-40 h-32 rounded-sm border px-4 object-contain"
              />
            </div>
          )}
        </div>

        {/* Content Section */}
        <CardContent className={`p-6 ${currentCompany.logo ? 'pt-20' : 'pt-6'}`}>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-3xl font-semibold">
                {currentCompany.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-5 mb-4">
                <Clock className="h-6 w-6 text-gray-400" />
                <p className="text-sm text-gray-400">
                  Registered {moment(currentCompany.createdAt).fromNow()}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-4">
                {currentCompany.location && (
                  <div className="flex items-center gap-1 text-base">
                    <MapPin className="h-6 w-6" />
                    <span>{currentCompany.location}</span>
                  </div>
                )}
                {currentCompany.website && (
                  <div className="flex items-center gap-1">
                    <Globe className="h-6 w-6" />
                    <a
                      href={currentCompany.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-400 underline text-base"
                    >
                      {currentCompany.website}
                    </a>
                  </div>
                )}
              </div>
            </div>
            {/* Render action buttons only if the user is the owner */}
            {isOwner && (
              <div className="flex gap-3">
                <Button onClick={() => navigate(`/update-company/${currentCompany._id}`)} className="cursor-pointer">
                  Edit Company
                </Button>
                <Button variant="destructive" onClick={() => setShowDeleteModal(true)} className="cursor-pointer">
                  Delete Company
                </Button>
              </div>
            )}
          </div>

          {currentCompany.description && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-2">About</h2>
              <p className="">{currentCompany.description}</p>
            </div>
          )}

          {/* JobsByCompany component renders jobs associated with this company */}
          <JobsByCompany />
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal using Shadcn UI Dialog */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {currentCompany.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CompanyDetails
