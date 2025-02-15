/* eslint-disable react/prop-types */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getJobApplications, acceptApplication, rejectApplication, clearJobApplications } from '../store/applicationSlice';
import moment from 'moment';
import { User } from 'lucide-react';
import { Link } from 'react-router-dom';

const JobApplications = ({ jobId, recruiterId }) => {
  const dispatch = useDispatch();
  const { jobApplications, loading, error } = useSelector((state) => state.application);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (user?._id === recruiterId && user?.role === 'recruiter') {
      dispatch(getJobApplications(jobId));
    }

    return () => {
      dispatch(clearJobApplications());
    };
  }, [dispatch, jobId, recruiterId, user]);

  const handleAccept = async (applicationId) => {
    if (window.confirm('Are you sure you want to accept this application? This will reject all other pending applications.')) {
      await dispatch(acceptApplication(applicationId));
      dispatch(getJobApplications(jobId));
    }
  };

  const handleReject = async (applicationId) => {
    if (window.confirm('Are you sure you want to reject this application?')) {
      await dispatch(rejectApplication(applicationId));
      dispatch(getJobApplications(jobId));
    }
  };

  if (user?.role !== 'recruiter' || user?._id !== recruiterId) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <p>Loading applications...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 p-4">Error: {error}</div>;
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4">Applications ({jobApplications.length})</h2>
      
      {jobApplications.length === 0 ? (
        <p className="text-gray-600">No applications yet.</p>
      ) : (
        <div className="space-y-4">
          {jobApplications.map((application) => (
            <div key={application._id} className="bg-white shadow rounded p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <Link 
                    to={`/profile/${application.applicant._id}`}
                    className="hover:bg-gray-50 p-1 rounded-full"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      {application.applicant.profile?.profilePicture ? (
                        <img 
                          src={application.applicant.profile.profilePicture} 
                          alt="Candidate profile" 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <User size={20} className="text-gray-400" />
                      )}
                    </div>
                  </Link>
                  <div>
                    <h3 className="font-semibold">
                      <Link 
                        to={`/profile/${application.applicant._id}`}
                        className="hover:text-blue-600"
                      >
                        {application.applicant.profile?.firstName} {application.applicant.profile?.lastName}
                      </Link>
                    </h3>
                    <p className="text-sm text-gray-500">
                      Applied {moment(application.createdAt).fromNow()}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-sm ${
                  application.status === 'accepted' ? 'bg-green-100 text-green-800' :
                  application.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {application.status}
                </span>
              </div>

              <div className="mb-2">
                <p className="text-sm">
                  <span className="font-medium">Experience:</span> {application.experienceYears} years (
                  {application.experienceLevel})
                </p>
                <p className="text-sm">
                  <span className="font-medium">Skills:</span> {application.skills.join(', ')}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <a
                  href={application.resume}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  View Resume
                </a>

                {application.status === 'pending' && (
                  <div className="space-x-2">
                    <button
                      onClick={() => handleAccept(application._id)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleReject(application._id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobApplications;