import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getJobsByCompany, clearError } from '../store/jobSlice';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const JobsByCompany = () => {
  // We assume that the company ID is provided in the URL as "id"
  const { id: companyId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { jobs, loading, error } = useSelector((state) => state.job);

  useEffect(() => {
    if (companyId) {
      dispatch(getJobsByCompany(companyId));
    }
    return () => {
      dispatch(clearError());
    };
  }, [dispatch, companyId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center text-gray-600">
        <p>No jobs posted by this company.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Jobs at this Company</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {jobs.map((job) => (
          <div
            key={job._id}
            className="p-4 border rounded-lg shadow hover:shadow-lg transition duration-200 cursor-pointer"
            onClick={() => navigate(`/jobs/${job._id}`)}
          >
            <h3 className="text-lg font-semibold">{job.title}</h3>
            <p className="text-gray-600 mt-1">
              {job.description.length > 80
                ? job.description.substring(0, 80) + '...'
                : job.description}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Experience: {job.experienceYears} years, {job.experienceLevel}
            </p>
            <p className="text-sm text-gray-500">Location: {job.location}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobsByCompany;
