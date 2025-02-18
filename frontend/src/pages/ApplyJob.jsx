import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { applyJob, clearApplication } from '../store/applicationSlice'
import { viewJob } from '../store/jobSlice'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'

// Shadcn UI Components
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

const ApplyJob = () => {
  const { jobId } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { job } = useSelector((state) => state.job)
  const { loading, error, message } = useSelector((state) => state.application)

  // Clear application state on mount and route change
  useEffect(() => {
    dispatch(clearApplication())
    return () => {
      dispatch(clearApplication())
    }
  }, [dispatch, location.pathname])

  // Fetch job details if not already loaded or mismatched
  useEffect(() => {
    if (!job || job._id !== jobId) {
      dispatch(viewJob(jobId))
    }
  }, [dispatch, jobId, job])

  // Handle successful application redirect
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        navigate(`/jobs/${jobId}`)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [message, navigate, jobId])

  // Form data state
  const [formData, setFormData] = useState({
    experienceYears: '',
    experienceLevel: 'entry',
  })
  // Custom form errors state
  const [formErrors, setFormErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Clear previous errors
    let errors = {}

    if (!formData.experienceYears) {
      errors.experienceYears = 'Please provide your years of experience.'
    }
    if (!formData.experienceLevel) {
      errors.experienceLevel = 'Please select your experience level.'
    }

    // If errors exist, update state and halt submission
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    setFormErrors({})

    const applicationData = {
      experienceYears: Number(formData.experienceYears),
      experienceLevel: formData.experienceLevel,
    }
    dispatch(applyJob({ jobId, applicationData }))
    navigate('/candidate/applications')
  }

  return (
    <div className="container mx-auto p-4">
      <Link to={`/jobs/${jobId}`} className="text-blue-500 hover:underline">
        <Button variant="secondary" className="text-base cursor-pointer">
          &larr; Back to Job Details
        </Button>
      </Link>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">Apply for Job</CardTitle>
        </CardHeader>
        <CardContent>
          {job && (
            <div className="mb-4">
              <h3 className="text-3xl font-bold capitalize">{job.title}</h3>
              <p className="mt-2">{job.location}</p>
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-center">
              <p className="text-red-500">{error}</p>
              <Button asChild className="ml-5">
                <Link to="/candidate-profile-update">Update Profile</Link>
              </Button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="experienceYears" className="mb-1">
                Years of Experience:
              </Label>
              <Input
                type="number"
                name="experienceYears"
                id="experienceYears"
                value={formData.experienceYears}
                onChange={handleChange}
              />
              {formErrors.experienceYears && (
                <p className="text-red-500 text-sm mt-1">{formErrors.experienceYears}</p>
              )}
            </div>
            <div>
              <Label htmlFor="experienceLevel" className="mb-1">
                Experience Level:
              </Label>
              <Select
                value={formData.experienceLevel}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, experienceLevel: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select experience level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.experienceLevel && (
                <p className="text-red-500 text-sm mt-1">{formErrors.experienceLevel}</p>
              )}
            </div>
            <Button type="submit" disabled={loading} className="cursor-pointer">
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Applying...
                </>
              ) : (
                'Submit Application'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default ApplyJob
