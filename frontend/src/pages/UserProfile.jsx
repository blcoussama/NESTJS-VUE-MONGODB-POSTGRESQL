/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axiosInstance from '../utils/axiosInstance'
import { Briefcase, User, FileText, Users, MapPin, BriefcaseIcon } from 'lucide-react'
import { useSelector, useDispatch } from 'react-redux'
import { getJobsByRecruiter } from '../store/jobSlice'

// Shadcn UI Components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Badge } from '@/components/ui/badge'

const UserProfile = () => {
  const { id } = useParams() // ID of the profile being viewed
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const [userProfile, setUserProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState('')

  // State for recruiter companies (full details)
  const [recruiterCompanies, setRecruiterCompanies] = useState([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companiesError, setCompaniesError] = useState('')

  // Get the logged-in user from Redux
  const { user: currentUser } = useSelector((state) => state.auth)

  // Get recruiter jobs from the job slice
  const { jobs: recruiterJobs, loading: jobsLoading, error: jobsError } = useSelector((state) => state.job)

  // Fetch the user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axiosInstance.get(`/user/profile/${id}`)
        setUserProfile(response.data.user.profile)
      } catch (err) {
        setProfileError(err.response?.data?.message || 'Error fetching profile')
      } finally {
        setProfileLoading(false)
      }
    }
    fetchProfile()
  }, [id])

  // If the profile belongs to a recruiter (assumed by having a companies field), fetch companies
  useEffect(() => {
    if (userProfile && userProfile.companies) {
      setCompaniesLoading(true)
      axiosInstance
        .get(`/company/companies/${id}`)
        .then(response => {
          setRecruiterCompanies(response.data.companies)
          setCompaniesLoading(false)
        })
        .catch(err => {
          setCompaniesError(err.response?.data?.message || 'Error fetching companies')
          setCompaniesLoading(false)
        })
    }
  }, [userProfile, id])

  // If the profile belongs to a recruiter, fetch their job postings
  useEffect(() => {
    if (userProfile && userProfile.companies) {
      // We assume a recruiter profile includes a companies field.
      dispatch(getJobsByRecruiter(id))
    }
  }, [dispatch, userProfile, id])

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-80">
        <LoadingSpinner />
      </div>
    )
  }

  if (profileError) {
    return <div className="text-center text-red-600 p-4">{profileError}</div>
  }

  if (!userProfile) return null

  // Inline JobCard component for displaying each job posting using Shadcn UI Card
  const JobCard = ({ job }) => {
    const navigate = useNavigate()
    return (
      <Card
        className="rounded-lg shadow-md p-6 relative transition-shadow cursor-pointer hover:bg-gradient-to-r from-background to-muted"
        onClick={(e) => {
            if (!e.target.closest('button')) {
            navigate(`/jobs/${job._id}`)
            }
        }}
        >
        <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
            <BriefcaseIcon size={24} className="text-blue-600" />
            </div>
            <div className="flex-1">
            {/* Title row with badge */}
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold capitalize">{job.title}</h3>
                <Badge
                variant={job.isOpen ? "open" : "closed"}
                className="text-sm px-3 py-1 tracking-wider"
                >
                {job.isOpen ? "OPEN" : "CLOSED"}
                </Badge>
            </div>
            <p className="mt-1">At {job.company?.name}</p>
            {/* Details row */}
            <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{job.location}</span>
                </div>
                <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{job.applications?.length || 0} Applications</span>
                </div>
            </div>
            </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      {/* Use Card to wrap the profile; classes preserved from your original layout */}
      <Card className="bg-card dark:bg-card shadow rounded p-6 mt-4">
        {/* Edit Profile Button: Only if the current user owns this profile */}
        {currentUser && currentUser._id === id && (
          <div className="text-right mb-4">
            <Button
              onClick={() =>
                navigate(
                  currentUser.role === 'recruiter'
                    ? '/recruiter-profile-update'
                    : '/candidate-profile-update'
                )
              }
              className="cursor-pointer"
            >
              Edit Profile
            </Button>
          </div>
        )}
        {currentUser && currentUser._id !== id && (
          <div className="text-right mb-4">
            <Button
              onClick={() => navigate(`/chat/${id}`)}
              variant="outline"
              className="cursor-pointer"
            >
              Message
            </Button>
          </div>
        )}

        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-24 h-24">
            <Avatar className="w-full h-full border-3">
              {userProfile.profilePicture ? (
                <AvatarImage
                  src={userProfile.profilePicture}
                  alt="Profile"
                  className="rounded-full object-cover"
                />
              ) : (
                <AvatarFallback>
                  <User size={70} className="text-gray-400" />
                </AvatarFallback>
              )}
            </Avatar>
          </div>
          <div>
            <h1 className="text-2xl font-semibold capitalize">
              {userProfile.firstName} {userProfile.lastName}
            </h1>
          </div>
        </div>

        {/* About Section */}
        {userProfile.description && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">About</h2>
            <p className="">{userProfile.description}</p>
          </div>
        )}

        {/* Skills Section */}
        {userProfile.skills?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Skills</h2>
            <div className="flex flex-wrap gap-4 capitalize">
              {userProfile.skills.map((skill, index) => (
                <Badge
                    key={index}
                    variant="pending"
                    className="px-2 py-1 rounded text-base capitalize font-normal"
                    >
                    {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Recruiter Companies Section */}
        {userProfile.companies && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Briefcase size={20} /> Companies
            </h2>
            {companiesLoading ? (
              <div className="flex justify-center items-center h-16">
                <LoadingSpinner widthClass='w-8' heightClass='h-8' />
              </div>
            ) : companiesError ? (
              <div className="text-red-600">{companiesError}</div>
            ) : recruiterCompanies.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recruiterCompanies.map(company => (
                  <div
                    key={company._id}
                    className="flex items-center gap-8 cursor-pointer p-2 pl-5 pb-4 bg-gradient-to-r from-background to-muted border rounded hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/company/${company._id}`)}
                  >
                    {company.logo && (
                      <img
                        src={company.logo}
                        alt={`${company.name} logo`}
                        className="w-20 h-20 object-contain"
                      />
                    )}
                    <div>
                      <h3 className="font-medium text-xl mb-2">{company.name}</h3>
                      <p className="text-sm">{company.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No companies registered.</p>
            )}
          </div>
        )}

        {/* Recruiter Jobs Section */}
        {userProfile.companies && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Job Postings</h2>
            {jobsLoading ? (
              <div className="flex justify-center items-center h-16">
                <LoadingSpinner widthClass='w-8' heightClass='h-8' />
              </div>
            ) : jobsError ? (
              <div className="text-red-600">{jobsError}</div>
            ) : recruiterJobs && recruiterJobs.length > 0 ? (
              <div className="grid gap-4">
                {recruiterJobs.map(job => (
                  <JobCard key={job._id} job={job} />
                ))}
              </div>
            ) : (
              <p>No job postings yet.</p>
            )}
          </div>
        )}

        {/* Resume Section */}
        {userProfile.resume && (
          <div className="mt-10">
            <Badge variant="secondary" className="py-3 px-4 shadow hover:shadow-lg transition-shadow">
                <a
                href={userProfile.resume}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-500 text-lg"
                >
                <FileText size={34} /> View Resume
                </a>
            </Badge>
          </div>        
        )}
        
      </Card>
    </div>
  )
}

export default UserProfile
