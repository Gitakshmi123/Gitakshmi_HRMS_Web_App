import React from 'react';

const SearchFilterBar = () => {
    return (
        <div className="bg-white shadow-md rounded-lg p-4 mt-6">
            <input type="text" placeholder="Search job title or skills..." className="border rounded p-2 w-full" />
            <div className="flex justify-between mt-4">
                <select className="border rounded p-2">
                    <option>Department</option>
                    <option>HR</option>
                    <option>Engineering</option>
                    <option>Marketing</option>
                </select>
                <select className="border rounded p-2">
                    <option>Location</option>
                    <option>Remote</option>
                    <option>On-site</option>
                </select>
                <select className="border rounded p-2">
                    <option>Experience</option>
                    <option>Fresher</option>
                    <option>1-2 yrs</option>
                    <option>Senior</option>
                </select>
                <select className="border rounded p-2">
                    <option>Job Type</option>
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Internship</option>
                </select>
            </div>
        </div>
    );
};

export default SearchFilterBar;
