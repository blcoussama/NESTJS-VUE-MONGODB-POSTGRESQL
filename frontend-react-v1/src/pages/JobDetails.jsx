import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, Link, useNavigate } from "react-router-dom";
import { viewJob, clearJob, deleteJob } from "../store/jobSlice";
import { saveJob as saveJobAction, unsaveJob, getSavedJobs } from "../store/savedJobSlice";
import { getJobApplications } from "../store/applicationSlice"; // Import for refreshing applications
import JobApplications from "../components/JobApplications";
import {
  Trash2,
  Pencil,
  User,
  BookmarkIcon,
  ArrowLeft,
  Building2,
  MapPin,
  DollarSign,
  Briefcase,
  Calendar,
  Users,
  RefreshCw, // Import refresh icon
} from "lucide-react";
import axiosInstance from "../utils/axiosInstance";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import LoadingSpinner from "@/components/LoadingSpinner";
import moment from "moment";

const JobDetails = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { job, loading, error } = useSelector((state) => state.job);
  const { user } = useSelector((state) => state.auth);
  const { savedJobs } = useSelector((state) => state.savedJob);

  const [isDeleting, setIsDeleting] = useState(false);
  const [recruiterProfile, setRecruiterProfile] = useState(null);
  const [savingJobs, setSavingJobs] = useState(new Set());
  const [refreshingApplications, setRefreshingApplications] = useState(false);

  useEffect(() => {
    dispatch(viewJob(id));
    return () => dispatch(clearJob());
  }, [dispatch, id]);

  useEffect(() => {
    dispatch(getSavedJobs());
  }, [dispatch]);

  useEffect(() => {
    const fetchRecruiterProfile = async () => {
      if (job?.created_by) {
        try {
          const response = await axiosInstance.get(`/user/profile/${job.created_by}`);
          setRecruiterProfile(response.data.user.profile);
        } catch (error) {
          console.error("Error fetching recruiter profile:", error);
        }
      }
    };

    if (job) fetchRecruiterProfile();
  }, [job]);

  const isJobSaved = () =>
    savedJobs?.some((savedJob) => savedJob.job._id === job._id);

  const handleSaveToggle = async (e) => {
    e.stopPropagation();
    try {
      setSavingJobs((prev) => new Set(prev).add(job._id));
      if (isJobSaved()) {
        await dispatch(unsaveJob(job._id)).unwrap();
      } else {
        const result = await dispatch(saveJobAction(job._id)).unwrap();
        if (result.success) {
          dispatch(getSavedJobs());
        }
      }
    } catch (error) {
      console.error("Error toggling save:", error);
    } finally {
      setSavingJobs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(job._id);
        return newSet;
      });
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await dispatch(deleteJob(id)).unwrap();
      navigate("/recruiter-jobs");
    } catch (error) {
      console.error("Delete job failed:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // New function to refresh job applications
  const handleRefreshApplications = async () => {
    setRefreshingApplications(true);
    try {
      await dispatch(getJobApplications(job._id));
    } catch (error) {
      console.error("Failed to refresh applications:", error);
    } finally {
      setRefreshingApplications(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-100">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-600 p-4">Error: {error}</div>;
  }

  if (!job) {
    return null;
  }

  const isJobOwner =
    user?._id === job.created_by.toString() && user?.role === "recruiter";

  const validRequirements = job.requirements
    ? job.requirements.filter((req) => req.trim() !== "")
    : [];

  const candidateHasApplied =
    user?.role === "candidate" &&
    job.applications &&
    job.applications.some((application) => {
      if (typeof application === "object" && application.applicant) {
        return application.applicant.toString() === user._id.toString();
      }
      return false;
    });

  return (
    <div className="container px-4 mt-10">
      <Button variant="secondary" size="lg" asChild className="mb-6">
        <Link to="/jobs" className="flex items-center text-[17px]">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Job Listings
        </Link>
      </Button>
      
      <Card className="shadow-lg rounded-lg overflow-hidden">
        <CardHeader className="relative pb-0">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl font-bold mb-10 capitalize flex justify-center">
                {job.title}
                <Badge
                  variant={job.isOpen ? "open" : "closed"}
                  className="ml-6 text-sm px-3 py-1 tracking-wider"
                >
                  {job.isOpen ? "OPEN" : "CLOSED"}
                </Badge>
              </CardTitle>
              <CardDescription className="text-lg">
                <Link to={`/company/${job.company?._id}`} className="flex items-center">  
                  <Building2 className="mr-3 h-6 w-6 text-gray-600 dark:text-gray-300" />
                  At
                  <Button variant="secondary" className="cursor-pointer ml-3 hover:underline">
                    <p className="text-xl capitalize">{job.company?.name}</p>
                  </Button>
                </Link>
              </CardDescription>
            </div>

            <div className="flex gap-10">
              {!isJobOwner && user && (
                <Button
                  variant="secondary"
                  size="savebutton"
                  onClick={handleSaveToggle}
                  disabled={savingJobs.has(job._id)}
                  className="top-4 right-4 !w-auto !min-w-0 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <BookmarkIcon
                      size={28}
                      style={{ width: "28px", height: "28px" }}
                      className={`${
                        isJobSaved() || savingJobs.has(job._id)
                          ? "fill-primary text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    />
                    {isJobSaved() && (
                      <span className="text-[17px] font-medium">Saved</span>
                    )}
                  </div>
                </Button>
              )}

              {isJobOwner && (
                <div className="top-4 right-4 flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() =>
                      navigate(`/update-job/${job._id}/from/${job.company?._id}`)
                    }
                    className="cursor-pointer"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline text-base">Edit</span>
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="lg" className="cursor-pointer">
                        <Trash2 className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline text-base">Delete</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete {job.title}? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline" className="cursor-pointer">Cancel</Button>
                        </DialogClose>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="cursor-pointer">
                          {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center">
                <MapPin className="mr-2 h-6 w-6 text-gray-600 dark:text-gray-300" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center">
                <DollarSign className="mr-2 h-6 w-6 text-gray-600 dark:text-gray-300" />
                <span className="text-xl text-emerald-500">
                  {Array.isArray(job.salary)
                    ? `${job.salary[0].toLocaleString()} - ${job.salary[1].toLocaleString()}`
                    : job.salary === "discutable"
                      ? "Negotiable"
                      : `${job.salary.toLocaleString()}`}
                </span>
              </div>
              <div className="flex items-center">
                <Briefcase className="mr-2 h-6 w-6 text-gray-600 dark:text-gray-300" />
                <span>
                  {job.experienceYears} year{job.experienceYears > 1 && "s"} -{" "}
                  {job.experienceLevel.charAt(0).toUpperCase() + job.experienceLevel.slice(1)}
                </span>
              </div>
              <div className="flex items-center">
                <Calendar className="mr-2 h-6 w-6 text-gray-600 dark:text-gray-300" />
                <p>
                  Posted on {new Date(job.createdAt).toLocaleDateString()}{" "}
                  <span className="text-sm ml-2 text-gray-600 dark:text-gray-400">
                    ({moment(job.createdAt).fromNow()})
                  </span>
                </p>
              </div>
              <div className="flex items-center">
                <Users className="mr-2 h-6 w-6 text-gray-600 dark:text-gray-300" />
                <span>
                  {job.applications?.length || 0} application{job.applications?.length !== 1 ? "s" : ""} received
                </span>
              </div>
            </div>

            <div className="space-y-4 ">
              <h3 className="text-xl font-semibold">Posted By</h3>
              <Button
                variant="secondary"
                size="recruiterIconButton"
                asChild
                className="w-full justify-start p-2 pl-4 hover:shadow-md transition-shadow"
              >
                <Link
                  to={`/profile/${job.created_by}`}
                  className="flex items-center gap-3 rounded transition-colors"
                >
                  <Avatar className="w-15 h-15 border-2 border-gray-600 rounded-full">
                    {recruiterProfile?.profilePicture ? (
                      <AvatarImage
                        src={recruiterProfile.profilePicture}
                        alt="Recruiter profile"
                      />
                    ) : (
                      <AvatarFallback className="flex items-center justify-center">
                        <User style={{ width: "40px", height: "40px" }} className="text-gray-600" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="font-medium text-lg">
                      {recruiterProfile?.firstName} {recruiterProfile?.lastName}
                    </p>
                    <p className="text-base text-muted-foreground">Recruiter</p>
                  </div>
                </Link>
              </Button>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">Job Description</h3>
              <p className="">{job.description}</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Requirements</h3>
              {validRequirements.length > 0 ? (
                <div className="flex flex-wrap gap-5">
                  {validRequirements.map((req, index) => (
                    <Badge key={index} variant="secondary" className="text-base shadow-sm px-4 py-2">
                      {req}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">No requirements.</p>
              )}
            </div>
          </div>

          {user?.role === "candidate" && (
            <div className="mt-8">
              <Button
                size="lg"
                onClick={() => navigate(`/apply/${job._id}`)}
                disabled={!job.isOpen || candidateHasApplied}
                variant={job.isOpen && !candidateHasApplied ? "default" : "outline"}
                className={`w-full capitalize text-base cursor-pointer ${
                  !job.isOpen || candidateHasApplied ? "pointer-events-none opacity-20" : ""
                }`}
              >
                {candidateHasApplied
                  ? "Already Applied"
                  : job.isOpen
                  ? "Apply Now"
                  : "Applications Closed"}
              </Button>
              {!job.isOpen && (
                <p className="mt-2 text-sm text-muted-foreground text-center">
                  This position is no longer accepting applications
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isJobOwner && (
        <Card className="mt-8">
          <CardHeader className="">
            <div className="flex justify-between items-center px-4 pr-6">
              <CardTitle className="text-2xl">Job Applications</CardTitle>
              <Button 
                onClick={handleRefreshApplications} 
                variant="outline" 
                size="lg" 
                className="flex items-center gap-2 cursor-pointer"
                disabled={refreshingApplications}
              >
                <RefreshCw className={`h-4 w-4 ${refreshingApplications ? 'animate-spin' : ''}`} />
                Refresh Applications
              </Button>
            </div>  
          </CardHeader>
          <CardContent>
            <JobApplications jobId={job._id} recruiterId={job.created_by} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default JobDetails;
