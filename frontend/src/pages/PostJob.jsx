import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { postJob, clearError, clearMessage } from '../store/jobSlice'
import { viewCompany } from '../store/companySlice'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

// Shadcn UI Components
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import LoadingSpinner from '@/components/LoadingSpinner'

const PostJob = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { companyId } = useParams() // Grab the company id from URL params

  const { loading, error, message, job } = useSelector((state) => state.job)
  const { currentCompany, isLoading: companyLoading } = useSelector((state) => state.company)
  const { user } = useSelector((state) => state.auth)

  useEffect(() => {
    // Clear error on unmount
    return () => {
      dispatch(clearError())
      dispatch(clearMessage())
    }
  }, [dispatch])

  // Fetch the company details so we can display its name in the title
  useEffect(() => {
    if (companyId) {
      dispatch(viewCompany(companyId))
    }
  }, [companyId, dispatch])

  // Job form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    salaryType: 'fixed',
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

  const validateForm = () => {
    const errors = {}
    if (!formData.title.trim()) errors.title = 'Job title is required'
    if (!formData.description.trim()) errors.description = 'Job description is required'
    if (!formData.location.trim()) errors.location = 'Location is required'
    if (!formData.experienceLevel) errors.experienceLevel = 'Experience level is required'

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsSubmitting(true)

    // Format the job data as expected by the backend.
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
      // Remove temporary fields not needed by the backend:
      salaryType: undefined,
      salaryFixed: undefined,
      salaryMin: undefined,
      salaryMax: undefined,
    }

    try {
      // Dispatch the postJob thunk with companyId from URL and the job data
      await dispatch(postJob({ companyId, jobData: formattedData })).unwrap()
      // Get recruiterId from current company or user store
      const recruiterId = currentCompany?.userId || user?._id
      navigate(`/recruiter-jobs/${recruiterId}`)
      
      } catch (err) {
        console.error('Error posting job:', err)
      } finally {
        setIsSubmitting(false)
      }
  }

  if (loading && !job) {
    return (
      <div className="flex justify-center items-center h-80">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <Button asChild variant="secondary" size="lg" className="shadow-sm">
              <Link 
                to={`/select-company-for-job/${currentCompany?.userId || ''}`} 
                className="text-[17px]"
              >
                ← Choose Different Company
              </Link>
            </Button>
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="px-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl font-semibold pt-8 pb-4 text-gray-900 dark:text-gray-100">
                {companyLoading
                  ? <LoadingSpinner widthClass='6' heightClass='6' />
                  : currentCompany
                  ? `Post a New Job for ${currentCompany.name}`
                  : 'Post a New Job'}
              </CardTitle>
              <p className="mt-2 text-gray-600 dark:text-gray-300">
                Provide job details to attract candidates
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 py-4">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
              Job posted successfully.
            </div>
          )}
          {/* Add noValidate to disable browser's native validation */}
          <form noValidate onSubmit={handleSubmit} className="space-y-6">
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
              <div className='mt-2'>
                <Select
                  value={formData.experienceLevel}
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
                placeholder="City, State, Country"
                onChange={handleInputChange}
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
              <div className='mt-2'>
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
                />
                {formErrors.salaryFixed && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.salaryFixed}</p>
                )}
              </div>
            )}

            {formData.salaryType === 'range' && (
              <div>
                <Label className="text-base">
                  Salary Range
                </Label>
                <div className="flex gap-4 mt-2">
                  <Input
                    name="salaryMin"
                    type="number"
                    value={formData.salaryMin}
                    onChange={handleInputChange}
                    placeholder="Minimum"
                  />
                  <Input
                    name="salaryMax"
                    type="number"
                    value={formData.salaryMax}
                    onChange={handleInputChange}
                    placeholder="Maximum"
                  />
                </div>
                {formErrors.salaryRange && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.salaryRange}</p>
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
                {isSubmitting || loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Posting...
                  </>
                ) : (
                  'Post Job'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default PostJob
