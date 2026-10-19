import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { updateCompany, viewCompany, clearError, clearMessage } from '../store/companySlice'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'

// Shadcn UI Components
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarImage } from '@/components/ui/avatar'
import LoadingSpinner from '@/components/LoadingSpinner'

const UpdateCompany = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { id } = useParams()

  const { isLoading, error, currentCompany } = useSelector((state) => state.company)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
    location: '',
  })
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('')
  const [removeLogo, setRemoveLogo] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { pathname } = useLocation() // Destructure pathname directly

  // Clear messages/errors on component mount and route change
  useEffect(() => {
    dispatch(clearError())
    dispatch(clearMessage())

    return () => {
      dispatch(clearError())
      dispatch(clearMessage())
    }
  }, [dispatch, pathname]) // Reset on route change

  useEffect(() => {
    if (id) {
      dispatch(viewCompany(id))
    }
  }, [id, dispatch])

  useEffect(() => {
    if (currentCompany) {
      setFormData({
        name: currentCompany.name || '',
        description: currentCompany.description || '',
        website: currentCompany.website || '',
        location: currentCompany.location || '',
      })
      if (currentCompany.logo) {
        setLogoPreviewUrl(currentCompany.logo)
      }
    }
  }, [currentCompany])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setRemoveLogo(false)
      setLogoFile(file)
      setLogoPreviewUrl(URL.createObjectURL(file))
    }
  }

  // Remove logo: clear the preview and mark for removal
  const removeLogoHandler = () => {
    setRemoveLogo(true)
    setLogoFile(null)
    setLogoPreviewUrl('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const submitData = new FormData()
      Object.keys(formData).forEach(key => {
        if (formData[key]) {
          submitData.append(key, formData[key])
        }
      })

      // Append remove flag or file upload for logo
      if (removeLogo) {
        submitData.append('removeLogo', 'true')
      } else if (logoFile) {
        submitData.append('logo', logoFile)
      }

      await dispatch(updateCompany({ id, companyData: submitData })).unwrap()
      navigate('/recruiter-companies')
    } catch (err) {
      console.error('Error updating company:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && !currentCompany) {
    return (
      <div className="flex justify-center items-center h-80">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-2xl mx-auto rounded-xl shadow-md p-6 md:p-8">
        <CardHeader className="mb-8">
          <CardTitle className="text-3xl font-semibold">
            Update Company Profile
          </CardTitle>
        </CardHeader>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div>
            <Label htmlFor="name" className="text-base">
              Company Name
            </Label>
            <Input
              className="mt-2"
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter company name"
            />
          </div>

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
              placeholder="Tell us about your company..."
            />
          </div>

          <div>
            <Label htmlFor="website" className="text-base">
              Website
            </Label>
            <Input
              className="mt-2"
              id="website"
              name="website"
              type="url"
              value={formData.website}
              onChange={handleInputChange}
              placeholder="https://example.com"
            />
          </div>

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
              placeholder="City, Country"
            />
          </div>

          {/* Company Logo Upload */}
          <div>
            <Label className="block font-medium text-base">Company Logo</Label>
            <div className="mt-10 flex items-center space-x-4">
              <div className="relative">
                {logoPreviewUrl ? (
                  <Avatar className="w-20 h-20 rounded">
                    <AvatarImage
                      src={logoPreviewUrl}
                      alt="Logo Preview"
                      className="object-contain w-full h-full" // Ensures the image is contained
                    />
                  </Avatar>
                ) : (
                  // New fallback when no logo is uploaded:
                  <div className="w-32 h-20 flex items-center justify-center rounded bg-gray-200/50 border border-gray-200 p-2 dark:bg-gray-700/20 dark:border-gray-600 shadow-md">
                    <span className="text-lg uppercase font-bold text-gray-400 opacity-75 dark:text-gray-300 whitespace-nowrap">
                      No Logo
                    </span>
                  </div>
                )}
                {logoPreviewUrl && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-5 -right-5 cursor-pointer"
                    onClick={removeLogoHandler}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
              {!logoPreviewUrl && (
                <div className="flex-1">
                  <Button asChild variant="default">
                    <label htmlFor="logo-upload" className="cursor-pointer flex items-center gap-2">
                      Upload Logo
                    </label>
                  </Button>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <p className="mt-3 text-xs">JPG, PNG or WebP (MAX. 5MB)</p>
                </div>
              )}
            </div>
          </div>


          <div className="flex items-center justify-end space-x-4 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate('/recruiter-companies')} className="cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading} className="flex items-center cursor-pointer">
              {(isSubmitting || isLoading) ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Updating...
                </>
              ) : (
                'Update Company'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default UpdateCompany;
