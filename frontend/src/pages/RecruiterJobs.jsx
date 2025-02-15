/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getJobsByRecruiter, deleteJob } from '../store/jobSlice';
import { Trash2, Edit, Briefcase } from 'lucide-react';

const JobCard = ({ job, onDelete, isDeleting, isOwner }) => {
  const navigate = useNavigate();

  return (
    <div 
      className="bg-white rounded-lg shadow-md p-6 relative hover:shadow-lg transition-shadow cursor-pointer"
      onClick={(e) => {
        if (!e.target.closest('button')) {
          navigate(`/jobs/${job._id}`);
        }
      }}
    >
      {isOwner && (
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => navigate(`/update-job/${job._id}/from/${job.company}`)}
            className="text-blue-600 hover:text-blue-700 p-1"
            title="Edit"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => onDelete(job._id)}
            className="text-red-600 hover:text-red-700 p-1"
            title="Delete"
            disabled={isDeleting}
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}
      
      <div className="flex items-start gap-4">
        <div className="bg-blue-100 p-3 rounded-lg">
          <Briefcase size={24} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">{job.title}</h3>
          <p className="text-gray-600 mt-1">{job.company?.name}</p>
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span>{job.location}</span>
            <span className={`px-2 py-1 rounded-full ${
              job.isOpen ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {job.isOpen ? 'Open' : 'Closed'}
            </span>
            <span>{job.applications?.length || 0} applications</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const RecruiterJobs = () => {
  const dispatch = useDispatch();
  const { recruiterId } = useParams();
  const { user } = useSelector((state) => state.auth);
  const { jobs, loading, error } = useSelector((state) => state.job);
  const [deletingId, setDeletingId] = useState(null);

  // Check if current user is the owner
  const isOwner = user?.role === 'recruiter' && user?._id === recruiterId;

  useEffect(() => {
    if (recruiterId) {
      dispatch(getJobsByRecruiter(recruiterId));
    }
  }, [dispatch, recruiterId]);

  const handleDelete = async (jobId) => {
    try {
      setDeletingId(jobId);
      await dispatch(deleteJob(jobId)).unwrap();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            {isOwner ? 'Your Job Postings' : 'Job Postings'}
          </h1>
          {isOwner && (
            <Link
              to={`/select-company-for-job/${recruiterId}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Post New Job
            </Link>
          )}
        </div>

        {loading && (
          <div className="text-center py-8">
            <p>Loading jobs...</p>
          </div>
        )}

        {error && <div className="text-red-600 p-4">{error}</div>}

        <div className="grid gap-4">
          {jobs?.map(job => (
            <JobCard 
              key={job._id} 
              job={job} 
              onDelete={handleDelete}
              isDeleting={deletingId === job._id}
              isOwner={isOwner}
            />
          ))}
        </div>

        {!loading && jobs?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {isOwner 
              ? "You haven't posted any jobs yet."
              : "No job postings available."
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruiterJobs;