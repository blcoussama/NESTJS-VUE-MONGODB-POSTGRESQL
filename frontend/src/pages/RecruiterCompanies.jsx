import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getRecruiterCompanies } from '../store/companySlice';
import CompanyCard from '../components/CompanyCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useParams } from 'react-router-dom';

const RecruiterCompanies = () => {
  const dispatch = useDispatch();
  const { companies, isLoading, error } = useSelector((state) => state.company);
  const { recruiterId } = useParams();
  const { user } = useSelector((state) => state.auth);

  // Determine if the current user is the owner of the companies (i.e., the recruiter whose ID is in the URL)
  const isOwner = user?.role === 'recruiter' && user?._id === recruiterId;

  useEffect(() => {
    if (recruiterId) {
      dispatch(getRecruiterCompanies(recruiterId));
    }
  }, [dispatch, recruiterId]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white text-gray-900 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">
          {isOwner ? 'Your Companies' : 'Registered Companies'}
        </h2>
        {error && <p className="text-red-500">{error}</p>}
        {companies && companies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {companies.map((company) => (
              <CompanyCard key={company._id} company={company} />
            ))}
          </div>
        ) : (
          <p>
            {isOwner
              ? "You haven't registered any companies yet."
              : "This recruiter hasn't registered any companies yet."}
          </p>
        )}
      </div>
    </div>
  );
};

export default RecruiterCompanies;
