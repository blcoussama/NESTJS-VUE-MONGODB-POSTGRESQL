/* eslint-disable react/prop-types */
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { deleteCompany, getRecruiterCompanies } from "../store/companySlice";
import { Globe, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";

// Shadcn UI components
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

const CompanyCard = ({ company }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // Check if the current user is the recruiter owner of this company
  const isOwner = user?.role === "recruiter" && user?._id === company.userId;
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await dispatch(deleteCompany(company._id)).unwrap();
      // Force a refresh of the companies list
      dispatch(getRecruiterCompanies(company.userId));
    } catch (error) {
      console.error("Error deleting company:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="relative hover:shadow-lg transition-shadow">
      <CardHeader className="relative h-32 bg-gradient-to-r from-background to-muted rounded-t-xl">
        {company.logo && (
          <div className="absolute -bottom-14 left-4">
            <img
              src={company.logo}
              alt={`${company.name} logo`}
              className="w-36 h-26 rounded-sm border px-4 py-3 object-contain"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className={company.logo ? "pt-12" : "pt-4"}>
        <div className="flex justify-between items-start mt-4">
          <CardTitle className="text-2xl font-semibold truncate">
            {company.name}
          </CardTitle>
          {isOwner && (
            <div className="flex gap-2">
              <Button
              className="cursor-pointer"
                variant="outline"
                onClick={() => navigate(`/update-company/${company._id}`)}
                title="Edit company"
              >
                <Pencil className="h-5 w-5" />
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" title="Delete company" className="cursor-pointer">
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-5 w-5" />
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Delete</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete {company.name}? This action cannot be undone.
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

        <div className="mt-2 space-y-2 mb-16">
          {company.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span className="text-base">{company.location}</span>
            </div>
          )}
          {company.website && (
            <div className="flex items-center gap-1">
              <Globe className="h-4 w-4" />
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base hover:underline text-blue-500 truncate underline hover:text-blue-400"
              >
                {company.website}
              </a>
            </div>
          )}
        </div>
      </CardContent>
      {/* Absolute positioned "View Details" button */}
      <Button
      size="lg"
        variant="secondary"
        onClick={() => navigate(`/company/${company._id}`)}
        className="absolute bottom-5 right-5 text-[17px] cursor-pointer"
      >
        View Details
      </Button>
    </Card>
  );
};

export default CompanyCard;
