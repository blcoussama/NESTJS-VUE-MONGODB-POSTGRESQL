import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { registerCompany, clearError, clearMessage } from '../store/companySlice';
import { useNavigate } from 'react-router-dom';

const RegisterCompany = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error, message } = useSelector((state) => state.company);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const companyData = { name, description, website, location };
    
    dispatch(registerCompany(companyData))
      .unwrap()
      .then(() => {
        // Optionally, clear form fields here or display a success notification
        navigate('/recruiter-dashboard'); // Redirect to a dashboard or companies listing page
      })
      .catch((err) => {
        console.error('Error registering company:', err);
      });
  };

  return (
    <div className="max-w-lg mx-auto p-8 bg-gray-100 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Register Your Company</h2>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      {message && <p className="text-green-600 mb-2">{message}</p>}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block font-semibold mb-1" htmlFor="name">Company Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1" htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded"
            rows="3"
          ></textarea>
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1" htmlFor="website">Website</label>
          <input
            id="website"
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label className="block font-semibold mb-1" htmlFor="location">Location</label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          {isLoading ? 'Registering...' : 'Register Company'}
        </button>
      </form>
    </div>
  );
};

export default RegisterCompany;
