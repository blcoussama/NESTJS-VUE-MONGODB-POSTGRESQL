import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getSavedJobs, unsaveJob } from '../store/savedJobSlice'
import { Link, useNavigate } from 'react-router-dom'
import { BookmarkIcon, MapPin, BriefcaseIcon, DollarSign } from 'lucide-react'

// Shadcn UI Components
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'

const SavedJobs = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { savedJobs, loading, error } = useSelector((state) => state.savedJob)
  const [removingJobs, setRemovingJobs] = useState(new Set())

  useEffect(() => {
    dispatch(getSavedJobs())
  }, [dispatch])

  const handleUnsave = async (jobId) => {
    try {
      setRemovingJobs((prev) => new Set(prev).add(jobId))
      await dispatch(unsaveJob(jobId)).unwrap()
    } catch (err) {
      console.error('Error unsaving job:', err)
    } finally {
      setRemovingJobs((prev) => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return <div className="text-center text-red-600 p-4">{error}</div>
  }

  if (!savedJobs.length) {
    return (
      <div className="text-center py-8">
        <p className="text-2xl mb-10">No saved jobs found.</p>
       
        <Link to="/jobs">
          <Button className="cursor-pointer text-lg shadow-md" size="lg">
            Browse Jobs
          </Button> 
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-semibold mb-6">My Saved Jobs</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedJobs.map((savedJob) => {
            const job = savedJob.job
            return (
              <Card
                key={job._id}
                className="relative flex flex-col hover:shadow-md transition-shadow duration-200"
              >
                {/* Unsave Button */}
                <Button
                    variant="secondary"
                    size="saveButtonJobLiting"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleUnsave(job._id);
                    }}
                    disabled={removingJobs.has(job._id)}
                    className="absolute top-4 right-4 rounded-md transition-colors duration-200 cursor-pointer"
                    title="Remove from saved jobs"
                    >
                    <BookmarkIcon
                        size={24}
                        style={{ width: '24px', height: '24px' }}
                        className={`h-10 w-10 ${
                        removingJobs.has(job._id)
                            ? "fill-primary text-primary" // Optionally, you can use a muted style while removing
                            : "fill-primary text-primary"
                        }`}
                    />
                </Button>

                <CardHeader className="px-6 pt-6">
                  <CardTitle className="text-2xl font-semibold">
                    {job.title}
                  </CardTitle>
                  <p className="mt-1 text-lg">
                    At {job.company?.name ? job.company.name : 'Unknown Company'}
                  </p>
                </CardHeader>

                <CardContent className="px-6">
                  {job.company?.logo ? (
                    <img
                      src={job.company.logo}
                      alt={`${job.company.name} logo`}
                      className="h-12 w-24 object-contain mb-4"
                    />
                  ) : (
                    <div className="flex items-center justify-center rounded bg-gray-200/50 border-1 border-gray-200 p-2 dark:bg-gray-700/20 dark:border-gray-600 shadow-md max-w-[100px] mb-5">
                      <span className="text-lg uppercase font-semibold text-gray-400 opacity-75 dark:text-gray-300">
                        No Logo
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      {job.location}
                    </div>
                    <div className="flex items-center">
                      <BriefcaseIcon className="h-4 w-4 mr-1" />
                      {job.experienceLevel
                        ? job.experienceLevel.charAt(0).toUpperCase() + job.experienceLevel.slice(1)
                        : 'N/A'}
                    </div>
                    <div className="flex items-center text-emerald-500 text-lg">
                      <DollarSign className="h-4 w-4 mr-1" />
                      {Array.isArray(job.salary)
                        ? `${job.salary[0].toLocaleString()} - ${job.salary[1].toLocaleString()}`
                        : job.salary === 'discutable'
                        ? 'Negotiable'
                        : `${job.salary.toLocaleString()}`}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="px-6 pb-6 mt-auto">
                  <Button onClick={() => navigate(`/jobs/${job._id}`)} className="w-full cursor-pointer">
                    View Details
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default SavedJobs
