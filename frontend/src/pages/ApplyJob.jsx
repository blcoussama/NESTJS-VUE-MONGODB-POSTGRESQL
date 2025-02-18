import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { applyJob, clearApplication } from '../store/applicationSlice'
import { viewJob } from '../store/jobSlice'
import { useParams, useNavigate, Link } from 'react-router-dom'

// Shadcn UI Components
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

const ApplyJob = () => {
  const { jobId } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()

  // Get job details for context (if not already loaded)
  const { job } = useSelector((state) => state.job)
  useEffect(() => {
    if (!job || job._id !== jobId) {
      dispatch(viewJob(jobId))
    }
  }, [dispatch, jobId, job])

  const { loading, error, message } = useSelector((state) => state.application)

  const [formData, setFormData] = useState({
    experienceYears: '',
    experienceLevel: 'entry',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const applicationData = {
      experienceYears: Number(formData.experienceYears),
      experienceLevel: formData.experienceLevel,
    }
    dispatch(applyJob({ jobId, applicationData }))
  }

  useEffect(() => {
    if (message) {
      // After a successful application, navigate back to the job details (or to a confirmation page)
      navigate(`/jobs/${jobId}`)
      dispatch(clearApplication())
    }
  }, [message, navigate, jobId, dispatch])

  return (
    <div className="container mx-auto p-4">

      <Link to={`/jobs/${jobId}`} className="text-blue-500 hover:underline">
        <Button variant="secondary" className="text-lg cursor-pointer">
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
          {error && 
            <p className="text-red-500 mb-4">{error}
              <span className='ml-5 text-black dark:text-white'><Link to="/candidate-profile-update">Update Profile</Link>  </span>
              
            </p>
           }
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
                required
              />
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
