import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { viewJob, clearJob, deleteJob } from '../store/jobSlice';
import { saveJob as saveJobAction, unsaveJob, getSavedJobs } from '../store/savedJobSlice';
import JobApplications from '../components/JobApplications';
import { Trash2, Edit, X, User, BookmarkIcon } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance';

const JobDetails = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { job, loading, error } = useSelector((state) => state.job);
  const { user } = useSelector((state) => state.auth);
  const { savedJobs } = useSelector((state) => state.savedJob);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recruiterProfile, setRecruiterProfile] = useState(null);
  const [savingJobs, setSavingJobs] = useState(new Set());

  // Fetch job details on mount, then clear on unmount
  useEffect(() => {
    dispatch(viewJob(id));
    return () => dispatch(clearJob());
  }, [dispatch, id]);

  // Fetch saved jobs so we know if the job is already saved
  useEffect(() => {
    dispatch(getSavedJobs());
  }, [dispatch]);

  // Fetch recruiter profile if job exists
  useEffect(() => {
    const fetchRecruiterProfile = async () => {
      if (job?.created_by) {
        try {
          const response = await axiosInstance.get(`/user/profile/${job.created_by}`);
          setRecruiterProfile(response.data.user.profile);
        } catch (error) {
          console.error('Error fetching recruiter profile:', error);
        }
      }
    };

    if (job) fetchRecruiterProfile();
  }, [job]);

  // Check if current job is already saved
  const isJobSaved = () => {
    return savedJobs?.some(savedJob => savedJob.job._id === job._id);
  };

  // Toggle save/unsave action
  const handleSaveToggle = async (e) => {
    e.stopPropagation();
    try {
      setSavingJobs(prev => new Set(prev).add(job._id));
      
      if (isJobSaved()) {
        await dispatch(unsaveJob(job._id)).unwrap();
      } else {
        const result = await dispatch(saveJobAction(job._id)).unwrap();
        if (result.success) {
          dispatch(getSavedJobs());
        }
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    } finally {
      setSavingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(job._id);
        return newSet;
      });
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await dispatch(deleteJob(id)).unwrap();
      navigate('/recruiter-jobs');
    } catch (error) {
      console.error('Delete job failed:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p>Loading job details...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-600 p-4">Error: {error}</div>;
  }

  if (!job) {
    return null;
  }

  const isJobOwner = user?._id === job.created_by.toString() && user?.role === 'recruiter';

  return (
    <div className="container mx-auto p-4">
      <Link to="/jobs" className="text-blue-500 hover:underline">&larr; Back to Job Listings</Link>
      
      <div className="bg-white shadow rounded p-6 mt-4 relative">
        {/* Bookmark Button for Save/Unsave (appears for any logged-in user) */}
        {user && (
          <button
            onClick={handleSaveToggle}
            disabled={savingJobs.has(job._id)}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
          >
            <BookmarkIcon 
              className={`h-6 w-6 ${
                isJobSaved() || savingJobs.has(job._id)
                  ? 'fill-blue-500 text-blue-500'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            />
          </button>
        )}

        {/* Edit/Delete Buttons for Job Owner */}
        {isJobOwner && (
          <div className="absolute top-6 right-6 flex gap-3">
            <button
              onClick={() => navigate(`/update-job/${job._id}/from/${job.company?._id}`)}
              className="text-blue-600 hover:text-blue-700"
              title="Edit Job"
            >
              <Edit size={20} />
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-red-600 hover:text-red-700"
              title="Delete Job"
            >
              <Trash2 size={20} />
            </button>
          </div>
        )}

        {/* Job Title and Status */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <span className={`px-3 py-1 rounded-full text-sm ${
            job.isOpen 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {job.isOpen ? 'Open' : 'Closed'}
          </span>
        </div>

        {/* Recruiter Profile Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Posted By</h3>
          <Link 
            to={`/profile/${job.created_by}`}
            className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              {recruiterProfile?.profilePicture ? (
                <img 
                  src={recruiterProfile.profilePicture} 
                  alt="Recruiter profile" 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <User size={24} className="text-gray-400" />
              )}
            </div>
            <div>
              <p className="font-medium">
                {recruiterProfile?.firstName} {recruiterProfile?.lastName}
              </p>
              <p className="text-sm text-gray-600">Recruiter</p>
            </div>
          </Link>
        </div>

        {/* Company Information */}
        <div className="flex items-center mb-4">
          {job.company?.logo ? (
            <img
              src={job.company.logo}
              alt={`${job.company.name} logo`}
              className="h-16 w-16 object-contain mr-4"
            />
          ) : (
            <div className="h-16 w-16 bg-gray-200 flex items-center justify-center mr-4">
              <span className="text-gray-500 text-sm">No Logo</span>
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold">{job.company?.name}</h2>
            <p className="text-gray-500">{job.company?.location}</p>
          </div>
        </div>

        {/* Job Details Sections */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Job Description</h3>
          <p className="text-gray-700">{job.description}</p>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold">Requirements</h3>
          <ul className="list-disc pl-5">
            {job.requirements.map((req, index) => (
              <li key={index} className="text-gray-700">{req}</li>
            ))}
          </ul>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold">Salary</h3>
          <p className="text-gray-700">
            {Array.isArray(job.salary)
              ? `$${job.salary[0].toLocaleString()} - $${job.salary[1].toLocaleString()}`
              : job.salary === "discutable"
              ? "Negotiable"
              : `$${job.salary.toLocaleString()}`}
          </p>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold">Experience</h3>
          <p className="text-gray-700">
            {job.experienceYears} year{job.experienceYears > 1 && "s"} -{" "}
            {job.experienceLevel.charAt(0).toUpperCase() + job.experienceLevel.slice(1)}
          </p>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold">Location</h3>
          <p className="text-gray-700">{job.location}</p>
        </div>

        <div className="mb-4">
          <h3 className="text-lg font-semibold">Applications</h3>
          <p className="text-gray-700">
            {job.applications?.length || 0} application{job.applications?.length !== 1 ? 's' : ''} received
          </p>
        </div>

        {/* Apply Button for Candidates */}
        {user?.role === 'candidate' && (
          <div className="mt-6">
            <button
              onClick={() => navigate(`/apply/${job._id}`)}
              disabled={!job.isOpen}
              className={`px-4 py-2 rounded transition-colors duration-200 ${
                job.isOpen
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {job.isOpen ? 'Apply Now' : 'Applications Closed'}
            </button>
            {!job.isOpen && (
              <p className="mt-2 text-sm text-gray-500">
                This position is no longer accepting applications
              </p>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Delete Job</h3>
                <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X size={24} />
                </button>
              </div>
              <p className="text-gray-600 mb-6">Are you sure you want to delete this job posting? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Job'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Job Applications Section */}
      {isJobOwner && <JobApplications jobId={job._id} recruiterId={job.created_by} />}
    </div>
  );
};

export default JobDetails;
