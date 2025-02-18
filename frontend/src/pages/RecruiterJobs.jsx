/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getJobsByRecruiter, deleteJob } from "../store/jobSlice";
import { Trash2, Users, MapPin, Pencil, Clock } from "lucide-react";
// Shadcn UI components
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Badge } from "@/components/ui/badge";

const RecruiterJobs = () => {
  const dispatch = useDispatch();
  const { recruiterId } = useParams();
  const { user } = useSelector((state) => state.auth);
  const { jobs, loading, error } = useSelector((state) => state.job);
  const [deletingId, setDeletingId] = useState(null);

  // Check if current user is the owner
  const isOwner = user?.role === "recruiter" && user?._id === recruiterId;

  useEffect(() => {
    if (recruiterId) {
      dispatch(getJobsByRecruiter(recruiterId));
    }
  }, [dispatch, recruiterId]);

  const handleDelete = async (jobId) => {
    try {
      setDeletingId(jobId);
      await dispatch(deleteJob(jobId)).unwrap();
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setDeletingId(null);
    }
  };

  // Inline Job Card using shadcn UI components
  const JobCard = ({ job, onDelete, isDeleting, isOwner }) => {
    const navigate = useNavigate();
    return (
      <Card
        className="rounded-lg shadow-md p-6 relative hover:shadow-lg transition-shadow cursor-pointer"
        onClick={(e) => {
          if (!e.target.closest("button")) {
            navigate(`/jobs/${job._id}`);
          }
        }}
      >
        <CardHeader className="">
          {/* Title and action buttons row */}
          <div className="flex justify-between items-center">
            <div className="flex justify-center items-center gap-5">
              <CardTitle className="text-3xl font-semibold capitalize">
                {job.title} 
              </CardTitle>
              <div className="mt-1">
                <Badge
                  variant={job.isOpen ? "open" : "closed"}
                  className="text-sm px-3 py-1 tracking-wider"
                  >
                  {job.isOpen ? "OPEN" : "CLOSED"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-4 mb-4 ml-4">
                <Clock className="h-6 w-6 text-gray-400" />
                <p className="text-base text-gray-400">
                  Posted on {new Date(job.createdAt).toLocaleDateString()}
                </p>
              </div>
          </div>
            
            {isOwner && (
              <div className="flex gap-4">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/update-job/${job._id}/from/${job.company}`);
                  }}
                  title="Edit"
                  className="cursor-pointer"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline text-base">Edit</span>
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="lg"
                      onClick={(e) => e.stopPropagation()}
                      title="Delete"
                      disabled={isDeleting}
                      className="cursor-pointer"
                    >
                      <Trash2 size={18} className="mr-2" />
                      <span className="hidden sm:inline text-base">Delete</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <DialogHeader>
                      <DialogTitle>Confirm Delete</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to delete this job posting? This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button variant="destructive" onClick={() => onDelete(job._id)}>
                        {isDeleting ? "Deleting..." : "Delete"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </div>
          {/* Company Info Row */}
          <p className="text-lg">
              At {job.company?.name || "Unknown Company"}
          </p>
          <div className="mt-4">
            {job.company?.logo ? (
              <img
                src={job.company.logo}
                alt={`${job.company.name} logo`}
                className="w-30 object-contain"
              />
            ) : (
              <div className="flex items-center justify-center rounded bg-gray-200/50 border-1 border-gray-200 p-2 dark:bg-gray-700/20 dark:border-gray-600 shadow-md max-w-[200px]">
                <span className="text-lg uppercase font-semibold text-gray-400 opacity-75 dark:text-gray-300">
                  No Company Logo
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-10 text-lg">
            <div className="flex items-center">
              <MapPin className="h-6 w-6 mr-1" />
              <span>{job.location}</span>
            </div>
            <div className="flex items-center">
              <Users className="h-6 w-6 mr-1" />
              <span>{job.applications?.length || 0} Applications</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <div className="rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            {isOwner ? "Your Job Postings" : "Job Postings"}
          </h1>
          {isOwner && (
            <Button asChild variant="default" size="lg" className="text-base">
              <Link to={`/select-company-for-job/${recruiterId}`}>
                Post New Job
              </Link>
            </Button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        )}

        {error && <div className="text-red-600 p-4">{error}</div>}

        <div className="grid gap-4">
          {jobs?.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              onDelete={handleDelete}
              isDeleting={deletingId === job._id}
              isOwner={isOwner}
            />
          ))}
        </div>

        {!loading && jobs?.length === 0 && (
          <div className="text-center py-8">
            {isOwner
              ? "You haven't posted any jobs yet."
              : "No job postings available."}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruiterJobs;
