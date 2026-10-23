import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getRecruiterCompanies } from '../store/companySlice'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapPin, Globe } from 'lucide-react'

// Shadcn UI Components
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/LoadingSpinner'

const SelectCompanyForJob = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { recruiterId } = useParams()
  const { companies, isLoading, error } = useSelector((state) => state.company)

  useEffect(() => {
    if (recruiterId) {
      dispatch(getRecruiterCompanies(recruiterId))
    }
  }, [dispatch, recruiterId])

  const handleCompanySelect = (companyId) => {
    navigate(`/post-job/${companyId}`)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="rounded-lg shadow p-6">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold mb-4">
            Select a Company for Posting a New Job
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-500">{error}</p>}
          {companies?.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {companies.map((company) => (
                <Card
                  key={company._id}
                  className="cursor-pointer hover:shadow-xl transition-shadow bg-gradient-to-br from-background to-muted p-4"
                  onClick={() => handleCompanySelect(company._id)}
                >
                  <div className="flex justify-between">
                    <div className="p-6 pt-3">
                        <h3 className="text-3xl font-semibold">
                            {company.name}
                        </h3>
                        <div className="mt-4 space-y-4">
                            {company.location && (
                                <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                <span className="text-base">{company.location}</span>
                                </div>
                            )}
                            {company.website && (
                                <div className="flex items-center gap-1">
                                <Globe className="h-4 w-4" />
                                <span className="text-base">
                                    {company.website}
                                </span>
                                </div>
                            )}
                        </div>
                    </div>
                            {company.logo && (
                      <div className="mt-2">
                        <img
                          src={company.logo}
                          alt={`${company.name} logo`}
                          className="w-32 h-20 rounded-lg px-4 object-contain"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="mb-4">
                You haven&apos;t registered any companies yet. Please register a company first.
              </p>
              <Button asChild>
                <Link to="/company-register" className="inline-block">
                  Register Company
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SelectCompanyForJob
