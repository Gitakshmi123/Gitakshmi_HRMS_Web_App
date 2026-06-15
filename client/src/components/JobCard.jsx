import React from 'react';
import { BriefcaseIcon, LocationMarkerIcon } from '@heroicons/react/solid';

const JobCard = ({ job, onClick }) => {
    return (
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg p-4 cursor-pointer" onClick={onClick}>
            <h2 className="font-bold text-xl">{job.title}</h2>
            <div className="flex justify-between mt-2">
                <span className="text-sm text-gray-500">{job.department}</span>
                <span className="text-sm text-gray-500">{job.experience}</span>
            </div>
            <div className="flex items-center mt-2">
                <LocationMarkerIcon className="h-5 w-5 text-gray-500" />
                <span className="text-sm text-gray-500 ml-1">{job.location}</span>
            </div>
            <p className="mt-2 text-gray-700 truncate">{job.description}</p>
            <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">{job.postedDate}</span>
                <button className="bg-blue-500 text-white px-3 py-1 rounded">View Details</button>
            </div>
        </div>
    );
};

export default JobCard;
