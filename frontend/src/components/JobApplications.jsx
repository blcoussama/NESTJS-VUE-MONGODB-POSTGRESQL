/* eslint-disable react/prop-types */
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getJobApplications, acceptApplication, rejectApplication, clearJobApplications } from "../store/applicationSlice";
import moment from "moment";
import { Clock, FileText, User } from "lucide-react";
import { Link } from "react-router-dom";
// Shadcn UI components for Card and Button
import { Card,CardContent, CardFooter } from "@/components/ui/card";
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
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import LoadingSpinner from "./LoadingSpinner";

const JobApplications = ({ jobId, recruiterId }) => {
  const dispatch = useDispatch();
  const { jobApplications, loading, error } = useSelector((state) => state.application);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (user?._id === recruiterId && user?.role === "recruiter") {
      dispatch(getJobApplications(jobId));
    }
    return () => {
      dispatch(clearJobApplications());
    };
  }, [dispatch, jobId, recruiterId, user]);

  const handleAccept = async (applicationId) => {
    await dispatch(acceptApplication(applicationId));
    dispatch(getJobApplications(jobId));
  };

  const handleReject = async (applicationId) => {
    await dispatch(rejectApplication(applicationId));
    dispatch(getJobApplications(jobId));
  };

  if (user?.role !== "recruiter" || user?._id !== recruiterId) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <LoadingSpinner widthClass="w-10" heightClass="h-10" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 text-center">Error: {error}</div>
    );
  }
  
  // Sort applications by creation date (newest first)
  const sortedApplications = [...jobApplications].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <div className="mt-4">
      {sortedApplications.length === 0 ? (
        <p className="">No applications yet.</p>
      ) : (
        <div className="space-y-4">
          {sortedApplications.map((application) => (
            <Card key={application._id} className="shadow rounded-sm p-4 pt-8">
              <div className="flex justify-between items-start mb-2 pl-6 pr-4">
                <div className="">
                    <div className="flex items-center gap-3">
                        <Button
                          variant="secondary"
                          size="recruiterIconButton"
                          asChild
                          className="w-full justify-start p-6 hover:shadow-md transition-shadow"
                        >
                          <Link
                            to={`/profile/${application.applicant._id}`}
                            className="flex items-center gap-3 rounded transition-colors"
                          >
                            <Avatar className="w-15 h-15 border-2 border-gray-600 rounded-full">
                              {application.applicant.profile?.profilePicture ? (
                                <AvatarImage
                                  src={application.applicant.profile.profilePicture}
                                  alt="Candidate profile"
                                />
                              ) : (
                                <AvatarFallback className="flex items-center justify-center">
                                  <User style={{ width: "40px", height: "40px" }} className="text-gray-600" />
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div>
                              <p className="font-medium text-lg">
                                {application.applicant.profile?.firstName} {application.applicant.profile?.lastName}
                              </p>
                              <p className="text-base text-muted-foreground">Candidate</p>
                            </div>
                          </Link>
                        </Button>
                    </div>
                </div>

                <div>
                    {/* Status displayed at the top right */}
                    <Badge
                        className="px-2 py-1 rounded text-lg capitalize font-normal"
                        variant = {application.status === "accepted"
                            ? "accepted"
                            : application.status === "rejected"
                            ? "rejected"
                            : application.status === "withdrawn"
                            ? "withdrawn"
                            : "pending"
                        }
                    >
                    {application.status}
                    </Badge>
                </div>   
              </div>

              <CardContent className="mb-2">
                <div className="flex items-center gap-2 mt-4 mb-4">
                    <Clock className="h-6 w-6" />
                    <p className="text-base text-gray-600 dark:text-gray-400">
                    Applied {moment(application.createdAt).fromNow()}
                    </p>
                </div>
                <p className="text-lg capitalize">
                  <span className="font-medium text-xl capi">Experience : </span>{" "}
                  {application.experienceYears} {application.experienceYears > 1 ? "years" : "y ear"} (
                  {application.experienceLevel})
                </p> 
                <div className="flex flex-wrap gap-2 capitalize mt-6">
                    <span className="font-medium text-xl">Skills:</span>
                    {Array.isArray(application.skills)
                    ? application.skills.map((skill, index) => (
                        <Badge key={index} variant="pending" className="text-base">
                            {skill}
                        </Badge>
                        ))
                    : <Badge variant="pending" className="text-base">{application.skills}</Badge>}
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <Badge variant="secondary" className="py-3 px-4 shadow hover:shadow-lg transition-shadow">
                    <a
                        href={application.resume}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 text-lg flex items-center gap-2"
                        >
                        <FileText size={30} /> View Resume
                    </a>
                </Badge>
                
                {application.status === "pending" && (
                  <div className="space-x-2">
                    {/* Accept Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="default" size="lg" className="text-base cursor-pointer">
                          Accept
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <DialogHeader>
                          <DialogTitle>Confirm Accept</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to accept this application? This will reject all other pending applications.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline" className="cursor-pointer">Cancel</Button>
                          </DialogClose>
                          <Button variant="default" onClick={() => handleAccept(application._id)} className="cursor-pointer">
                            Accept
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    {/* Reject Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="lg" className="text-base cursor-pointer">
                          Reject
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <DialogHeader>
                          <DialogTitle>Confirm Reject</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to reject this application?
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline" className="cursor-pointer">Cancel</Button>
                          </DialogClose>
                          <Button variant="destructive" onClick={() => handleReject(application._id)} className="cursor-pointer">
                            Reject
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobApplications;