import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getAllJobs } from "../store/jobSlice";
import { saveJob, unsaveJob, getSavedJobs } from "../store/savedJobSlice";
import { useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  BriefcaseIcon,
  DollarSign,
  CheckCircle2,
  BookmarkIcon,
} from "lucide-react";

// Import shadcn UI components (adjust paths as needed)
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import LoadingSpinner from "@/components/LoadingSpinner";

const JobListing = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { jobs, loading, error, totalPages, currentPage } = useSelector(
    (state) => state.job
  );
  const { savedJobs } = useSelector((state) => state.savedJob);
  const { user } = useSelector((state) => state.auth);
  const [savingJobs, setSavingJobs] = useState(new Set());

  const [filters, setFilters] = useState({
    search: "",
    location: "",
    experienceLevel: "",
    salary: "",
    salaryMin: "",
    salaryMax: "",
    page: 1,
  });

  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    dispatch(getAllJobs(debouncedFilters));
  }, [dispatch, debouncedFilters]);

  useEffect(() => {
    dispatch(getSavedJobs());
  }, [dispatch]);

  // Helper to check if a job is saved
  const isJobSaved = (jobId) => {
    return savedJobs?.some((savedJob) => savedJob.job._id === jobId);
  };

  const handleSaveToggle = async (jobId) => {
    try {
      setSavingJobs((prev) => new Set(prev).add(jobId));
      if (isJobSaved(jobId)) {
        await dispatch(unsaveJob(jobId)).unwrap();
      } else {
        const result = await dispatch(saveJob(jobId)).unwrap();
        if (result.success) {
          dispatch(getSavedJobs());
        }
      }
    } catch (error) {
      console.error("Failed to toggle job save:", error);
    } finally {
      setSavingJobs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      page: 1,
    }));
  };

  // For the shadcn UI Select, we use onValueChange. We'll treat "all" as the "any" option.
  const handleSelectChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value === "all" ? "" : value,
      page: 1,
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters((prev) => ({
      ...prev,
      page: newPage,
    }));
  };

  const formatSalary = (salary) => {
    if (Array.isArray(salary)) {
      return `${salary[0].toLocaleString()} - ${salary[1].toLocaleString()}`;
    }
    if (salary === "discutable") {
      return "Negotiable";
    }
    return `${salary.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen p-8 pt-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" />
              <Input
                type="text"
                name="search"
                value={filters.search}
                onChange={handleFilterChange}
                placeholder="Search jobs..."
                className="pl-10 w-full h-10"
              />
            </div>

            {/* Location Input */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" />
              <Input
                type="text"
                name="location"
                value={filters.location}
                onChange={handleFilterChange}
                placeholder="Location..."
                className="pl-10 w-full h-10"
              />
            </div>

            {/* Experience Level Select */}
            <div className="relative">
              <BriefcaseIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" />
              <Select
                value={filters.experienceLevel || "all"}
                onValueChange={(value) =>
                  handleSelectChange("experienceLevel", value)
                }
              >
                <SelectTrigger className="pl-10 w-full h-10">
                  <SelectValue placeholder="Any Experience Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Experience Level</SelectItem>
                  <SelectItem value="entry">Entry</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Salary Select */}
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" />
              <Select
                value={filters.salary || "all"}
                onValueChange={(value) => handleSelectChange("salary", value)}
              >
                <SelectTrigger className="pl-10 w-full h-10">
                  <SelectValue placeholder="Any Salary" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Salary</SelectItem>
                  <SelectItem value="discutable">Negotiable</SelectItem>
                  <SelectItem value="range">Specify Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Salary Range Inputs */}
          {filters.salary === "range" && (
            <div className="mt-4 flex gap-4">
              <Input
                type="number"
                name="salaryMin"
                value={filters.salaryMin}
                onChange={handleFilterChange}
                placeholder="Min Salary"
                className="flex-1 h-10 px-3"
              />
              <Input
                type="number"
                name="salaryMax"
                value={filters.salaryMax}
                onChange={handleFilterChange}
                placeholder="Max Salary"
                className="flex-1 h-10 px-3"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center text-red-600 p-4">{error}</div>
        ) : jobs.length === 0 ? (
          <div className="text-center p-4">
            No jobs found matching your criteria
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <Card
                key={job._id}
                className="rounded-lg shadow-md bg-gradient-to-tl from-background to-muted duration-200 flex flex-col relative"
              >
                <div className="flex justify-between items-start mb-4 px-6 pt-6">
                  <div>
                    <h3 className="text-2xl font-semibold capitalize">
                      {job.title}
                    </h3>
                    <p className="mt-1">At {job.company?.name}</p>
                  </div>
                  {job.company?.logo ? (
                    <img
                      src={job.company?.logo}
                      alt={`${job.company?.name} logo`}
                      className="h-12 w-24 object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center rounded bg-gray-200/50 border border-gray-200 p-2 dark:bg-gray-700/20 dark:border-gray-600 shadow-md">
                      <span className="text-lg uppercase font-semibold text-gray-400 opacity-75 dark:text-gray-300">
                        No Logo
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-sm mb-4 px-6">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    {job.location}
                  </div>
                  <div className="flex items-center">
                    <BriefcaseIcon className="h-4 w-4 mr-1" />
                    {job.experienceLevel.charAt(0).toUpperCase() +
                      job.experienceLevel.slice(1)}
                  </div>
                </div>

                <div className="mb-4 px-6">
                  <div className="flex items-center mb-4 text-emerald-500 text-lg">
                    <DollarSign className="h-5 w-5 mr-1" />
                    {formatSalary(job.salary)}
                  </div>

                  <h4 className="text-sm font-semibold mb-2">
                    Requirements:
                  </h4>
                  <ul className="space-y-2">
                    {job.requirements?.slice(0, 3).map((req, index) => (
                      <li key={index} className="flex items-start text-sm">
                        <CheckCircle2 className="h-4 w-4 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                    {job.requirements?.length > 3 && (
                      <li className="text-sm italic">
                        +{job.requirements.length - 3} more requirements
                      </li>
                    )}
                  </ul>
                </div>

                <div className="mt-auto flex items-center justify-center px-4 py-4 gap-8">
                  <Button
                    onClick={() => navigate(`/jobs/${job._id}`)}
                    variant="default"
                    className="w-full cursor-pointer"
                  >
                    View Details
                  </Button>
                  {!(
                    user?.role === "recruiter" &&
                    user?._id === job.created_by
                  ) && (
                    <Button
                      variant="secondary"
                      size="saveButtonJobLiting"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveToggle(job._id);
                      }}
                      disabled={savingJobs.has(job._id)}
                      className="top-4 right-4 rounded-md transition-colors duration-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <BookmarkIcon
                          size={24}
                          style={{ width: '24px', height: '24px' }}
                          className={`h-10 w-10${
                            isJobSaved(job._id) || savingJobs.has(job._id)
                              ? "fill-primary text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        />
                      </div>
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                onClick={() => handlePageChange(page)}
                variant={currentPage === page ? "default" : "outline"}
              >
                {page}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobListing;
