import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import { getTenantId, getCompany, cleanId } from '../../utils/auth';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
import {
  ArrowLeft, Send, CheckCircle2, User,
  Mail, Phone, MapPin, Calendar, FileText,
  ShieldCheck, UploadCloud, Building2, Briefcase, Zap,
  ChevronDown, Loader2, Plus, X
} from 'lucide-react';

const LOCATION_API = 'https://countriesnow.space/api/v0.1';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';
const COMMON_COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria', 'Bangladesh', 'Belgium', 'Brazil', 'Canada',
  'China', 'Denmark', 'Egypt', 'France', 'Germany', 'India', 'Indonesia', 'Ireland', 'Italy', 'Japan', 'Malaysia',
  'Mexico', 'Nepal', 'Netherlands', 'New Zealand', 'Pakistan', 'Philippines', 'Portugal', 'Singapore', 'South Africa',
  'Spain', 'Sri Lanka', 'Switzerland', 'Thailand', 'United Arab Emirates', 'United Kingdom', 'United States'
];

const INDIA_FALLBACK = {
  Gujarat: {
    Ahmedabad: '380001',
    Surat: '395003',
    Vadodara: '390001',
    Rajkot: '360001',
    Gandhinagar: '382010',
    Bhavnagar: '364001',
    Jamnagar: '361001',
    Junagadh: '362001',
    Anand: '388001',
    Vapi: '396191'
  },
  Maharashtra: {
    Mumbai: '400001',
    Pune: '411001',
    Nagpur: '440001',
    Nashik: '422001',
    Thane: '400601'
  },
  Karnataka: {
    Bengaluru: '560001',
    Mysuru: '570001',
    Mangaluru: '575001',
    Hubballi: '580020'
  },
  Delhi: { Delhi: '110001', 'New Delhi': '110001' },
  Rajasthan: { Jaipur: '302001', Udaipur: '313001', Jodhpur: '342001', Kota: '324001' },
  'Tamil Nadu': { Chennai: '600001', Coimbatore: '641001', Madurai: '625001' },
  Telangana: { Hyderabad: '500001', Warangal: '506002' },
  'West Bengal': { Kolkata: '700001', Howrah: '711101' }
};

const locationCache = {
  countries: null,
  states: new Map(),
  cities: new Map(),
  zip: new Map()
};

const sortUnique = (items) => [...new Set((items || []).filter(Boolean).map(v => String(v).trim()).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b));

const postLocation = async (path, payload) => {
  const res = await fetch(`${LOCATION_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Location API failed: ${res.status}`);
  return res.json();
};

const fetchCountryOptions = async () => {
  if (locationCache.countries) return locationCache.countries;
  try {
    const res = await fetch(`${LOCATION_API}/countries/positions`);
    const json = await res.json();
    const countries = sortUnique((json?.data || []).map(row => row.name));
    locationCache.countries = countries.length ? countries : sortUnique(COMMON_COUNTRIES);
  } catch {
    locationCache.countries = sortUnique(COMMON_COUNTRIES);
  }
  return locationCache.countries;
};

const fetchStateOptions = async (country) => {
  if (!country) return [];
  const key = country.toLowerCase();
  if (locationCache.states.has(key)) return locationCache.states.get(key);
  try {
    const json = await postLocation('/countries/states', { country });
    const states = sortUnique((json?.data?.states || []).map(row => row.name));
    locationCache.states.set(key, states);
    return states;
  } catch {
    const states = country === 'India' ? Object.keys(INDIA_FALLBACK) : [];
    locationCache.states.set(key, states);
    return states;
  }
};

const fetchCityOptions = async (country, state) => {
  if (!country || !state) return [];
  const key = `${country}|${state}`.toLowerCase();
  if (locationCache.cities.has(key)) return locationCache.cities.get(key);
  try {
    const json = await postLocation('/countries/state/cities', { country, state });
    const cities = sortUnique(json?.data || []);
    locationCache.cities.set(key, cities);
    return cities;
  } catch {
    const cities = country === 'India' ? Object.keys(INDIA_FALLBACK[state] || {}) : [];
    locationCache.cities.set(key, cities);
    return cities;
  }
};

const fetchZipForCity = async (country, state, city) => {
  if (!country || !state || !city) return '';
  const key = `${country}|${state}|${city}`.toLowerCase();
  if (locationCache.zip.has(key)) return locationCache.zip.get(key);

  const fallbackZip = country === 'India' ? INDIA_FALLBACK[state]?.[city] : '';
  try {
    const params = new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      limit: '1',
      city,
      state,
      country
    });
    const res = await fetch(`${NOMINATIM_API}?${params.toString()}`);
    const json = await res.json();
    const zip = json?.[0]?.address?.postcode || fallbackZip || '';
    locationCache.zip.set(key, zip);
    return zip;
  } catch {
    locationCache.zip.set(key, fallbackZip || '');
    return fallbackZip || '';
  }
};

