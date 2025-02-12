import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getRecruiterCompanies } from '../store/companySlice';
import CompanyCard from '../components/CompanyCard';
import LoadingSpinner from '../components/LoadingSpinner';

const RecruiterCompanies = () => {
  const dispatch = useDispatch();
  const { companies, isLoading, error } = useSelector((state) => state.company);

  useEffect(() => {
    dispatch(getRecruiterCompanies());
  }, [dispatch]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Light card container for content */}
      <div className="bg-white text-gray-900 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Your Companies</h2>
        {error && <p className="text-red-500">{error}</p>}
        {companies && companies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {companies.map((company) => (
              <CompanyCard key={company._id} company={company} />
            ))}
          </div>
        ) : (
          <p>You haven't registered any companies yet.</p>
        )}
      </div>
    </div>
  );
};

export default RecruiterCompanies;
