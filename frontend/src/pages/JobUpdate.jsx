import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { viewJob, updateJob, clearError, clearMessage } from '../store/jobSlice'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

// Shadcn UI Components
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

const UpdateJob = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  // Extract job id and company id from URL params
  const { id, companyId } = useParams()
  const location = useLocation() // Added for route tracking
  const { loading, error, job } = useSelector((state) => state.job)
  const { user } = useSelector((state) => state.auth)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    salaryType: 'fixed', // will be determined from job.salary
    salaryFixed: '',
    salaryMin: '',
    salaryMax: '',
    experienceYears: '',
    experienceLevel: '',
    location: '',
    isOpen: true,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  
  useEffect(() => {
    dispatch(clearError())
    dispatch(clearMessage())

    return () => {
      dispatch(clearError())
      dispatch(clearMessage())
    }
  }, [dispatch, location.pathname])

  // Fetch the job details when the component mounts
  useEffect(() => {
    if (id) {
      dispatch(viewJob(id))
    }
  }, [id, dispatch])

  // Once job data is available, prepopulate the form
  useEffect(() => {
    if (job) {
      // Determine salary type based on job.salary:
      // - If it's a number, it's 'fixed'
      // - If it's an array, it's 'range'
      // - Otherwise, assume 'discutable'
      let salaryType = 'discutable'
      let salaryFixed = ''
      let salaryMin = ''
      let salaryMax = ''
      if (typeof job.salary === 'number') {
        salaryType = 'fixed'
        salaryFixed = String(job.salary)
      } else if (Array.isArray(job.salary)) {
        salaryType = 'range'
        salaryMin = String(job.salary[0])
        salaryMax = String(job.salary[1])
      }
      setFormData({
        title: job.title || '',
        description: job.description || '',
        requirements: Array.isArray(job.requirements)
          ? job.requirements.join(', ')
          : '',
        salaryType,
        salaryFixed,
        salaryMin,
        salaryMax,
        experienceYears: job.experienceYears ? String(job.experienceYears) : '',
        experienceLevel: job.experienceLevel || '',
        location: job.location || '',
        isOpen: job.isOpen !== undefined ? job.isOpen : true,
      })
    }
  }, [job])

  // Validate form fields
  const validateForm = () => {
    const errors = {}
    if (!formData.title.trim()) errors.title = 'Job title is required'
    if (!formData.description.trim())
      errors.description = 'Job description is required'
    if (!formData.location.trim()) errors.location = 'Location is required'
    if (!formData.experienceLevel)
      errors.experienceLevel = 'Experience level is required'

    if (!formData.experienceYears.toString().trim()) {
      errors.experienceYears = 'Experience years are required'
    } else if (isNaN(formData.experienceYears)) {
      errors.experienceYears = 'Experience years must be a number'
    }

    switch (formData.salaryType) {
      case 'fixed':
        if (!formData.salaryFixed.toString().trim())
          errors.salaryFixed = 'Fixed salary is required'
        break
      case 'range':
        if (
          !formData.salaryMin.toString().trim() ||
          !formData.salaryMax.toString().trim()
        ) {
          errors.salaryRange = 'Both salary values are required'
        } else if (Number(formData.salaryMin) > Number(formData.salaryMax)) {
          errors.salaryRange = 'Minimum salary must be less than maximum'
        }
        break
      case 'discutable':
        break
      default:
        errors.salaryType = 'Invalid salary type'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsSubmitting(true)

    // Format the job data as expected by the backend
    const formattedData = {
      ...formData,
      requirements: formData.requirements.split(',').map((req) => req.trim()),
      salary: (() => {
        switch (formData.salaryType) {
          case 'fixed':
            return Number(formData.salaryFixed)
          case 'range':
            return [Number(formData.salaryMin), Number(formData.salaryMax)]
          case 'discutable':
            return 'discutable'
          default:
            return null
        }
      })(),
      experienceYears: Number(formData.experienceYears),
      // Remove temporary fields not needed by the backend
      salaryType: undefined,
      salaryFixed: undefined,
      salaryMin: undefined,
      salaryMax: undefined,
    }

    try {
      await dispatch(updateJob({ jobId: id, companyId, jobData: formattedData })).unwrap()
      
      const recruiterId = user?._id
      navigate(`/recruiter-jobs/${recruiterId}`)

    } catch (err) {
      console.error('Error updating job:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Optionally, show a loader if data is being fetched and no job is available yet
  if (loading && !job) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-3xl font-semibold">Update Job</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-base">
              Job Title
            </Label>
            <Input
              className="mt-2"
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
            {formErrors.title && (
              <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-base">
              Description
            </Label>
            <Textarea
              className="mt-2"
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
            />
            {formErrors.description && (
              <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
            )}
          </div>

          {/* Requirements */}
          <div>
            <Label htmlFor="requirements" className="text-base">
              Requirements (comma separated)
            </Label>
            <Input
              className="mt-2"
              id="requirements"
              name="requirements"
              type="text"
              value={formData.requirements}
              onChange={handleInputChange}
            />
          </div>

          {/* Experience Years */}
          <div>
            <Label htmlFor="experienceYears" className="text-base">
              Experience Years
            </Label>
            <Input
              className="mt-2"
              id="experienceYears"
              name="experienceYears"
              type="number"
              value={formData.experienceYears}
              onChange={handleInputChange}
              required
            />
            {formErrors.experienceYears && (
              <p className="mt-1 text-sm text-red-600">{formErrors.experienceYears}</p>
            )}
          </div>

          {/* Experience Level */}
          <div>
            <Label htmlFor="experienceLevel" className="text-base">
              Experience Level
            </Label>
            <div className="mt-2">
              <Select
                value={formData.experienceLevel || ''}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, experienceLevel: value }))
                }
              >
                <SelectTrigger id="experienceLevel">
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
                <p className="mt-1 text-sm text-red-600">{formErrors.experienceLevel}</p>
              )}
            </div>          
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location" className="text-base">
              Location
            </Label>
            <Input
              className="mt-2"
              id="location"
              name="location"
              type="text"
              value={formData.location}
              onChange={handleInputChange}
              required
            />
            {formErrors.location && (
              <p className="mt-1 text-sm text-red-600">{formErrors.location}</p>
            )}
          </div>

          {/* Salary Type */}
          <div>
            <Label htmlFor="salaryType" className="text-base">
              Salary Type
            </Label>
            <div className="mt-2">
              <Select
                value={formData.salaryType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, salaryType: value }))
                }
              >
                <SelectTrigger id="salaryType">
                  <SelectValue placeholder="Select salary type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed Salary</SelectItem>
                  <SelectItem value="range">Salary Range</SelectItem>
                  <SelectItem value="discutable">Negotiable</SelectItem>
                </SelectContent>
              </Select>
            </div>  
          </div>

          {/* Salary Fields */}
          {formData.salaryType === 'fixed' && (
            <div>
              <Label htmlFor="salaryFixed" className="text-base">
                Salary Amount
              </Label>
              <Input
                className="mt-2"
                id="salaryFixed"
                name="salaryFixed"
                type="number"
                value={formData.salaryFixed}
                onChange={handleInputChange}
                required
              />
              {formErrors.salaryFixed && (
                <p className="mt-1 text-sm text-red-600">{formErrors.salaryFixed}</p>
              )}
            </div>
          )}
          {formData.salaryType === 'range' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="salaryMin" className="text-base">
                  Minimum Salary
                </Label>
                <Input
                  className="mt-2"
                  id="salaryMin"
                  name="salaryMin"
                  type="number"
                  value={formData.salaryMin}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="salaryMax" className="text-base">
                  Maximum Salary
                </Label>
                <Input
                  className="mt-2"
                  id="salaryMax"
                  name="salaryMax"
                  type="number"
                  value={formData.salaryMax}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {formErrors.salaryRange && (
                <p className="col-span-2 mt-1 text-sm text-red-600">{formErrors.salaryRange}</p>
              )}
            </div>
          )}

          {/* Job Status Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="isOpen"
              name="isOpen"
              checked={formData.isOpen}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, isOpen: checked }))
              }
            />
            <Label htmlFor="isOpen" className="text-base font-medium">
                {formData.isOpen
                  ? "Job Open for Applications"
                  : "Job Closed for Applications"}
            </Label>
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="flex items-center justify-end space-x-4 pt-6">
            <Button type="button" variant="outline" onClick={() => navigate(-1)} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || loading} className="cursor-pointer">
              {(isSubmitting || loading) ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Updating...
                </>
              ) : (
                'Update Job'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default UpdateJob