export default function JobApplication() {
  const [searchParams] = useSearchParams();
  const { requirementId: paramReqId } = useParams();
  const navigate = useNavigate();
  const { candidate } = useJobPortalAuth();

  const requirementId = paramReqId || searchParams.get('requirementId');
  const rawTenantId = searchParams.get('tenantId');
  const tenantId = cleanId(rawTenantId) || getTenantId();
  const company = getCompany();

  const [formData, setFormData] = useState({
    name: '',
    fatherName: '',
    email: '',
    mobile: '',
    dob: '',
    workLocation: '',
    address: '',
    resume: null,
    consent: true
  });

  const [requirement, setRequirement] = useState(null);
  const [customization, setCustomization] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true); // New state to prevent flash
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [fieldErrors, setFieldErrors] = useState({});
  const [draggingUpload, setDraggingUpload] = useState(null);
  const [locationOptions, setLocationOptions] = useState({
    countries: sortUnique(COMMON_COUNTRIES),
    states: [],
    cities: []
  });
  const [locationLoading, setLocationLoading] = useState({
    countries: false,
    states: false,
    cities: false,
    zip: false
  });

  useEffect(() => {
    if (requirementId && requirementId !== 'undefined' && tenantId && tenantId !== 'undefined') {
      Promise.all([
        fetchRequirementDetails(),
        fetchCustomization()
      ]).finally(() => setFetching(false));
    } else {
      setFetching(false);
    }
  }, [requirementId, tenantId]);

  useEffect(() => {
    // If we have customization, initialize formData with its fields
    if (customization?.applyPage?.sections) {
      const initialData = { consent: true, resume: null, name: '', email: '' };

      customization.applyPage.sections.forEach(section => {
        section.fields?.forEach(field => {
          initialData[field.id] = field.type === 'image' ? null : '';
        });
      });

      // Merge with candidate data if available (this takes priority for name/email/mobile)
      if (candidate) {
        initialData.name = candidate.name || '';
        initialData.email = candidate.email || '';
        initialData.mobile = candidate.mobile || '';
      }

      setFormData(initialData);
    } else if (candidate && !formData.name) {
      // Fallback if no customization yet
      setFormData(prev => ({
        ...prev,
        name: candidate.name || '',
        email: candidate.email || '',
        mobile: candidate.mobile || '',
      }));
    }
  }, [customization, candidate]);

  const fetchRequirementDetails = async () => {
    try {
      const res = await api.get(`/public/job/${requirementId}?tenantId=${tenantId}`);
      setRequirement(res.data);
      // If backend had to resolve a Position -> Requirement, replace URL so submit uses correct id.
      if (res.data?.resolvedRequirementId && String(res.data.resolvedRequirementId) !== String(requirementId)) {
        navigate(`/apply-job/${res.data.resolvedRequirementId}?tenantId=${encodeURIComponent(String(tenantId || res.data.tenant || ''))}`, { replace: true });
        return;
      }
      // Safety: If tenantId was missing locally but returned from server, update it
      if (!tenantId && res.data.tenant) {
        localStorage.setItem('tenantId', res.data.tenant);
      }
    } catch (err) { console.error("Requirement Load Error:", err); }
  };

  const fetchCustomization = async () => {
    try {
      const res = await api.get(`/public/career-customization/${tenantId}`);
      if (res.data) {
        // Normalize field IDs in-memory to prevent empty keys in formData/inputs
        if (res.data.applyPage?.sections) {
          res.data.applyPage.sections = res.data.applyPage.sections.map(section => {
            if (section.fields) {
              section.fields = section.fields.map(field => {
                if (!field.id || field.id.trim() === '') {
                  const normalizedId = field.label
                    ? field.label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
                    : 'custom_field';
                  return { ...field, id: normalizedId || 'custom_field' };
                }
                return field;
              });
            }
            return section;
          });
        }
        setCustomization(res.data);
      }
    } catch (err) { console.error("Customization Load Error:", err); }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const [parsing, setParsing] = useState(false);
  const [parsingFields, setParsingFields] = useState({});

  const normalizeLookup = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const getApplyFields = () => customization?.applyPage?.sections?.flatMap(section => section.fields || []) || [];

  const getLocationRole = (field = {}) => {
    const text = normalizeLookup(`${field.id || ''} ${field.label || ''} ${field.placeholder || ''}`);
    if (/\b(country|nation)\b/.test(text)) return 'country';
    if (/\b(state|province|region)\b/.test(text)) return 'state';
    if (/\b(city|town)\b/.test(text)) return 'city';
    if (/\b(zip|zipcode|zip code|postal|postal code|pin|pincode|pin code)\b/.test(text)) return 'zip';
    return null;
  };

  const getLocationFieldIds = () => {
    const ids = {};
    getApplyFields().forEach(field => {
      const role = getLocationRole(field);
      if (role && !ids[role]) ids[role] = field.id;
    });
    return ids;
  };

  const updateLocationValue = async (role, fieldId, value) => {
    const ids = getLocationFieldIds();
    setFormData(prev => {
      const next = { ...prev, [fieldId]: value };
      if (role === 'country') {
        if (ids.state) next[ids.state] = '';
        if (ids.city) next[ids.city] = '';
        if (ids.zip) next[ids.zip] = '';
      } else if (role === 'state') {
        if (ids.city) next[ids.city] = '';
        if (ids.zip) next[ids.zip] = '';
      } else if (role === 'city') {
        if (ids.zip) next[ids.zip] = '';
      }
      return next;
    });

    if (role === 'city' && ids.zip) {
      const country = ids.country ? formData[ids.country] : '';
      const state = ids.state ? formData[ids.state] : '';
      setLocationLoading(prev => ({ ...prev, zip: true }));
      const zip = await fetchZipForCity(country, state, value);
      setLocationLoading(prev => ({ ...prev, zip: false }));
      if (zip) {
        setFormData(prev => ({ ...prev, [ids.zip]: zip }));
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLocationLoading(prev => ({ ...prev, countries: true }));
    fetchCountryOptions()
      .then(countries => {
        if (!cancelled) setLocationOptions(prev => ({ ...prev, countries }));
      })
      .finally(() => {
        if (!cancelled) setLocationLoading(prev => ({ ...prev, countries: false }));
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const ids = getLocationFieldIds();
    const country = ids.country ? formData[ids.country] : '';
    if (!country) {
      setLocationOptions(prev => ({ ...prev, states: [], cities: [] }));
      return;
    }

    let cancelled = false;
    setLocationLoading(prev => ({ ...prev, states: true }));
    fetchStateOptions(country)
      .then(states => {
        if (!cancelled) setLocationOptions(prev => ({ ...prev, states, cities: [] }));
      })
      .finally(() => {
        if (!cancelled) setLocationLoading(prev => ({ ...prev, states: false }));
      });
    return () => { cancelled = true; };
  }, [customization, formData[getLocationFieldIds().country]]);

  useEffect(() => {
    const ids = getLocationFieldIds();
    const country = ids.country ? formData[ids.country] : '';
    const state = ids.state ? formData[ids.state] : '';
    if (!country || !state) {
      setLocationOptions(prev => ({ ...prev, cities: [] }));
      return;
    }

    let cancelled = false;
    setLocationLoading(prev => ({ ...prev, cities: true }));
    fetchCityOptions(country, state)
      .then(cities => {
        if (!cancelled) setLocationOptions(prev => ({ ...prev, cities }));
      })
      .finally(() => {
        if (!cancelled) setLocationLoading(prev => ({ ...prev, cities: false }));
      });
    return () => { cancelled = true; };
  }, [customization, formData[getLocationFieldIds().country], formData[getLocationFieldIds().state]]);

  const firstParsedValue = (data, keys) => {
    for (const key of keys) {
      const value = data?.[key];
      if (value !== null && value !== undefined && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  };

  const normalizeFormDate = (value = '', outputFormat = 'DD/MM/YYYY') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parsed = dayjs(raw, ['DD/MM/YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'], true);
    return parsed.isValid() ? parsed.format(outputFormat) : raw;
  };

  const matchSelectValue = (field, value) => {
    if (!field?.options?.length || !value) return value;
    const target = normalizeLookup(value);
    return field.options.find(opt => normalizeLookup(opt) === target) || value;
  };

  const inferDocumentType = (field = {}) => {
    const text = normalizeLookup(`${field.id || ''} ${field.label || ''} ${field.helpText || ''}`);
    if (/\b(aadhaar|adhaar|aadhar|adhar|uidai)\b/.test(text)) return 'aadhaar';
    if (/\bpan\b/.test(text)) return 'pan';
    if (/\b(passbook|bank|ifsc|account)\b/.test(text)) return 'passbook';
    if (/\b(resume|cv|portfolio)\b/.test(text)) return 'resume';
    return 'id_proof';
  };

  const getValueForField = (field, data, documentType = 'id_proof') => {
    const text = normalizeLookup(`${field.id || ''} ${field.label || ''}`);
    const pick = (keys) => firstParsedValue(data, keys);

    const isAadhaarMention = /\b(aadhaar|adhaar|aadhar|adhar|uidai)\b/.test(text);
    const isAadhaarNumberField = isAadhaarMention && /\b(no|number|num|id|uid|card)\b/.test(text) && !/\b(name|address|dob|birth|gender|sex|father|husband|guardian|parent)\b/.test(text);
    const isPanField = /\bpan\b/.test(text);
    const isBankField = /\b(ifsc|branch|account|a c|acct|bank|holder|beneficiary)\b/.test(text);
    const isProfessionalField = /\b(designation|role|position|title|company|employer|organization|organisation|experience|exp|ctc|salary|package|linkedin|linked in|skill|technology|education|degree|qualification)\b/.test(text);
    const isPersonalField = /\b(name|full name|candidate|applicant|father|husband|guardian|parent|dob|birth|date of birth|pin|pincode|postal|zip|address|location|gender|sex|email|mail|mobile|phone|contact|telephone)\b/.test(text);

    if (documentType === 'aadhaar' && (isPanField || isBankField || isProfessionalField || /\b(email|mail|mobile|phone|contact|telephone)\b/.test(text))) return '';
    if (documentType === 'pan' && !isPanField) return '';
    if (documentType === 'passbook' && !isBankField) return '';
    if (documentType === 'resume' && (isAadhaarNumberField || isPanField || isBankField || /\b(father|husband|guardian|parent|dob|birth|date of birth|gender|sex|address|pin|pincode|postal|zip)\b/.test(text))) return '';
    if (documentType === 'id_proof' && !isPersonalField && !isAadhaarNumberField && !isPanField) return '';

    if (isAadhaarNumberField) return documentType === 'aadhaar' ? pick(['aadhaarNumber', 'aadhaarNo', 'aadharNumber', 'aadharNo', 'adharNumber', 'adharNo', 'adhaarNumber', 'adhaarNo', 'documentNumber', 'idNumber']) : '';
    if (isPanField) return documentType === 'pan' ? pick(['panNumber']) : '';
    if (/\bifsc\b/.test(text)) return pick(['ifsc']);
    if (/\b(branch)\b/.test(text)) return pick(['branchName', 'branch']);
    if (/\b(account holder|holder name|beneficiary)\b/.test(text)) return pick(['accountHolderName']);
    if (/\b(account|a c|acct)\b/.test(text)) return pick(['accountNumber']);
    if (/\b(bank)\b/.test(text)) return pick(['bankName']);
    if (/\b(father|husband|guardian|parent)\b/.test(text)) return pick(['fatherName']);
    if (/\b(dob|birth|date of birth)\b/.test(text)) return normalizeFormDate(pick(['dob', 'dateOfBirth']));
    if (/\b(pin|pincode|postal|zip)\b/.test(text)) return pick(['pincode', 'pinCode', 'zipCode']);
    if (/\b(state|province|region)\b/.test(text)) return pick(['state']);
    if (/\b(city|town)\b/.test(text)) return pick(['city']);
    if (/\b(country|nation)\b/.test(text)) return pick(['country']);
    if (/\b(address|location)\b/.test(text)) return pick(['address']);
    if (/\b(gender|sex)\b/.test(text)) return pick(['gender']);
    if (/\b(email|mail)\b/.test(text)) return pick(['email']);
    if (/\b(mobile|phone|contact|telephone)\b/.test(text)) return pick(['mobile', 'phone']);
    if (/\b(linkedin|linked in)\b/.test(text)) return pick(['linkedin']);
    if (/\b(designation|role|position|title)\b/.test(text)) return pick(['currentDesignation', 'designation']);
    if (/\b(company|employer|organization|organisation)\b/.test(text)) return pick(['currentCompany', 'company']);
    if (/\b(experience|exp)\b/.test(text)) return pick(['experience', 'totalExperience']);
    if (/\b(ctc|salary|package)\b/.test(text)) return pick(['expectedCTC', 'salary']);
    if (/\b(skill|technology)\b/.test(text)) return pick(['skills']);
    if (/\b(education|degree|qualification)\b/.test(text)) return pick(['education']);
    if (/\b(name|full name|candidate|applicant)\b/.test(text)) return pick(['fullName', 'name']);
    return '';
  };

  const mergeParsedDataIntoForm = (data = {}, documentType = 'id_proof') => {
    if (!data || typeof data !== 'object') return;

    setFormData(prev => {
      const next = { ...prev };
      const assign = (key, value, field = null, overwrite = false) => {
        if (!key || value === null || value === undefined || String(value).trim() === '') return;
        const dateFormat = field?.type === 'date' ? 'YYYY-MM-DD' : 'DD/MM/YYYY';
        const normalizedValue = field?.type === 'date' || /\b(dob|birth)\b/.test(normalizeLookup(key))
          ? normalizeFormDate(value, dateFormat)
          : matchSelectValue(field, value);
        if (overwrite || !next[key]) next[key] = normalizedValue;
      };

      if (documentType === 'aadhaar' || documentType === 'id_proof') {
        const overwriteAadhaar = documentType === 'aadhaar';
        assign('name', firstParsedValue(data, ['fullName', 'name']), null, overwriteAadhaar);
        assign('fatherName', firstParsedValue(data, ['fatherName']), null, overwriteAadhaar);
        assign('dob', normalizeFormDate(firstParsedValue(data, ['dob', 'dateOfBirth'])), null, overwriteAadhaar);
        assign('address', firstParsedValue(data, ['address']), null, overwriteAadhaar);
        const ids = getLocationFieldIds();
        assign(ids.country, firstParsedValue(data, ['country']), null, overwriteAadhaar);
        assign(ids.state, firstParsedValue(data, ['state']), null, overwriteAadhaar);
        assign(ids.city, firstParsedValue(data, ['city']), null, overwriteAadhaar);
        assign(ids.zip, firstParsedValue(data, ['pinCode', 'pincode', 'zipCode']), null, overwriteAadhaar);
      }

      if (documentType === 'resume') {
        assign('name', firstParsedValue(data, ['fullName', 'name']));
        assign('email', firstParsedValue(data, ['email']));
        assign('mobile', firstParsedValue(data, ['mobile', 'phone']));
      }

      getApplyFields().forEach(field => {
        if (!field?.id || ['file', 'image'].includes(field.type)) return;
        assign(field.id, getValueForField(field, data, documentType), field, true);
      });

      return next;
    });
  };

  const scanDocumentForAutofill = async (file, field, forcedType) => {
    const scanKey = field?.id || 'resume';
    setParsingFields(prev => ({ ...prev, [scanKey]: true }));
    try {
      const parseData = new FormData();
      parseData.append('document', file);
      parseData.append('documentType', forcedType || inferDocumentType(field));
      parseData.append('fieldLabel', field?.label || field?.id || 'Document');
      if (requirementId) parseData.append('requirementId', requirementId);
      if (tenantId) parseData.append('tenantId', tenantId);

      const res = await api.post('/public/document/parse', parseData, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-Tenant-ID': tenantId || '' }
      });

      if (res.data?.success && res.data?.data) {
        mergeParsedDataIntoForm(res.data.data, res.data.documentType || forcedType || inferDocumentType(field));
        if (res.data.warning) console.info('[Document Scan] Warning:', res.data.warning);
      }
    } catch (err) {
      console.warn("Document auto-fill failed (non-blocking):", err.response?.data?.error || err.message);
    } finally {
      setParsingFields(prev => ({ ...prev, [scanKey]: false }));
    }
  };

  const processResumeFile = async (file) => {
    if (file && (file.type === 'application/pdf' || file.type.includes('word')) && file.size <= MAX_UPLOAD_SIZE) {
      setFormData(prev => ({ ...prev, resume: file }));
      setError(''); // Clear any previous errors

      setParsing(true);
      try {
        await scanDocumentForAutofill(file, { id: 'resume', label: 'Resume', type: 'file' }, 'resume');
      } catch (err) {
        // Silently fail — user can still fill the form manually
        console.warn("Resume auto-parse failed (non-blocking):", err.response?.data?.error || err.message);
      } finally {
        setParsing(false);
      }

    } else {
      setError('Please upload a PDF or Word file under 5MB.');
    }
  };

  const processImageFile = async (field, file) => {
    const fieldId = field?.id;

    if (!file) {
      setFormData(prev => ({ ...prev, [fieldId]: null }));
      setFieldErrors(prev => ({ ...prev, [fieldId]: '' }));
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setFormData(prev => ({ ...prev, [fieldId]: null }));
      setFieldErrors(prev => ({ ...prev, [fieldId]: 'Only image files are allowed (PNG, JPG, JPEG, WEBP).' }));
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setFormData(prev => ({ ...prev, [fieldId]: null }));
      setFieldErrors(prev => ({ ...prev, [fieldId]: 'Image size must be under 5MB.' }));
      return;
    }

    setFormData(prev => ({ ...prev, [fieldId]: file }));
    setFieldErrors(prev => ({ ...prev, [fieldId]: '' }));
    setError('');
    await scanDocumentForAutofill(file, field, inferDocumentType(field));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    await processResumeFile(file);
    e.target.value = '';
  };

  const handleImageFileChange = (field) => async (e) => {
    const file = e.target.files?.[0];
    await processImageFile(field, file);
    e.target.value = '';
  };

  const getDropZoneHandlers = (uploadKey, onFile) => ({
    onDragEnter: (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingUpload(uploadKey);
    },
    onDragOver: (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingUpload(uploadKey);
    },
    onDragLeave: (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingUpload(prev => (prev === uploadKey ? null : prev));
    },
    onDrop: async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingUpload(null);
      const file = e.dataTransfer?.files?.[0];
      if (file) await onFile(file);
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Sync dynamic fields to root properties if missing
    // Many dynamic forms use IDs like 'full_name' or 'field_timestamp'
    const curData = { ...formData };
    const config = customization?.applyPage || {};
    const allFields = config?.sections?.flatMap(s => s.fields || []) || [];
    
    const getValueByLabelPattern = (pattern) => {
      const field = allFields.find(f => pattern.test(f.label?.toLowerCase() || ''));
      if (field && curData[field.id]) return curData[field.id];
      // fallback to key search if not found in config
      const key = Object.keys(curData).find(k => pattern.test(k.toLowerCase()) && curData[k]);
      return key ? curData[key] : null;
    };

    const extractedName = getValueByLabelPattern(/\b(name|full name|first name)\b/i);
    if (extractedName) curData.name = extractedName;

    const extractedEmail = getValueByLabelPattern(/\b(email|mail address)\b/i);
    if (extractedEmail) curData.email = extractedEmail;

    const extractedMobile = getValueByLabelPattern(/\b(mobile|phone|contact)\b/i);
    if (extractedMobile) curData.mobile = extractedMobile;

    const rawDate = getValueByLabelPattern(/\b(dob|birth|date of birth)\b/i);
    if (rawDate) {
      if (typeof rawDate === 'string' && rawDate.includes('/')) {
        // Convert DD/MM/YYYY to YYYY-MM-DD for backend
        const [d, m, y] = rawDate.split('/');
        curData.dob = `${y}-${m}-${d}`;
      } else {
        curData.dob = rawDate;
      }
    }

    // 2. Validation
    if (!curData.name || !curData.email) {
      setError('Name and Email are required properties.');
      return;
    }
    if (!curData.resume && !candidate) {
      setError('Please upload your resume to proceed.');
      return;
    }

    const missingRequiredImageField = customization?.applyPage?.sections
      ?.flatMap(section => section.fields || [])
      .find(field => field.type === 'image' && field.required && !curData[field.id]);

    if (missingRequiredImageField) {
      setError(`Please upload ${missingRequiredImageField.label}.`);
      setFieldErrors(prev => ({ ...prev, [missingRequiredImageField.id]: 'This image is required.' }));
      return;
    }

    // 3. Removed Reference Validation as per user request

    setLoading(true);
    setError('');

    try {
      const submitData = new FormData();
      submitData.append('requirementId', requirementId);
      submitData.append('tenantId', tenantId || requirement?.tenant);

      Object.keys(curData).forEach(key => {
        if (!key || key.trim() === '') return; // Skip empty key
        if (key === 'resume') {
          if (curData.resume) submitData.append('resume', curData.resume);
        } else if (curData[key] instanceof File) {
          submitData.append(key, curData[key]);
        } else if (curData[key] !== null && curData[key] !== undefined) {
          let val = curData[key];
          if (Array.isArray(val)) {
            submitData.append(key, JSON.stringify(val));
          } else {
            // If it's a date string in DD/MM/YYYY, convert to ISO for safety
            if (typeof val === 'string' && val.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
              const [d, m, y] = val.split('/');
              val = `${y}-${m}-${d}`;
            }
            submitData.append(key, val);
          }
        }
      });

      // Add references (empty or fresher flags)
      submitData.append('references', JSON.stringify([]));
      submitData.append('isFresher', true);
      submitData.append('noReferenceReason', 'References disabled');

      // Add candidateId if logged in
      if (candidate?.id) {
        submitData.append('candidateId', candidate.id);
      }

      // Add referral data if present in URL
      const refCode = searchParams.get('ref');
      if (refCode) {
        submitData.append('referral', JSON.stringify({
          usedCode: refCode,
          source: 'referral_link',
          capturedAt: new Date()
        }));
      }

      await api.post('/public/apply-job', submitData, {
        headers: { 'Content-Type': 'multipart/form-data', 'X-Tenant-ID': tenantId || requirement?.tenant }
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Submit Error:", err);
      const backendErr = err.response?.data;
      const msg = (backendErr?.error && backendErr?.details)
        ? `${backendErr.error}: ${backendErr.details}`
        : (backendErr?.error || backendErr?.details || 'Failed to submit application. Please try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate grid span for dynamic fields
  const getGridSpan = (width) => {
    switch (width) {
      case 'full': return 60;
      case 'half': return 30;
      case 'third': return 20;
      case 'quarter': return 15;
      case 'fifth': return 12;
      default: return 60;
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Application Form...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 selection:bg-indigo-100">
        <div className="max-w-xl w-full bg-white p-12 lg:p-16 rounded-[3rem] shadow-[0px_8px_16px_rgba(0,0,0,0.06)] border border-slate-50 text-center animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-lg shadow-emerald-100 ring-8 ring-emerald-50/50">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-4xl font-bold text-slate-800 mb-6 tracking-tight">Interview Panel</h2>
          <p className="text-slate-500 font-medium text-lg leading-relaxed mb-12">
            Thank you for applying to <span className="text-indigo-600 font-bold">{company?.name || 'our company'}</span>. Our recruitment team will review your profile and get in touch shortly.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => navigate(`/jobs/${company?.code || tenantId}`)}
              className="px-8 py-4.5 bg-slate-50 text-slate-600 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
            >
              Back to Careers
            </button>
            <button
              onClick={() => navigate('/candidate/dashboard')}
              className="px-8 py-4.5 bg-indigo-600 text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:translate-y-[-2px] transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderDynamicForm = () => {
    const applyPage = customization?.applyPage;
    if (!applyPage?.sections) return null;

    return (
      <div className="space-y-10">
        {applyPage.sections.map((section) => (
          <div key={section.id} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              {section.title}
            </h3>

            <div className="apply-form-grid gap-6">
              {section.fields?.map((field) => {
                const locationRole = getLocationRole(field);
                const locationSelectOptions =
                  locationRole === 'country' ? locationOptions.countries :
                    locationRole === 'state' ? locationOptions.states :
                      locationRole === 'city' ? locationOptions.cities :
                        null;
                const locationPlaceholder =
                  locationRole === 'country' ? (locationLoading.countries ? 'Loading countries...' : 'Select Country') :
                    locationRole === 'state' ? (locationLoading.states ? 'Loading states...' : 'Select State') :
                      locationRole === 'city' ? (locationLoading.cities ? 'Loading cities...' : 'Select City') :
                        `Select ${field.label}`;
                const isLocationSelect = ['country', 'state', 'city'].includes(locationRole);

                return (
                  <div
                    key={field.id}
                    className="apply-form-field"
                    style={{ '--apply-field-span': getGridSpan(field.width) }}
                  >
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">
                        {field.label} {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>

                      {field.type === 'textarea' ? (
                        <textarea
                          name={field.id}
                          value={formData[field.id] || ''}
                          onChange={handleInputChange}
                          required={field.required}
                          rows={4}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all resize-none"
                          placeholder={field.placeholder || `Enter ${field.label}`}
                        />
                      ) : field.type === 'select' || isLocationSelect ? (
                        <div className="relative group">
                          <select
                            name={field.id}
                            value={formData[field.id] || ''}
                            onChange={(e) => {
                              if (isLocationSelect) {
                                updateLocationValue(locationRole, field.id, e.target.value);
                              } else {
                                handleInputChange(e);
                              }
                            }}
                            required={field.required}
                            disabled={
                              (locationRole === 'state' && !formData[getLocationFieldIds().country]) ||
                              (locationRole === 'city' && (!formData[getLocationFieldIds().country] || !formData[getLocationFieldIds().state]))
                            }
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all appearance-none text-gray-700 h-[48px]"
                          >
                            <option value="">{locationPlaceholder}</option>
                            {(locationSelectOptions || field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-blue-600 transition-colors">
                            <ChevronDown size={18} />
                          </div>
                        </div>
                      ) : field.type === 'date' ? (
                        <div className="relative group">
                          <DatePicker
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all h-[48px]"
                            format="DD/MM/YYYY"
                            placeholder={field.placeholder || `Select ${field.label}`}
                            onChange={(date, dateString) => setFormData(prev => ({ ...prev, [field.id]: dateString }))}
                            value={formData[field.id] && dayjs(formData[field.id], 'DD/MM/YYYY').isValid() ? dayjs(formData[field.id], 'DD/MM/YYYY') : null}
                          />
                        </div>
                      ) : field.type === 'file' ? (
                        <div className="space-y-2">
                          <label
                            {...getDropZoneHandlers('resume', processResumeFile)}
                            className={`group relative flex h-[48px] w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 text-left transition-all cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 ${draggingUpload === 'resume' ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100' : 'border-gray-200 bg-gray-50/50'}`}
                          >
                            <input type="file" onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx" />
                            <div className="bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform border border-gray-100">
                              <UploadCloud size={16} className="text-blue-500" />
                            </div>
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-700">
                              {formData.resume ? formData.resume.name : `Upload ${field.label}`}
                            </span>
                            <span className="hidden sm:block shrink-0 text-gray-400 font-medium text-[10px] uppercase tracking-wider">
                              {draggingUpload === 'resume' ? "Drop file to upload" : parsing ? "Scanning resume and auto-filling..." : (field.helpText || "PDF, DOCX up to 5MB")}
                            </span>
                          </label>
                        </div>
                      ) : field.type === 'image' ? (
                        <div className="space-y-2">
                          <label
                            {...getDropZoneHandlers(field.id, (file) => processImageFile(field, file))}
                            className={`group relative flex h-[48px] w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 text-left transition-all cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 ${draggingUpload === field.id ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100' : 'border-gray-200 bg-gray-50/50'}`}
                          >
                            <input
                              type="file"
                              name={field.id}
                              onChange={handleImageFileChange(field)}
                              className="hidden"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                            />
                            <div className="bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform border border-gray-100">
                              <UploadCloud size={16} className="text-blue-500" />
                            </div>
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-700">
                              {formData[field.id]?.name || `Upload ${field.label}`}
                            </span>
                            <span className="hidden sm:block shrink-0 text-gray-400 font-medium text-[10px] uppercase tracking-wider">
                              {draggingUpload === field.id ? "Drop image to upload" : parsingFields[field.id] ? "Scanning proof and auto-filling..." : (field.helpText || "PNG, JPG, JPEG or WEBP up to 5MB")}
                            </span>
                          </label>
                          {fieldErrors[field.id] && (
                            <p className="text-[10px] font-bold text-red-500 ml-1">{fieldErrors[field.id]}</p>
                          )}
                        </div>
                      ) : field.type === 'tags' ? (
                        <div className="space-y-2">
                           <div className="flex flex-wrap gap-2">
                               {(Array.isArray(formData[field.id]) ? formData[field.id] : (formData[field.id] ? String(formData[field.id]).split(',') : [])).map((tag, idx) => (
                                   <span key={idx} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm flex items-center gap-1 font-medium border border-indigo-100">
                                       {tag}
                                       <button type="button" onClick={() => {
                                           const current = Array.isArray(formData[field.id]) ? formData[field.id] : (formData[field.id] ? String(formData[field.id]).split(',') : []);
                                           setFormData(prev => ({ ...prev, [field.id]: current.filter((_, i) => i !== idx) }));
                                       }} className="hover:text-indigo-900 ml-1">
                                           <X size={14} />
                                       </button>
                                   </span>
                               ))}
                           </div>
                           <div className="relative group flex items-center">
                               <input
                                   type="text"
                                   id={`tag_input_${field.id}`}
                                   className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all placeholder:text-gray-400 text-gray-700 h-[48px]"
                                   placeholder={field.placeholder || `Type and click + to add ${field.label}`}
                                   onKeyDown={(e) => {
                                       if (e.key === 'Enter') {
                                           e.preventDefault();
                                           const val = e.target.value.trim();
                                           if (val) {
                                               const current = Array.isArray(formData[field.id]) ? formData[field.id] : (formData[field.id] ? String(formData[field.id]).split(',').filter(Boolean) : []);
                                               if (!current.includes(val)) {
                                                   setFormData(prev => ({ ...prev, [field.id]: [...current, val] }));
                                               }
                                               e.target.value = '';
                                           }
                                       }
                                   }}
                               />
                               <button
                                   type="button"
                                   onClick={(e) => {
                                       e.preventDefault();
                                       const input = document.getElementById(`tag_input_${field.id}`);
                                       if(input) {
                                           const val = input.value.trim();
                                           if (val) {
                                                const current = Array.isArray(formData[field.id]) ? formData[field.id] : (formData[field.id] ? String(formData[field.id]).split(',').filter(Boolean) : []);
                                                if (!current.includes(val)) {
                                                    setFormData(prev => ({ ...prev, [field.id]: [...current, val] }));
                                                }
                                                input.value = '';
                                           }
                                       }
                                   }}
                                   className="absolute right-2 p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors flex items-center justify-center"
                               >
                                   <Plus size={16} strokeWidth={3} />
                               </button>
                           </div>
                        </div>
                      ) : (
                        <div className="relative group">
                          <input
                            type={field.type}
                            name={field.id}
                            value={formData[field.id] || ''}
                            onChange={handleInputChange}
                            required={field.required}
                            readOnly={locationRole === 'zip' && locationLoading.zip}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all placeholder:text-gray-400 text-gray-700 h-[48px]"
                            placeholder={locationRole === 'zip' && locationLoading.zip ? 'Finding zip code...' : (field.placeholder || `Enter ${field.label}`)}
                          />
                        </div>
                      )}
                      {field.helpText && !['file', 'image'].includes(field.type) && (
                        <p className="text-[10px] font-bold text-gray-400 ml-1 mt-1">{field.helpText}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFallbackForm = () => (
    <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Full Name</label>
          <input name="name" value={formData.name} onChange={handleInputChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all placeholder:text-gray-400 h-[48px]" placeholder="John Doe" />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Father Name</label>
          <input name="fatherName" value={formData.fatherName} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all placeholder:text-gray-400 h-[48px]" placeholder="Guardian Name" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Email Address</label>
          <input name="email" value={formData.email} onChange={handleInputChange} type="email" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all placeholder:text-gray-400 h-[48px]" placeholder="name@example.com" />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Contact Number</label>
          <input name="mobile" value={formData.mobile} onChange={handleInputChange} type="tel" required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all placeholder:text-gray-400 h-[48px]" placeholder="+1..." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Date of Birth</label>
          <DatePicker
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all h-[48px]"
            format="DD/MM/YYYY"
            placeholder="Select DOB"
            onChange={(date, dateString) => setFormData(prev => ({ ...prev, dob: dateString }))}
            value={formData.dob ? dayjs(formData.dob, 'DD/MM/YYYY') : null}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Current Location</label>
          <input name="address" value={formData.address} onChange={handleInputChange} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all placeholder:text-gray-400 h-[48px]" placeholder="City, Country" />
        </div>
      </div>

      <div className="space-y-4">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Professional Resume (PDF/Word)</label>
        <label
          {...getDropZoneHandlers('fallback-resume', processResumeFile)}
          className={`group relative flex h-[48px] w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 text-left transition-all cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 ${draggingUpload === 'fallback-resume' ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-100' : 'border-gray-200 bg-gray-50/50'}`}
        >
          <input type="file" onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx" />
          <div className="bg-white w-8 h-8 rounded-full shadow-sm flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform border border-gray-100">
            <UploadCloud size={16} className="text-blue-500" />
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-700">
            {formData.resume ? formData.resume.name : 'Choose your file'}
          </span>
          <span className="hidden sm:block shrink-0 text-gray-400 font-medium text-[10px] uppercase tracking-wider">
            {draggingUpload === 'fallback-resume' ? "Drop file to upload" : parsing ? "Scanning resume and auto-filling..." : "Max file size: 5MB"}
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 selection:bg-indigo-100 selection:text-indigo-600 font-sans">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 h-20">
        <div className="px-6 lg:px-10 h-full flex items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all hover:bg-indigo-50"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="h-8 w-px bg-slate-100 mx-2"></div>
            <span className="text-lg font-black text-slate-800 tracking-tight">Job Application</span>
          </div>
        </div>
      </nav>

      <div className="pt-28 pb-20 max-w-[1500px] mx-auto px-4 lg:px-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        {/* Unified Card Container */}
        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-gray-100">

          {/* Top Banner Section (Inside Card) */}
          {customization?.applyPage && (
            <div
              className={`h-48 w-full relative overflow-hidden flex flex-col justify-end p-8 lg:p-12 transition-all duration-700`}
              style={customization.applyPage.banner?.bgType === 'image' ? {
                backgroundImage: `url(${customization.applyPage.banner.bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              } : {}}
            >
              {customization.applyPage.banner?.bgType !== 'image' && (
                <div className={`absolute inset-0 bg-gradient-to-r ${customization.applyPage.banner?.bgColor || 'from-blue-600 via-indigo-600 to-purple-600'}`}></div>
              )}
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="relative z-10 flex flex-col gap-3">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-bold uppercase tracking-wider text-white inline-block w-fit shadow-sm">
                  {requirement?.department || 'Engineering'}
                </span>

                <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight drop-shadow-sm leading-[1.1]">
                  {customization.applyPage.banner?.title || requirement?.jobTitle || 'Join Our Team'}
                </h1>

                <p className="text-white/90 font-medium text-base lg:text-lg max-w-3xl line-clamp-2 drop-shadow-sm">
                  {customization.applyPage.banner?.subtitle || (requirement ? `${requirement.workMode} • ${requirement.jobType} • ${requirement.location}` : 'Join our growing team')}
                </p>
              </div>
            </div>
          )}

          {/* Form Content Section (Inside Card) */}
          <div className="p-8 lg:p-12 bg-gray-50/30">
            <form onSubmit={handleSubmit} className="space-y-10">
              {error && (
                <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl text-rose-600 text-sm font-bold animate-in fade-in flex items-center gap-4 shadow-sm">
                  <ShieldCheck size={24} className="shrink-0" /> {error}
                </div>
              )}

              {customization?.applyPage ? renderDynamicForm() : (
                <>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-1 h-8 bg-blue-500 rounded-full shadow-sm"></div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                      Submit Application
                    </h3>
                  </div>
                  {renderFallbackForm()}
                </>
              )}

              {/* Reference Section Removed */}

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 hover:bg-black text-white py-5 rounded-xl font-bold shadow-xl active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-70 text-sm uppercase tracking-widest group"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Processing...
                    </>
                  ) : (
                    <>
                      Submit Application <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </>
                  )}
                </button>
                <p className="text-center text-[10px] font-bold text-gray-400 mt-8 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-500" /> Secure Job Application Submission
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
