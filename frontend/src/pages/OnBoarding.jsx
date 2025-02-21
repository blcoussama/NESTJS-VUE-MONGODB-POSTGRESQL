import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { UserIcon, BriefcaseIcon } from "lucide-react"

const OnBoarding = () => {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState(null)

  const handleRoleSelection = (role) => {
    setSelectedRole(role)
  }

  const handleNextClick = () => {
    if (selectedRole) {
      navigate("/signup", { state: { role: selectedRole } })
    }
  }

  return (
    <motion.div
      className="max-w-6xl mx-auto p-6 mt-10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-4xl font-semibold mb-20 text-center">Choose Your Role</h2>
      <RadioGroup
        className="grid grid-cols-2 gap-4 mb-6"
        value={selectedRole || ""}
        onValueChange={handleRoleSelection}
      >
        {/* Recruiter Card */}
        <Card
          onClick={() => handleRoleSelection("recruiter")}
          className={`cursor-pointer border-2 p-4 flex flex-col gap-3 ${
            selectedRole === "recruiter" ? "border-primary" : "border-transparent"
          }`}
        >
          <CardHeader className="">
            <div  className="flex items-center gap-5">
                <BriefcaseIcon className="h-16 w-16" />
                <CardTitle className="text-4xl">Recruiter</CardTitle>
            </div>
            
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-10">
            <Label htmlFor="recruiter" className="text-xl">I want to hire talent</Label>
            {/* Always visible radio button */}
            <div className="w-10 h-10 mt-2 border-2 border-primary rounded-full flex items-center justify-center">
              {selectedRole === "recruiter" && (
                <div className="w-7 h-7 bg-primary rounded-full"></div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Candidate Card */}
        <Card
          onClick={() => handleRoleSelection("candidate")}
          className={`cursor-pointer border-2 p-4 flex flex-col gap-3 ${
            selectedRole === "candidate" ? "border-primary" : "border-transparent"
          }`}
        >
          <CardHeader className="">
            <div  className="flex items-center gap-5">
                <UserIcon className="h-16 w-16" />
                <CardTitle className="text-4xl">Candidate</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-10">
            <Label htmlFor="candidate" className="text-xl">I&apos;m looking for job opportunities</Label>
            {/* Always visible radio button */}
            <div className="w-10 h-10 mt-2 border-2 border-primary rounded-full flex items-center justify-center">
              {selectedRole === "candidate" && (
                <div className="w-7 h-7 bg-primary rounded-full"></div>
              )}
            </div>
          </CardContent>
        </Card>
      </RadioGroup>

      <Button className="w-full text-lg mt-10 cursor-pointer" size="lg" onClick={handleNextClick} disabled={!selectedRole}>
        Next
      </Button>
    </motion.div>
  )
}

export default OnBoarding
