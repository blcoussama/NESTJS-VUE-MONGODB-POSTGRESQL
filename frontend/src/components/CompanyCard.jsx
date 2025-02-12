const CompanyCard = ({ company }) => {
  return (
    <div className="bg-white border border-gray-200 rounded p-4 shadow-md hover:shadow-lg transition duration-200">
      <h3 className="text-xl font-bold mb-2 text-gray-900">{company.name}</h3>
      <p className="text-gray-700 mb-1">
        <span className="font-semibold">Website:</span> {company.website}
      </p>
      <p className="text-gray-700">
        <span className="font-semibold">Location:</span> {company.location}
      </p>
    </div>
  );
};

export default CompanyCard;
