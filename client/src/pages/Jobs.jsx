import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HeroSection from '../components/jobs/HeroSection';
import JobFilters from '../components/jobs/JobFilters';
import JobCard from '../components/jobs/JobCard';
import JobModal from '../components/jobs/JobModal';
import BenefitsSection from '../components/jobs/BenefitsSection';
import { Briefcase } from 'lucide-react';
import api from '../utils/api';
import { getCompany, getTenantId, setCompany } from '../utils/auth';
import CandidateProfileMenu from '../components/jobs/CandidateProfileMenu';
import { useJobPortalAuth } from '../context/JobPortalAuthContext';

const Jobs = () => {
  const params = useParams();
  const navigate = useNavigate();
  const { candidate } = useJobPortalAuth();

  // Resolve identifier: prioritize URL param, but ignore 'jobs' string which is a routing error
  let identifier = params.companyId;
  if (!identifier || identifier === 'jobs') {
    identifier = getTenantId() || localStorage.getItem('companyCode');
  }

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('Careers');
  const isAuth = !!candidate;

  const [filters, setFilters] = useState({
    search: '',
    department: '',
    experience: '',
    type: ''
  });

  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    if (!identifier) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch current company details
        let companyInfo = getCompany();

        // If we have an identifier but no company info, or identifier is different, fetch it
        if (!companyInfo || (companyInfo._id !== identifier && companyInfo.code !== identifier)) {
          try {
            const tRes = await api.get(`/public/tenant/${identifier}`);
            if (tRes.data) {
              companyInfo = { ...tRes.data, tenantId: tRes.data._id || identifier };
              setCompany(companyInfo);
            }
          } catch (e) {
            console.warn("Failed to fetch tenant details", e);
          }
        }

        if (companyInfo && companyInfo.name) {
          setCompanyName(companyInfo.name);
        }

        // Fetch jobs for this company
        const jobsRes = await api.get(`/public/jobs?tenantId=${identifier}`);
        setJobs(jobsRes.data || []);

        // If the URL is just /jobs and we resolved it, redirect to proper code URL if we have it
        if (params.companyId !== identifier && companyInfo?.code) {
          // navigate(`/jobs/${companyInfo.code}`, { replace: true });
        }

      } catch (err) {
        console.error("Failed to load jobs", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [identifier, navigate, params.companyId]);

  const departments = useMemo(() => [...new Set(jobs.map(j => j.department).filter(Boolean))], [jobs]);
  const jobTypes = useMemo(() => [...new Set(jobs.map(j => j.employmentType).filter(Boolean))], [jobs]);

  const experiences = useMemo(() => {
    const expSet = new Set();
    jobs.forEach(j => {
      if (j.minExperienceMonths !== undefined) {
        const yrs = Math.floor(j.minExperienceMonths / 12);
        expSet.add(`${yrs}+ Years`);
      }
    });
    return [...expSet].sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = (job.jobTitle || '').toLowerCase().includes(filters.search.toLowerCase()) ||
        (job.description || '').toLowerCase().includes(filters.search.toLowerCase());
      const matchesDept = filters.department ? job.department === filters.department : true;
      const matchesType = filters.type ? job.employmentType === filters.type : true;

      let matchesExp = true;
      if (filters.experience) {
        const yrs = Math.floor((job.minExperienceMonths || 0) / 12);
        matchesExp = filters.experience === `${yrs}+ Years`;
      }
      return matchesSearch && matchesDept && matchesExp && matchesType;
    });
  }, [filters, jobs]);

  const handleApply = (job) => {
    if (!isAuth) {
      navigate(`/candidate/login?tenantId=${identifier}&redirect=/candidate/dashboard`);
      return;
    }
    navigate(`/apply-job/${job._id}?tenantId=${identifier}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans relative">
      <div className="absolute top-0 right-0 z-50 p-6 flex items-center gap-4">
        {candidate ? (
          <CandidateProfileMenu identifier={identifier} />
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/candidate/login?tenantId=${identifier}&redirect=/candidate/dashboard`)}
              className="bg-white text-blue-600 px-5 py-2.5 rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-blue-50 transition-all transform hover:-translate-y-0.5 border border-blue-100"
            >
              Candidate Login
            </button>
          </div>
        )}
      </div>

      <HeroSection companyName={companyName} />

      <JobFilters
        filters={filters}
        setFilters={setFilters}
        departments={departments}
        experiences={experiences}
        jobTypes={jobTypes}
      />

      <div id="open-positions" className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Open Positions</h2>
          <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
            {filteredJobs.length} Jobs Found
          </span>
        </div>

        {filteredJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {filteredJobs.map(job => (
              <JobCard
                key={job._id}
                job={job}
                onView={setSelectedJob}
                onApply={handleApply}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900">No open positions found</h3>
            <p className="text-gray-500">Check back later or try adjusting your filters.</p>
            <button
              onClick={() => setFilters({ search: '', department: '', experience: '', type: '' })}
              className="mt-6 text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      <BenefitsSection />

      <JobModal
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={handleApply}
      />
    </div>
  );
};

export default Jobs;
