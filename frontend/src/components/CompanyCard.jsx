/* eslint-disable react/prop-types */
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { deleteCompany } from '../store/companySlice';
import { Globe, MapPin, Pencil, Trash2, X } from 'lucide-react';

const CompanyCard = ({ company }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  // Check if the current user is the recruiter owner of this company
  const isOwner = user?.role === 'recruiter' && user?._id === company.userId;
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await dispatch(deleteCompany(company._id)).unwrap();
      // The company list will be automatically updated through Redux
    } catch (error) {
      console.error('Error deleting company:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative h-32 bg-gradient-to-r from-blue-500 to-blue-600">
          {company.logo && (
            <div className="absolute -bottom-10 left-4">
              <img
                src={company.logo}
                alt={`${company.name} logo`}
                className="w-20 h-20 rounded-lg border-4 border-white bg-white object-contain"
              />
            </div>
          )}
        </div>

        <div className={`p-4 ${company.logo ? 'pt-12' : 'pt-4'}`}>
          <div className="flex justify-between items-start">
            <h3 className="text-xl font-semibold text-gray-900 truncate">
              {company.name}
            </h3>
            {isOwner && (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/update-company/${company._id}`)}
                  className="p-1 text-gray-600 hover:text-blue-600 rounded-full hover:bg-blue-50"
                  title="Edit company"
                >
                  <Pencil className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="p-1 text-gray-600 hover:text-red-600 rounded-full hover:bg-red-50"
                  title="Delete company"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-2 space-y-2 text-gray-600">
            {company.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">{company.location}</span>
              </div>
            )}
            {company.website && (
              <div className="flex items-center gap-1">
                <Globe className="h-4 w-4" />
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline truncate"
                >
                  {company.website}
                </a>
              </div>
            )}
          </div>

          <div className="mt-4">
            <button
              onClick={() => navigate(`/company/${company._id}`)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View Details →
            </button>
          </div>
        </div>
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
              Are you sure you want to delete {company.name}? This action cannot be undone.
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
    </>
  );
};

export default CompanyCard;
