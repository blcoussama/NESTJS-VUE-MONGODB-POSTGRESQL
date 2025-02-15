// src/components/ApplyJob.jsx
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { applyJob, clearApplication } from '../store/applicationSlice';
import { viewJob } from '../store/jobSlice';
import { useParams, useNavigate, Link } from 'react-router-dom';

const ApplyJob = () => {
  const { jobId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Get job details for context (if not already loaded)
  const { job } = useSelector((state) => state.job);
  useEffect(() => {
    if (!job || job._id !== jobId) {
      dispatch(viewJob(jobId));
    }
  }, [dispatch, jobId, job]);

  const { loading, error, message } = useSelector((state) => state.application);

  const [formData, setFormData] = useState({
    experienceYears: '',
    experienceLevel: 'entry',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const applicationData = {
      experienceYears: Number(formData.experienceYears),
      experienceLevel: formData.experienceLevel,
    };
    dispatch(applyJob({ jobId, applicationData }));
  };

  useEffect(() => {
    if (message) {
      // After a successful application, navigate back to the job details (or to a confirmation page)
      navigate(`/jobs/${jobId}`);
      dispatch(clearApplication());
    }
  }, [message, navigate, jobId, dispatch]);

  return (
    <div className="container mx-auto p-4">
      <Link to={`/jobs/${jobId}`} className="text-blue-500 hover:underline">&larr; Back to Job Details</Link>
      <div className="bg-white shadow rounded p-6 mt-4">
        <h2 className="text-2xl font-bold mb-4">Apply for Job</h2>
        {job && (
          <div className="mb-4">
            <h3 className="text-xl">{job.title}</h3>
            <p className="text-gray-600">{job.location}</p>
          </div>
        )}
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="experienceYears" className="block text-gray-700 font-medium mb-1">
              Years of Experience:
            </label>
            <input
              type="number"
              name="experienceYears"
              id="experienceYears"
              value={formData.experienceYears}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="experienceLevel" className="block text-gray-700 font-medium mb-1">
              Experience Level:
            </label>
            <select
              name="experienceLevel"
              id="experienceLevel"
              value={formData.experienceLevel}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="entry">Entry</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
          >
            {loading ? 'Applying...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ApplyJob;
