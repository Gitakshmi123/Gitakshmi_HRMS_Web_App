import React from 'react';
import { Search, Briefcase, MapPin, Layers } from 'lucide-react';

const JobFilters = ({ filters, setFilters, departments, experiences, jobTypes }) => {
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="relative -mt-10 z-20 mx-auto max-w-[1600px] px-4 lg:px-6">
            <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 flex flex-col lg:flex-row gap-4 items-center justify-between border border-gray-100/50 backdrop-blur-sm">

                {/* Search */}
                <div className="relative flex-grow w-full lg:w-auto">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        name="search"
                        value={filters.search}
                        onChange={handleChange}
                        placeholder="Search by job title or keyword..."
                        className="pl-11 block w-full rounded-lg border-gray-300 bg-gray-50 border focus:bg-white focus:border-purple-500 focus:ring-purple-500 py-3.5 text-base transition-all duration-200 shadow-sm"
                    />
                </div>

                {/* Filters Group */}
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    {/* Department */}
                    <div className="relative w-full sm:w-48">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Layers className="h-4 w-4 text-gray-400" />
                        </div>
                        <select
                            name="department"
                            value={filters.department}
                            onChange={handleChange}
                            className="pl-9 pr-8 block w-full rounded-lg border-gray-300 bg-gray-50 border focus:bg-white focus:border-purple-500 focus:ring-purple-500 py-3.5 text-sm appearance-none cursor-pointer transition-all hover:bg-white shadow-sm"
                        >
                            <option value="">All Departments</option>
                            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" /></svg>
                        </div>
                    </div>

                    {/* Experience */}
                    <div className="relative w-full sm:w-48">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Briefcase className="h-4 w-4 text-gray-400" />
                        </div>
                        <select
                            name="experience"
                            value={filters.experience}
                            onChange={handleChange}
                            className="pl-9 pr-8 block w-full rounded-lg border-gray-300 bg-gray-50 border focus:bg-white focus:border-purple-500 focus:ring-purple-500 py-3.5 text-sm appearance-none cursor-pointer transition-all hover:bg-white shadow-sm"
                        >
                            <option value="">All Experience</option>
                            {experiences.map(exp => <option key={exp} value={exp}>{exp}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" /></svg>
                        </div>
                    </div>

                    {/* Job Type */}
                    <div className="relative w-full sm:w-48">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <MapPin className="h-4 w-4 text-gray-400" />
                        </div>
                        <select
                            name="type"
                            value={filters.type}
                            onChange={handleChange}
                            className="pl-9 pr-8 block w-full rounded-lg border-gray-300 bg-gray-50 border focus:bg-white focus:border-purple-500 focus:ring-purple-500 py-3.5 text-sm appearance-none cursor-pointer transition-all hover:bg-white shadow-sm"
                        >
                            <option value="">All Types</option>
                            {jobTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd" /></svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobFilters;
