/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Loader2, Briefcase, User, FileText } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { getJobsByRecruiter } from '../store/jobSlice';

const UserProfile = () => {
  const { id } = useParams(); // ID of the profile being viewed
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  // State for recruiter companies (full details)
  const [recruiterCompanies, setRecruiterCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState('');

  // Get the logged-in user from Redux
  const { user: currentUser } = useSelector((state) => state.auth);

  // Get recruiter jobs from the job slice
  const { jobs: recruiterJobs, loading: jobsLoading, error: jobsError } = useSelector((state) => state.job);

  // Fetch the user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axiosInstance.get(`/user/profile/${id}`);
        setUserProfile(response.data.user.profile);
      } catch (err) {
        setProfileError(err.response?.data?.message || 'Error fetching profile');
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  // If the profile belongs to a recruiter (assumed by having a companies field), fetch companies
  useEffect(() => {
    if (userProfile && userProfile.companies) {
      setCompaniesLoading(true);
      axiosInstance
        .get(`/company/companies/${id}`)
        .then(response => {
          setRecruiterCompanies(response.data.companies);
          setCompaniesLoading(false);
        })
        .catch(err => {
          setCompaniesError(err.response?.data?.message || 'Error fetching companies');
          setCompaniesLoading(false);
        });
    }
  }, [userProfile, id]);

  // If the profile belongs to a recruiter, fetch their job postings
  useEffect(() => {
    if (userProfile && userProfile.companies) {
      // We assume a recruiter profile includes a companies field.
      dispatch(getJobsByRecruiter(id));
    }
  }, [dispatch, userProfile, id]);

  if (profileLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (profileError) {
    return <div className="text-center text-red-600 p-4">{profileError}</div>;
  }

  if (!userProfile) return null;

  // Inline JobCard component for displaying each job posting
  const JobCard = ({ job }) => {
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

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="bg-white shadow rounded p-6 mt-4">
        {/* Edit Profile Button: Only if the current user owns this profile */}
        {currentUser && currentUser._id === id && (
          <div className="text-right mb-4">
            <button
              onClick={() =>
                navigate(
                  currentUser.role === 'recruiter'
                    ? '/recruiter-profile-update'
                    : '/candidate-profile-update'
                )
              }
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200"
            >
              Edit Profile
            </button>
          </div>
        )}

        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
            {userProfile.profilePicture ? (
              <img 
                src={userProfile.profilePicture} 
                alt="Profile" 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User size={40} className="text-gray-400" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {userProfile.firstName} {userProfile.lastName}
            </h1>
          </div>
        </div>

        {/* About Section */}
        {userProfile.description && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">About</h2>
            <p className="text-gray-700">{userProfile.description}</p>
          </div>
        )}

        {/* Skills Section */}
        {userProfile.skills?.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {userProfile.skills.map((skill, index) => (
                <span 
                  key={index}
                  className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recruiter Companies Section */}
        {userProfile.companies && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Briefcase size={20} /> Companies
            </h2>
            {companiesLoading ? (
              <div className="flex justify-center items-center h-16">
                <Loader2 className="animate-spin h-6 w-6" />
              </div>
            ) : companiesError ? (
              <div className="text-red-600">{companiesError}</div>
            ) : recruiterCompanies.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recruiterCompanies.map(company => (
                  <div 
                    key={company._id}
                    className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-100 rounded"
                    onClick={() => navigate(`/company/${company._id}`)}
                  >
                    {company.logo && (
                      <img 
                        src={company.logo} 
                        alt={`${company.name} logo`} 
                        className="w-12 h-12 object-contain"
                      />
                    )}
                    <div>
                      <h3 className="font-medium">{company.name}</h3>
                      <p className="text-sm text-gray-600">{company.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No companies registered.</p>
            )}
          </div>
        )}

        {/* Recruiter Jobs Section */}
        {userProfile.companies && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Job Postings</h2>
            {jobsLoading ? (
              <div className="flex justify-center items-center h-16">
                <Loader2 className="animate-spin h-6 w-6" />
              </div>
            ) : jobsError ? (
              <div className="text-red-600">{jobsError}</div>
            ) : recruiterJobs && recruiterJobs.length > 0 ? (
              <div className="grid gap-4">
                {recruiterJobs.map(job => (
                  <JobCard key={job._id} job={job} />
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No job postings yet.</p>
            )}
          </div>
        )}

        {/* Resume Section */}
        {userProfile.resume && (
          <div className="mt-6">
            <a
              href={userProfile.resume}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <FileText size={20} /> View Resume
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;
