import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAllJobs } from '../store/jobSlice';
import { saveJob, unsaveJob, getSavedJobs } from '../store/savedJobSlice';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, BriefcaseIcon, DollarSign, Loader2, CheckCircle2, BookmarkIcon } from 'lucide-react';

const JobListing = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { jobs, loading, error, totalPages, currentPage } = useSelector((state) => state.job);
  const { savedJobs } = useSelector((state) => state.savedJob); // Removed the unused "loading" alias
  const [savingJobs, setSavingJobs] = useState(new Set());

  const [filters, setFilters] = useState({
    search: '',
    location: '',
    experienceLevel: '',
    salary: '',
    salaryMin: '',
    salaryMax: '',
    page: 1,
  });

  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    dispatch(getAllJobs(debouncedFilters));
  }, [dispatch, debouncedFilters]);

  useEffect(() => {
    dispatch(getSavedJobs());
  }, [dispatch]);

  const isJobSaved = (jobId) => {
    return savedJobs?.some(savedJob => savedJob.job._id === jobId);
  };

  const handleSaveToggle = async (jobId) => {
    try {
      setSavingJobs(prev => new Set(prev).add(jobId));
      
      if (isJobSaved(jobId)) {
        await dispatch(unsaveJob(jobId)).unwrap();
      } else {
        const result = await dispatch(saveJob(jobId)).unwrap();
        // If the job was saved successfully, refresh the saved jobs list
        if (result.success) {
          dispatch(getSavedJobs());
        }
      }
    } catch (error) {
      console.error('Failed to toggle job save:', error);
    } finally {
      setSavingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
      page: 1
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const formatSalary = (salary) => {
    if (Array.isArray(salary)) {
      return `$${salary[0].toLocaleString()} - $${salary[1].toLocaleString()}`;
    }
    if (salary === 'discutable') {
      return 'Negotiable';
    }
    return `$${salary.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Find Your Next Opportunity</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Search jobs..."
                className="pl-10 w-full h-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                name="location"
                value={filters.location}
                onChange={handleFilterChange}
                placeholder="Location..."
                className="pl-10 w-full h-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            <div className="relative">
              <BriefcaseIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <select
                name="experienceLevel"
                value={filters.experienceLevel}
                onChange={handleFilterChange}
                className="pl-10 w-full h-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white"
              >
                <option value="">Any Experience Level</option>
                <option value="entry">Entry</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <select
                name="salary"
                value={filters.salary}
                onChange={handleFilterChange}
                className="pl-10 w-full h-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white"
              >
                <option value="">Any Salary</option>
                <option value="discutable">Negotiable</option>
                <option value="range">Specify Range</option>
              </select>
            </div>
          </div>

          {filters.salary === 'range' && (
            <div className="mt-4 flex gap-4">
              <input
                type="number"
                name="salaryMin"
                value={filters.salaryMin}
                onChange={handleFilterChange}
                placeholder="Min Salary"
                className="flex-1 h-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none px-3"
              />
              <input
                type="number"
                name="salaryMax"
                value={filters.salaryMax}
                onChange={handleFilterChange}
                placeholder="Max Salary"
                className="flex-1 h-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none px-3"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="text-center text-red-600 p-4">{error}</div>
        ) : jobs.length === 0 ? (
          <div className="text-center text-gray-500 p-4">No jobs found matching your criteria</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <div 
                key={job._id} 
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6 flex flex-col relative"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveToggle(job._id);
                  }}
                  disabled={savingJobs.has(job._id)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                >
                  <BookmarkIcon 
                    className={`h-6 w-6 ${
                      isJobSaved(job._id) || savingJobs.has(job._id)
                        ? 'fill-blue-500 text-blue-500' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  />
                </button>

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{job.title}</h3>
                    <p className="text-gray-500 mt-1">{job.company?.name}</p>
                  </div>
                  {job.company?.logo ? (
                    <img
                      src={job.company?.logo}
                      alt={`${job.company?.name} logo`}
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
                    {job.experienceLevel.charAt(0).toUpperCase() + job.experienceLevel.slice(1)}
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    {formatSalary(job.salary)}
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Requirements:</h4>
                  <ul className="space-y-2">
                    {job.requirements?.slice(0, 3).map((req, index) => (
                      <li key={index} className="flex items-start text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                    {job.requirements?.length > 3 && (
                      <li className="text-sm text-gray-500 italic">
                        +{job.requirements.length - 3} more requirements
                      </li>
                    )}
                  </ul>
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
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-4 py-2 rounded-md transition-colors duration-200 ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobListing;
