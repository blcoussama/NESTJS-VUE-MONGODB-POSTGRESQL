// src/components/ViewCompany.jsx
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { viewCompany, deleteCompany } from '../store/companySlice';
import { Loader2, Globe, MapPin, X } from 'lucide-react';
import JobsByCompany from '../components/JobsByCompany';

const CompanyDetails = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentCompany, isLoading, error } = useSelector((state) => state.company);
  const { user } = useSelector((state) => state.auth);

  // Determine if the current user is the owner (logged-in recruiter who created the company)
  const isOwner = user?.role === 'recruiter' && currentCompany && user._id === currentCompany.userId;

  // State for delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      dispatch(viewCompany(id));
    }
  }, [id, dispatch]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await dispatch(deleteCompany(id)).unwrap();
      // After deletion, navigate back to the previous page or companies list
      navigate(-1);
    } catch (err) {
      console.error('Error deleting company:', err);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p>Company not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header Section */}
        <div className="relative h-48 bg-gradient-to-r from-blue-500 to-blue-600">
          {currentCompany.logo && (
            <div className="absolute -bottom-16 left-6">
              <img
                src={currentCompany.logo}
                alt={`${currentCompany.name} logo`}
                className="w-32 h-32 rounded-lg border-4 border-white bg-white object-contain"
              />
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className={`p-6 ${currentCompany.logo ? 'pt-20' : 'pt-6'}`}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{currentCompany.name}</h1>
              <div className="mt-2 flex flex-wrap gap-4 text-gray-600">
                {currentCompany.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{currentCompany.location}</span>
                  </div>
                )}
                {currentCompany.website && (
                  <div className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    <a
                      href={currentCompany.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {currentCompany.website}
                    </a>
                  </div>
                )}
              </div>
            </div>
            {/* Render action buttons only if the user is the owner */}
            {isOwner && (
              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/update-company/${currentCompany._id}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
                >
                  Edit Company
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
                >
                  Delete Company
                </button>
              </div>
            )}
          </div>

          {currentCompany.description && (
            <div className="prose max-w-none mt-6">
              <h2 className="text-xl font-semibold text-gray-900">About</h2>
              <p className="text-gray-600">{currentCompany.description}</p>
            </div>
          )}
          {/* JobsByCompany component renders jobs associated with this company */}
          <JobsByCompany />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Back
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Delete</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {currentCompany.name}? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyDetails;
