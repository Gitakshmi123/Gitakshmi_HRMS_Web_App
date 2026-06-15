import React from 'react';

const JobModal = ({ job, onClose }) => {
    if (!job) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg p-6 w-11/12 md:w-1/2">
                <button className="absolute top-2 right-2 text-gray-500" onClick={onClose}>X</button>
                <h2 className="text-2xl font-bold mb-4">{job.title}</h2>
                <p className="text-sm text-gray-500">Department: {job.department}</p>
                <p className="mt-2">{job.description}</p>
                <h3 className="font-semibold mt-4">Responsibilities:</h3>
                <ul className="list-disc ml-5">
                    {job.responsibilities.map((resp, index) => <li key={index}>{resp}</li>)}
                </ul>
                <h3 className="font-semibold mt-4">Requirements:</h3>
                <ul className="list-disc ml-5">
                    {job.requirements.map((req, index) => <li key={index}>{req}</li>)}
                </ul>
                <p className="mt-4">Location: {job.location}</p>
                <p className="mt-2">Salary: {job.salaryRange}</p>
                <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">Apply Now</button>
            </div>
        </div>
    );
};

export default JobModal;
