import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { postJob, clearError } from '../store/jobSlice';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance';

const PostJob = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { companyId } = useParams(); // Grab the company id from the URL params

  // New state to hold the company details
  const [company, setCompany] = useState(null);
  const [companyLoading, setCompanyLoading] = useState(true);

  const { loading, error, job } = useSelector((state) => state.job);

  // Fetch the company details so we can display its name in the title
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const response = await axiosInstance.get(`/company/${companyId}`);
        setCompany(response.data.company);
      } catch (err) {
        console.error("Error fetching company:", err);
      } finally {
        setCompanyLoading(false);
      }
    };

    if (companyId) {
      fetchCompany();
    }
  }, [companyId]);

  // Job form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    salaryType: 'fixed',
    salaryFixed: '',
    salaryMin: '',
    salaryMax: '',
    experienceYears: '',
    experienceLevel: '',
    location: '',
    isOpen: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    // Clear error on unmount
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Job title is required';
    if (!formData.description.trim()) errors.description = 'Job description is required';
    if (!formData.location.trim()) errors.location = 'Location is required';
    if (!formData.experienceLevel) errors.experienceLevel = 'Experience level is required';

    if (!formData.experienceYears.toString().trim()) {
      errors.experienceYears = 'Experience years are required';
    } else if (isNaN(formData.experienceYears)) {
      errors.experienceYears = 'Experience years must be a number';
    }

    switch (formData.salaryType) {
      case 'fixed':
        if (!formData.salaryFixed.toString().trim())
          errors.salaryFixed = 'Fixed salary is required';
        break;
      case 'range':
        if (
          !formData.salaryMin.toString().trim() ||
          !formData.salaryMax.toString().trim()
        ) {
          errors.salaryRange = 'Both salary values are required';
        } else if (Number(formData.salaryMin) > Number(formData.salaryMax)) {
          errors.salaryRange = 'Minimum salary must be less than maximum';
        }
        break;
      case 'discutable':
        break;
      default:
        errors.salaryType = 'Invalid salary type';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);

    // Format the job data as expected by the backend.
    const formattedData = {
      ...formData,
      requirements: formData.requirements.split(',').map((req) => req.trim()),
      salary: (() => {
        switch (formData.salaryType) {
          case 'fixed':
            return Number(formData.salaryFixed);
          case 'range':
            return [Number(formData.salaryMin), Number(formData.salaryMax)];
          case 'discutable':
            return 'discutable';
          default:
            return null;
        }
      })(),
      experienceYears: Number(formData.experienceYears),
      // Remove temporary fields not needed by the backend:
      salaryType: undefined,
      salaryFixed: undefined,
      salaryMin: undefined,
      salaryMax: undefined,
    };

    try {
      // Dispatch the postJob thunk with companyId from URL and the job data
      await dispatch(
        postJob({ companyId, jobData: formattedData })
      ).unwrap();
      navigate('/recruiter-dashboard');
    } catch (err) {
      console.error('Error posting job:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6 md:p-8">
          <h2 className="text-3xl font-bold text-gray-900">
            {companyLoading 
              ? 'Loading company...' 
              : company 
                ? `Post a New Job for ${company.name}` 
                : 'Post a New Job'}
          </h2>
          <p className="mt-2 text-gray-600">
            Provide job details to attract candidates
          </p>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}
          {job && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
              Job posted successfully.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {['title', 'description', 'location', 'requirements'].map(
              (field) => (
                <div key={field}>
                  <label
                    className="block text-sm font-medium text-gray-700"
                    htmlFor={field}
                  >
                    {field.charAt(0).toUpperCase() + field.slice(1)}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={field}
                    name={field}
                    type="text"
                    value={formData[field]}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      formErrors[field] ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {formErrors[field] && (
                    <p className="mt-1 text-sm text-red-600">
                      {formErrors[field]}
                    </p>
                  )}
                </div>
              )
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Experience Years *
              </label>
              <input
                type="number"
                name="experienceYears"
                value={formData.experienceYears}
                onChange={handleInputChange}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  formErrors.experienceYears ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {formErrors.experienceYears && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.experienceYears}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Salary Type *
              </label>
              <select
                name="salaryType"
                value={formData.salaryType}
                onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="fixed">Fixed Salary</option>
                <option value="range">Salary Range</option>
                <option value="discutable">Negotiable</option>
              </select>
            </div>

            {formData.salaryType === 'fixed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Salary Amount *
                </label>
                <input
                  type="number"
                  name="salaryFixed"
                  value={formData.salaryFixed}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                    formErrors.salaryFixed ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {formErrors.salaryFixed && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.salaryFixed}
                  </p>
                )}
              </div>
            )}

            {formData.salaryType === 'range' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Salary Range *
                </label>
                <div className="flex gap-4 mt-1">
                  <input
                    type="number"
                    name="salaryMin"
                    value={formData.salaryMin}
                    onChange={handleInputChange}
                    placeholder="Minimum"
                    className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      formErrors.salaryRange ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  <input
                    type="number"
                    name="salaryMax"
                    value={formData.salaryMax}
                    onChange={handleInputChange}
                    placeholder="Maximum"
                    className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      formErrors.salaryRange ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                </div>
                {formErrors.salaryRange && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.salaryRange}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Experience Level *
              </label>
              <select
                name="experienceLevel"
                value={formData.experienceLevel}
                onChange={handleInputChange}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                  formErrors.experienceLevel ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select experience level</option>
                <option value="entry">Entry</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
              {formErrors.experienceLevel && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.experienceLevel}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-4 pt-6">
              <button
                type="button"
                onClick={() => navigate('/recruiter-dashboard')}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:opacity-50 flex items-center"
              >
                {isSubmitting || loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Posting...
                  </>
                ) : (
                  'Post Job'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostJob;
