// CandidateApplications.jsx
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getCandidateApplications, withdrawApplication, clearCandidateApplications } from '../store/applicationSlice';
import { Loader2 } from 'lucide-react';
import moment from 'moment';;

const CandidateApplications = () => {
  const dispatch = useDispatch();
  const { candidateApplications, loading, error, message } = useSelector((state) => state.application);

  useEffect(() => {
    dispatch(getCandidateApplications());
    return () => {
      dispatch(clearCandidateApplications());
    };
  }, [dispatch]);

  const handleWithdraw = async (applicationId) => {
    if (window.confirm("Are you sure you want to withdraw your application?")) {
      await dispatch(withdrawApplication(applicationId)).unwrap();
      dispatch(getCandidateApplications());
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="animate-spin h-6 w-6" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-600 p-4">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h2 className="text-2xl font-bold mb-4">My Applications</h2>
      {message && <div className="text-green-600 mb-4">{message}</div>}
      {candidateApplications.length === 0 ? (
        <p className="text-gray-600">You have not applied for any jobs yet.</p>
      ) : (
        <div className="space-y-4">
          {candidateApplications.map((application) => (
            <div key={application._id} className="bg-white shadow rounded p-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-xl font-semibold">{application.job?.title}</h3>
                  <p className="text-gray-600">{application.job?.location}</p>
                  <p className="text-sm text-gray-500">
                    Applied {moment(application.createdAt).fromNow()}
                  </p>
                </div>
                <div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      application.status === 'accepted'
                        ? 'bg-green-100 text-green-800'
                        : application.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : application.status === 'withdrawn'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {application.status}
                  </span>
                </div>
              </div>

              <div className="mb-2">
                <p className="text-sm">
                  <span className="font-medium">Experience:</span> {application.experienceYears} year
                  {application.experienceYears > 1 ? 's' : ''} ({application.experienceLevel})
                </p>
                <p className="text-sm">
                  <span className="font-medium">Skills:</span>{' '}
                  {Array.isArray(application.skills)
                    ? application.skills.join(', ')
                    : application.skills}
                </p>
              </div>

              <div className="flex justify-end">
                {application.status === 'pending' && (
                  <button
                    onClick={() => handleWithdraw(application._id)}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CandidateApplications;
