import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Upload, Loader } from 'lucide-react';
import FormInput from '../components/FormInput';
import axiosInstance from '../utils/axiosInstance';
import { useSelector } from 'react-redux';

const CandidateProfileUpdate = () => {
  const { user: currentUser } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  // State variables for text fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');

  // State variables for file uploads
  const [profilePicture, setProfilePicture] = useState(null);
  const [resume, setResume] = useState(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState('');
  const [resumePreviewName, setResumePreviewName] = useState('');

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch existing candidate profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axiosInstance.get(`/user/profile/${currentUser._id}`);
        const profile = response.data.user.profile;
        setFirstName(profile.firstName || '');
        setLastName(profile.lastName || '');
        setDescription(profile.description || '');
        setSkills(profile.skills ? profile.skills.join(', ') : '');
        if (profile.profilePicture) {
          setProfilePreviewUrl(profile.profilePicture);
        }
        if (profile.resume) {
          const urlParts = profile.resume.split('/');
          setResumePreviewName(urlParts[urlParts.length - 1]);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching profile');
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser && currentUser._id) {
      fetchProfile();
    }
  }, [currentUser]);

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePicture(file);
      setProfilePreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setResume(file);
      setResumePreviewName(file.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('description', description);
      formData.append('skills', skills);
      if (profilePicture) {
        formData.append('profilePicture', profilePicture);
      }
      if (resume) {
        formData.append('resume', resume);
      }

      const response = await axiosInstance.put('/user/candidate-profile-update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.success) {
        navigate('/candidate-dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred during profile update');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <motion.div className="flex justify-center items-center h-64">
        <Loader className="animate-spin h-8 w-8" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md w-full bg-gray-900 bg-opacity-50 backdrop-filter backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden p-8 mx-auto mt-8"
    >
      <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-green-300 to-green-600 text-transparent bg-clip-text">
        Update Your Profile
      </h2>
      <form onSubmit={handleSubmit}>
        {/* Profile Picture Upload */}
        <div className="mb-6 flex flex-col items-center">
          <div className="w-32 h-32 rounded-full bg-gray-700 overflow-hidden mb-4">
            {profilePreviewUrl ? (
              <img
                src={profilePreviewUrl}
                alt="Profile preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User size={48} className="text-gray-400" />
              </div>
            )}
          </div>
          <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-200">
            <Upload size={20} />
            Upload Photo
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleProfilePictureChange}
            />
          </label>
        </div>

        {/* Resume Upload */}
        <div className="mb-6 flex flex-col items-center">
          <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-200">
            <Upload size={20} />
            {resumePreviewName ? `Selected: ${resumePreviewName}` : 'Upload Resume (PDF only)'}
            <input
              type="file"
              className="hidden"
              accept="application/pdf"
              onChange={handleResumeChange}
            />
          </label>
        </div>

        <FormInput
          icon={User}
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />

        <FormInput
          icon={User}
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />

        <FormInput
          icon={User}
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <FormInput
          icon={User}
          type="text"
          placeholder="Skills (comma separated)"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
        />

        {error && <p className="text-red-500 font-semibold mt-2">{error}</p>}

        <motion.button
          className="mt-5 w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition duration-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader className="animate-spin mx-auto" size={24} />
          ) : (
            "Update Profile"
          )}
        </motion.button>
      </form>
    </motion.div>
  );
};

export default CandidateProfileUpdate;
