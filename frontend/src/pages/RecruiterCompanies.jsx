import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getRecruiterCompanies } from "../store/companySlice";
import CompanyCard from "../components/CompanyCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button"; // adjust path as needed

const RecruiterCompanies = () => {
  const dispatch = useDispatch();
  const { companies, isLoading, error } = useSelector((state) => state.company);
  const { recruiterId } = useParams();
  const { user } = useSelector((state) => state.auth);

  // Use recruiterId from params or fallback to the logged-in user's id.
  const targetRecruiterId = recruiterId || user?._id;
  const isOwner = user?.role === "recruiter" && user?._id === targetRecruiterId;

  useEffect(() => {
    if (targetRecruiterId) {
      dispatch(getRecruiterCompanies(targetRecruiterId));
    }
  }, [dispatch, targetRecruiterId]);

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="rounded-lg shadow-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">
            {isOwner ? "Your Companies" : "Registered Companies"}
          </h2>
          {isOwner && companies?.length > 0 && (
            <Button asChild variant="default" size="lg" className="text-base">
              <Link to="/company-register">Add New Company</Link>
            </Button>
          )}
        </div>

        {error && <p className="text-red-500">{error}</p>}

        {companies?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {companies.map((company) => (
              <CompanyCard key={company._id} company={company} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="mb-4">
              {isOwner
                ? "You haven't registered any companies yet."
                : "This recruiter hasn't registered any companies yet."}
            </p>
            {isOwner && (
              <Button asChild variant="default" size="lg" className="text-base">
                <Link to="/company-register">Register your first Company</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruiterCompanies;
