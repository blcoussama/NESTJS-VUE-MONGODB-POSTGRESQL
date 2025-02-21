import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getJobsByCompany, clearError } from "../store/jobSlice";
import { useParams, useNavigate } from "react-router-dom";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import LoadingSpinner from "./LoadingSpinner";

const JobsByCompany = () => {
  const { id: companyId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { jobs, loading, error } = useSelector((state) => state.job);

  useEffect(() => {
    if (companyId) {
      dispatch(getJobsByCompany(companyId));
    }
    return () => {
      dispatch(clearError());
    };
  }, [dispatch, companyId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <LoadingSpinner widthClass="10" heightClass="10" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="text-center">
        <p>No jobs posted by this company.</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-6">Jobs at this Company</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {jobs.map((job) => (
          <Card
            key={job._id}
            onClick={() => navigate(`/jobs/${job._id}`)}
            className="cursor-pointer bg-gradient-to-r from-background to-muted duration-200 hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <CardTitle className="text-xl font-semibold capitalize">{job.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="">
                {job.description.length > 80
                  ? `${job.description.substring(0, 80)}...`
                  : job.description}
              </p>
              <p className="text-sm">
                <span className="text-base font-semibold">Experience : </span> {job.experienceYears} {job.experienceYears > 1 ? "years" : "year"}, {job.experienceLevel}
              </p>
              <p className="text-sm"><span className="text-base font-semibold">Location : </span> {job.location}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default JobsByCompany;
