import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { viewJob, updateJob } from '../store/jobSlice';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const UpdateJob = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Extract job id and company id from URL params
  const { id, companyId } = useParams();
  const { loading, error, job } = useSelector((state) => state.job);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    salaryType: 'fixed', // will be determined from job.salary
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

  // Fetch the job details when the component mounts
  useEffect(() => {
    if (id) {
      dispatch(viewJob(id));
    }
  }, [id, dispatch]);

  // Once job data is available, prepopulate the form
  useEffect(() => {
    if (job) {
      // Determine salary type based on job.salary:
      // - If it's a number, it's 'fixed'
      // - If it's an array, it's 'range'
      // - Otherwise, assume 'discutable'
      let salaryType = 'discutable';
      let salaryFixed = '';
      let salaryMin = '';
      let salaryMax = '';
      if (typeof job.salary === 'number') {
        salaryType = 'fixed';
        salaryFixed = String(job.salary);
      } else if (Array.isArray(job.salary)) {
        salaryType = 'range';
        salaryMin = String(job.salary[0]);
        salaryMax = String(job.salary[1]);
      }
      setFormData({
        title: job.title || '',
        description: job.description || '',
        requirements: Array.isArray(job.requirements)
          ? job.requirements.join(', ')
          : '',
        salaryType,
        salaryFixed,
        salaryMin,
        salaryMax,
        experienceYears: job.experienceYears ? String(job.experienceYears) : '',
        experienceLevel: job.experienceLevel || '',
        location: job.location || '',
        isOpen: job.isOpen !== undefined ? job.isOpen : true,
      });
    }
  }, [job]);

  // Validate form fields
  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Job title is required';
    if (!formData.description.trim())
      errors.description = 'Job description is required';
    if (!formData.location.trim()) errors.location = 'Location is required';
    if (!formData.experienceLevel)
      errors.experienceLevel = 'Experience level is required';

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

  // Handle input changes
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

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);

    // Format the job data as expected by the backend
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
      // Remove temporary fields not needed by the backend
      salaryType: undefined,
      salaryFixed: undefined,
      salaryMin: undefined,
      salaryMax: undefined,
    };

    try {
      await dispatch(
        updateJob({ jobId: id, companyId, jobData: formattedData })
      ).unwrap();
      navigate('/recruiter-dashboard');
    } catch (err) {
      console.error('Error updating job:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Optionally, show a loader if data is being fetched and no job is available yet
  if (loading && !job) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8 bg-white rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Update Job</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="title">
            Job Title
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={formData.title}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required
          />
          {formErrors.title && (
            <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="4"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          ></textarea>
          {formErrors.description && (
            <p className="mt-1 text-sm text-red-600">{formErrors.description}</p>
          )}
        </div>

        {/* Requirements */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="requirements">
            Requirements (comma separated)
          </label>
          <input
            id="requirements"
            name="requirements"
            type="text"
            value={formData.requirements}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Experience Years */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="experienceYears">
            Experience Years
          </label>
          <input
            id="experienceYears"
            name="experienceYears"
            type="number"
            value={formData.experienceYears}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required
          />
          {formErrors.experienceYears && (
            <p className="mt-1 text-sm text-red-600">{formErrors.experienceYears}</p>
          )}
        </div>

        {/* Experience Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="experienceLevel">
            Experience Level
          </label>
          <select
            id="experienceLevel"
            name="experienceLevel"
            value={formData.experienceLevel}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select experience level</option>
            <option value="entry">Entry</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
          {formErrors.experienceLevel && (
            <p className="mt-1 text-sm text-red-600">{formErrors.experienceLevel}</p>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="location">
            Location
          </label>
          <input
            id="location"
            name="location"
            type="text"
            value={formData.location}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            required
          />
          {formErrors.location && (
            <p className="mt-1 text-sm text-red-600">{formErrors.location}</p>
          )}
        </div>

        {/* Salary Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="salaryType">
            Salary Type
          </label>
          <select
            id="salaryType"
            name="salaryType"
            value={formData.salaryType}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="fixed">Fixed Salary</option>
            <option value="range">Salary Range</option>
            <option value="discutable">Negotiable</option>
          </select>
        </div>

        {/* Salary Fields */}
        {formData.salaryType === 'fixed' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="salaryFixed">
              Salary Amount
            </label>
            <input
              id="salaryFixed"
              name="salaryFixed"
              type="number"
              value={formData.salaryFixed}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              required
            />
            {formErrors.salaryFixed && (
              <p className="mt-1 text-sm text-red-600">{formErrors.salaryFixed}</p>
            )}
          </div>
        )}
        {formData.salaryType === 'range' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="salaryMin">
                Minimum Salary
              </label>
              <input
                id="salaryMin"
                name="salaryMin"
                type="number"
                value={formData.salaryMin}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="salaryMax">
                Maximum Salary
              </label>
              <input
                id="salaryMax"
                name="salaryMax"
                type="number"
                value={formData.salaryMax}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            {formErrors.salaryRange && (
              <p className="col-span-2 mt-1 text-sm text-red-600">{formErrors.salaryRange}</p>
            )}
          </div>
        )}

        {/* Submit & Cancel Buttons */}
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
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {(isSubmitting || loading) ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                Updating...
              </>
            ) : (
              'Update Job'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UpdateJob;
