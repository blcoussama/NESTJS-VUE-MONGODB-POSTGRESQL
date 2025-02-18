import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Upload, Loader, X } from 'lucide-react'
import axiosInstance from '../utils/axiosInstance'
import { useSelector } from 'react-redux'

// Shadcn UI Components
import { CardHeader, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import LoadingSpinner from '@/components/LoadingSpinner'

const RecruiterProfileUpdate = () => {
  const { user: currentUser } = useSelector((state) => state.auth)
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profilePicture, setProfilePicture] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [removeProfilePicture, setRemoveProfilePicture] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Fetch existing profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axiosInstance.get(`/user/profile/${currentUser._id}`)
        const profile = response.data.user.profile
        setFirstName(profile.firstName || '')
        setLastName(profile.lastName || '')
        if (profile.profilePicture) {
          setPreviewUrl(profile.profilePicture)
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching profile')
      } finally {
        setIsLoading(false)
      }
    }

    if (currentUser && currentUser._id) {
      fetchProfile()
    }
  }, [currentUser])

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setRemoveProfilePicture(false)
      setProfilePicture(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleRemoveProfilePicture = () => {
    setRemoveProfilePicture(true)
    setProfilePicture(null)
    setPreviewUrl('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('firstName', firstName)
      formData.append('lastName', lastName)
      if (removeProfilePicture) {
        formData.append('removeProfilePicture', 'true')
      } else if (profilePicture) {
        formData.append('profilePicture', profilePicture)
      }

      const response = await axiosInstance.put('/user/recruiter-profile-update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (response.data.success) {
        navigate(-1) // Redirect after update
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred during profile update')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <motion.div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto p-8 mt-8 rounded-2xl bg-card border shadow-xl"
    >
      <CardHeader>
        <h2 className="text-3xl font-bold mb-6 text-center">
          Update Your Profile
        </h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture Upload */}
          <div className="mb-6 flex flex-col items-center relative ">
            <Avatar className="w-32 h-32 mb-4 border-3">
              {previewUrl ? (
                <AvatarImage src={previewUrl} alt="Profile preview" />
              ) : (
                <AvatarFallback>
                  <User size={90} className="text-gray-400" />
                </AvatarFallback>
              )}
            </Avatar>
            {previewUrl && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-0 right-0 cursor-pointer"
                onClick={handleRemoveProfilePicture}
              >
                <X size={16} />
              </Button>
            )}
            <Button asChild variant="default">
              <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-2">
                <Upload size={20} />
                Upload Photo
              </label>
            </Button>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleImageChange}
            />
          </div>

          {/* First Name */}
          <div>
            <Label htmlFor="firstName" className="text-base">
              First Name
            </Label>
            <Input
              className="mt-2"
              id="firstName"
              name="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
            />
          </div>

          {/* Last Name */}
          <div>
            <Label htmlFor="lastName" className="text-base">
              Last Name
            </Label>
            <Input
              className="mt-2"
              id="lastName"
              name="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
            />
          </div>

          {error && <p className="text-red-500 font-semibold mt-2">{error}</p>}

          <Button type="submit" className="w-full cursor-pointer" disabled={isLoading}>
            {isLoading ? (
              <Loader className="animate-spin mx-auto" size={24} />
            ) : (
              'Update Profile'
            )}
          </Button>
        </form>
      </CardContent>
    </motion.div>
  )
}

export default RecruiterProfileUpdate
