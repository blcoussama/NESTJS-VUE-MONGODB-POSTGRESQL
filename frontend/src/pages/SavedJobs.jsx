import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getSavedJobs, unsaveJob } from '../store/savedJobSlice';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, BookmarkIcon, MapPin, BriefcaseIcon, DollarSign } from 'lucide-react';

const SavedJobs = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { savedJobs, loading, error } = useSelector((state) => state.savedJob);
  const [removingJobs, setRemovingJobs] = useState(new Set());

  useEffect(() => {
    dispatch(getSavedJobs());
  }, [dispatch]);

  const handleUnsave = async (jobId) => {
    try {
      setRemovingJobs((prev) => new Set(prev).add(jobId));
      await dispatch(unsaveJob(jobId)).unwrap();
    } catch (err) {
      console.error('Error unsaving job:', err);
    } finally {
      setRemovingJobs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-600 p-4">{error}</div>;
  }

  if (!savedJobs.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No saved jobs found.</p>
        <Link to="/jobs" className="text-blue-500 hover:underline">
          Browse Jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-6">My Saved Jobs</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedJobs.map((savedJob) => {
            const job = savedJob.job;
            return (
              <div
                key={job._id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6 flex flex-col relative"
              >
                {/* Unsave Button */}
                <button
                  onClick={() => handleUnsave(job._id)}
                  disabled={removingJobs.has(job._id)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                  title="Remove from saved jobs"
                >
                  <BookmarkIcon className="h-6 w-6 fill-blue-500 text-blue-500" />
                </button>

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{job.title}</h3>
                    <p className="text-gray-500 mt-1">
                      {job.company?.name ? job.company.name : 'Unknown Company'}
                    </p>
                  </div>
                  {job.company?.logo ? (
                    <img
                      src={job.company.logo}
                      alt={`${job.company.name} logo`}
                      className="h-12 w-24 object-contain"
                    />
                  ) : (
                    <div className="h-12 w-12 bg-gray-100 flex items-center justify-center rounded">
                      <span className="text-gray-500 text-xs">No Logo</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-4">
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
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    {Array.isArray(job.salary)
                      ? `$${job.salary[0].toLocaleString()} - $${job.salary[1].toLocaleString()}`
                      : job.salary === 'discutable'
                      ? 'Negotiable'
                      : `$${job.salary.toLocaleString()}`}
                  </div>
                </div>

                <div className="mt-auto">
                  <button
                    onClick={() => navigate(`/jobs/${job._id}`)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SavedJobs;
