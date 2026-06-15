import React from 'react';
import JobCard from './components/JobCard';
import SearchFilterBar from './components/SearchFilterBar';
import JobModal from './components/JobModal';
import BenefitsSection from './components/BenefitsSection';

const CareersPage = () => {
    const [jobs, setJobs] = React.useState([]);
    const [selectedJob, setSelectedJob] = React.useState(null);
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    React.useEffect(() => {
        // Fetch job data from API
        const fetchJobs = async () => {
            const response = await fetch('/jobs/companyId');
            const data = await response.json();
            setJobs(data);
        };
        fetchJobs();
    }, []);

    const handleJobClick = (job) => {
        setSelectedJob(job);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedJob(null);
    };

    return (
        <div className="container mx-auto p-4">
            <section className="hero bg-gradient-to-r from-blue-500 to-purple-500 text-white text-center py-20">
                <h1 className="text-4xl font-bold">Build Your Future With Us</h1>
                <p className="mt-4 text-lg">Join our team and help us build the future.</p>
                <button className="mt-6 bg-white text-blue-500 px-4 py-2 rounded shadow">View Openings</button>
            </section>
            <SearchFilterBar />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {jobs.map((job) => (
                    <JobCard key={job.id} job={job} onClick={() => handleJobClick(job)} />
                ))}
            </div>
            <BenefitsSection />
            {isModalOpen && <JobModal job={selectedJob} onClose={closeModal} />}
            <footer className="mt-10 text-center">
                <p>&copy; 2026 Your Company. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default CareersPage;
