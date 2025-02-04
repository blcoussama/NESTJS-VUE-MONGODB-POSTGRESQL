const isValidSalary = (salary) => {
    if (typeof salary === "number") return true; // Fixed salary
    if (Array.isArray(salary) && salary.length === 2 &&
        typeof salary[0] === "number" && typeof salary[1] === "number" && salary[0] <= salary[1]) {
        return true; // Salary range
    }
    return salary === "discutable"; // Negotiable salary
};