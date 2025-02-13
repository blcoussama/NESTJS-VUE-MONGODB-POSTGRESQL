import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { registerCompany, clearError, clearMessage } from '../store/companySlice';
import { useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';

const RegisterCompany = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error, message } = useSelector((state) => state.company);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    website: '',
    location: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Clear error and message on unmount
  useEffect(() => {
    return () => {
      dispatch(clearError());
      dispatch(clearMessage());
    };
  }, [dispatch]);

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Company name is required';
    }
    if (!formData.location.trim()) {
      errors.location = 'Location is required';
    }
    if (formData.website && !formData.website.trim().match(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)) {
      errors.website = 'Please enter a valid website URL';
    }
    if (logoFile && logoFile.size > 5 * 1024 * 1024) {
      errors.logo = 'Logo file size must be less than 5MB';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field if it exists
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors(prev => ({
          ...prev,
          logo: 'File size must be less than 5MB'
        }));
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setFormErrors(prev => ({
          ...prev,
          logo: 'Please upload only JPG, PNG, or WebP images'
        }));
        return;
      }

      setLogoFile(file);
      setLogoPreviewUrl(URL.createObjectURL(file));
      // Clear logo error if exists
      setFormErrors(prev => ({
        ...prev,
        logo: ''
      }));
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreviewUrl('');
    // Clear logo error if exists
    setFormErrors(prev => ({
      ...prev,
      logo: ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key].trim()) {
          formDataToSend.append(key, formData[key].trim());
        }
      });
      
      if (logoFile) {
        formDataToSend.append('logo', logoFile);
      }

      await dispatch(registerCompany(formDataToSend)).unwrap();
      navigate('/recruiter-dashboard');
    } catch (err) {
      console.error('Error registering company:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6 md:p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Register Your Company</h2>
          <p className="mt-2 text-gray-600">Add your company details to get started</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600">{message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="name">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleInputChange}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                ${formErrors.name ? 'border-red-300' : 'border-gray-300'}`}
            />
            {formErrors.name && (
              <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows="4"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Tell us about your company..."
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="website">
              Website
            </label>
            <input
              id="website"
              name="website"
              type="url"
              value={formData.website}
              onChange={handleInputChange}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                ${formErrors.website ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="https://example.com"
            />
            {formErrors.website && (
              <p className="mt-1 text-sm text-red-600">{formErrors.website}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="location">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              id="location"
              name="location"
              type="text"
              value={formData.location}
              onChange={handleInputChange}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm
                ${formErrors.location ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="City, Country"
            />
            {formErrors.location && (
              <p className="mt-1 text-sm text-red-600">{formErrors.location}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Company Logo
            </label>
            <div className="mt-1 flex items-center space-x-4">
              {logoPreviewUrl ? (
                <div className="relative">
                  <img 
                    src={logoPreviewUrl} 
                    alt="Logo Preview" 
                    className="h-20 w-20 object-contain rounded border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full hover:bg-red-200"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              ) : (
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleLogoChange}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                      file:rounded-md file:border-0 file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    JPG, PNG or WebP (MAX. 5MB)
                  </p>
                </div>
              )}
            </div>
            {formErrors.logo && (
              <p className="mt-1 text-sm text-red-600">{formErrors.logo}</p>
            )}
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/recruiter-dashboard')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {(isSubmitting || isLoading) ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Registering...
                </>
              ) : (
                'Register Company'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterCompany;