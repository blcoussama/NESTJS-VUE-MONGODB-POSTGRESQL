import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getRecruiterCompanies } from '../store/companySlice';
import CompanyCard from '../components/CompanyCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useParams, useNavigate } from 'react-router-dom';

const SelectCompanyForJob = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { recruiterId } = useParams();
  const { companies, isLoading, error } = useSelector((state) => state.company);

  useEffect(() => {
    if (recruiterId) {
      dispatch(getRecruiterCompanies(recruiterId));
    }
  }, [dispatch, recruiterId]);

  const handleCompanySelect = (companyId) => {
    // Navigate to the PostJob page with the selected companyId in the URL
    navigate(`/post-job/${companyId}`);
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white text-gray-900 rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">
          Select a Company for Posting a New Job
        </h2>
        {error && <p className="text-red-500">{error}</p>}
        {companies && companies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {companies.map((company) => (
              <div
                key={company._id}
                className="cursor-pointer"
                onClick={() => handleCompanySelect(company._id)}
              >
                <CompanyCard company={company} />
              </div>
            ))}
          </div>
        ) : (
          <p>
            {`You haven't registered any companies yet. Please register a company first.`}
          </p>
        )}
      </div>
    </div>
  );
};

export default SelectCompanyForJob;
