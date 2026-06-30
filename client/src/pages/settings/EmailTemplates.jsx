import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Tabs, message, Space, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import api from '../../utils/api';

const { Option } = Select;

const extractPlaceholders = (html, subject) => {
  const regex = /{{([a-zA-Z0-9_]+)}}/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(html || '')) !== null) {
    matches.add(match[1]);
  }
  while ((match = regex.exec(subject || '')) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
};

export default function EmailTemplates() {
  const [activeTab, setActiveTab] = useState('templates');

  // Templates State
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [form] = Form.useForm();
  const [newPlaceholderForm] = Form.useForm();
  const [editingId, setEditingId] = useState(null);
  
  const [htmlContent, setHtmlContent] = useState('');
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const reactQuillRef = useRef(null);

  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState({ subject: '', body: '' });

  // Module & Trigger state
  const [selectedModule, setSelectedModule] = useState('Recruitment');
  const [selectedTriggerType, setSelectedTriggerType] = useState(undefined);
  const [isCustomModule, setIsCustomModule] = useState(false);
  const [isCustomTrigger, setIsCustomTrigger] = useState(false);
  const [isCustomRecipient, setIsCustomRecipient] = useState(false);
  const [isTestEmailVisible, setIsTestEmailVisible] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmailError, setTestEmailError] = useState('');

  // Image upload & size modal state
  const [isImageSizeModalVisible, setIsImageSizeModalVisible] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState('');
  const [pendingImageInsertRange, setPendingImageInsertRange] = useState(null);
  const [imageWidth, setImageWidth] = useState('400');
  const [imageHeight, setImageHeight] = useState('auto');
  const [imageSizeUnit, setImageSizeUnit] = useState('px');
  const [imageAlign, setImageAlign] = useState('left');
  const [imageUploading, setImageUploading] = useState(false);

  // Custom Placeholders State
  const [userAddedPlaceholders, setUserAddedPlaceholders] = useState([]);
  const [isAddPlaceholderModalVisible, setIsAddPlaceholderModalVisible] = useState(false);

  const triggerTypesConfig = {
    Recruitment: [
      'INTERVIEW_SCHEDULED',
      'INTERVIEW_RESCHEDULED',
      'CANDIDATE_SELECTED',
      'CANDIDATE_REJECTED',
      'OFFER_RELEASED'
    ],
    Leave: [
      'LEAVE_APPLIED',
      'LEAVE_APPROVED',
      'LEAVE_REJECTED',
      'LEAVE_CANCELLED'
    ],
    Onboarding: [
      'WELCOME_EMAIL',
      'DOCUMENT_PENDING',
      'DOCUMENT_RECEIVED',
      'JOINING_REMINDER'
    ],
    General: [
      'PASSWORD_RESET',
      'ACCOUNT_CREATED',
      'ANNOUNCEMENT'
    ]
  };

  const placeholderConfig = {
    Leave: {
      LEAVE_APPLIED: [
        {
          section: 'Employee Details',
          placeholders: [
            { name: 'Employee Name', tag: '{{employeeName}}', desc: 'Full name of the employee' },
            { name: 'Employee Code', tag: '{{employeeCode}}', desc: 'Unique code of the employee' }
          ]
        },
        {
          section: 'Leave Details',
          placeholders: [
            { name: 'Leave Type', tag: '{{leaveType}}', desc: 'Type of leave applied (e.g. SL, CL)' },
            { name: 'From Date', tag: '{{fromDate}}', desc: 'Leave starting date' },
            { name: 'To Date', tag: '{{toDate}}', desc: 'Leave ending date' },
            { name: 'Total Days', tag: '{{totalDays}}', desc: 'Number of leave days' },
            { name: 'Leave Reason', tag: '{{leaveReason}}', desc: 'Reason for leave application' },
            { name: 'Request Date', tag: '{{requestDate}}', desc: 'Date of request' }
          ]
        },
        {
          section: 'Approval Details',
          placeholders: [
            { name: 'Approval Link', tag: '{{approvalLink}}', desc: 'Link to approve/reject leave request' }
          ]
        }
      ],
      LEAVE_APPROVED: [
        {
          section: 'General Details',
          placeholders: [
            { name: 'Employee Name', tag: '{{employeeName}}', desc: 'Full name of the employee' },
            { name: 'Employee Code', tag: '{{employeeCode}}', desc: 'Unique code of the employee' },
            { name: 'Company Name', tag: '{{companyName}}', desc: 'Name of the organization' },
            { name: 'Date', tag: '{{date}}', desc: 'Current date' }
          ]
        },
        {
          section: 'Leave Details',
          placeholders: [
            { name: 'Leave Type', tag: '{{leaveType}}', desc: 'Type of leave applied (e.g. SL, CL)' },
            { name: 'From Date', tag: '{{fromDate}}', desc: 'Leave starting date' },
            { name: 'To Date', tag: '{{toDate}}', desc: 'Leave ending date' },
            { name: 'Total Days', tag: '{{totalDays}}', desc: 'Number of leave days' },
            { name: 'Leave Reason', tag: '{{leaveReason}}', desc: 'Reason for leave application' }
          ]
        },
        {
          section: 'Approval Details',
          placeholders: [
            { name: 'Approver Name', tag: '{{approverName}}', desc: 'Name of the leave approver' },
            { name: 'Approval Date', tag: '{{approvalDate}}', desc: 'Date of leave approval' },
            { name: 'Approval Remarks', tag: '{{approvalRemarks}}', desc: 'Remarks/Comments from approver' },
            { name: 'Approval Level', tag: '{{approvalLevel}}', desc: 'Workflow approval level' }
          ]
        },
        {
          section: 'Balance Details',
          placeholders: [
            { name: 'Available Balance', tag: '{{availableBalance}}', desc: 'Updated leave balance' },
            { name: 'Used Leaves', tag: '{{usedLeaves}}', desc: 'Total number of used leaves' },
            { name: 'Pending Leaves', tag: '{{pendingLeaves}}', desc: 'Leaves pending approval' }
          ]
        }
      ],
      LEAVE_REJECTED: [
        {
          section: 'General Details',
          placeholders: [
            { name: 'Employee Name', tag: '{{employeeName}}', desc: 'Full name of the employee' },
            { name: 'Employee Code', tag: '{{employeeCode}}', desc: 'Unique code of the employee' },
            { name: 'Company Name', tag: '{{companyName}}', desc: 'Name of the organization' },
            { name: 'Date', tag: '{{date}}', desc: 'Current date' }
          ]
        },
        {
          section: 'Leave Details',
          placeholders: [
            { name: 'Leave Type', tag: '{{leaveType}}', desc: 'Type of leave applied (e.g. SL, CL)' },
            { name: 'From Date', tag: '{{fromDate}}', desc: 'Leave starting date' },
            { name: 'To Date', tag: '{{toDate}}', desc: 'Leave ending date' }
          ]
        },
        {
          section: 'Approval Details',
          placeholders: [
            { name: 'Approver Name', tag: '{{approverName}}', desc: 'Name of the leave approver' },
            { name: 'Rejection Reason', tag: '{{rejectionReason}}', desc: 'Reason for rejection' }
          ]
        },
        {
          section: 'Balance Details',
          placeholders: [
            { name: 'Available Balance', tag: '{{availableBalance}}', desc: 'Leave balance' }
          ]
        }
      ],
      LEAVE_CANCELLED: [
        {
          section: 'General Details',
          placeholders: [
            { name: 'Employee Name', tag: '{{employeeName}}', desc: 'Full name of the employee' },
            { name: 'Employee Code', tag: '{{employeeCode}}', desc: 'Unique code of the employee' },
            { name: 'Company Name', tag: '{{companyName}}', desc: 'Name of the organization' },
            { name: 'Date', tag: '{{date}}', desc: 'Current date' }
          ]
        },
        {
          section: 'Leave Details',
          placeholders: [
            { name: 'Leave Type', tag: '{{leaveType}}', desc: 'Type of leave applied (e.g. SL, CL)' },
            { name: 'From Date', tag: '{{fromDate}}', desc: 'Leave starting date' },
            { name: 'To Date', tag: '{{toDate}}', desc: 'Leave ending date' }
          ]
        },
        {
          section: 'Cancellation Details',
          placeholders: [
            { name: 'Cancelled By', tag: '{{cancelledBy}}', desc: 'Name of person who cancelled the leave' },
            { name: 'Cancelled Date', tag: '{{cancelledDate}}', desc: 'Date of cancellation' }
          ]
        }
      ]
    },
    Recruitment: {
      DEFAULT: [
        {
          section: 'Candidate Details',
          placeholders: [
            { name: 'Candidate Name', tag: '{{candidateName}}', desc: 'Full name of the candidate' },
            { name: 'Candidate Email', tag: '{{candidateEmail}}', desc: 'Email address of the candidate' }
          ]
        },
        {
          section: 'Interview Details',
          placeholders: [
            { name: 'Interview Date', tag: '{{interviewDate}}', desc: 'Scheduled date of the interview' },
            { name: 'Interview Time', tag: '{{interviewTime}}', desc: 'Scheduled time of the interview' }
          ]
        },
        {
          section: 'Offer Details',
          placeholders: [
            { name: 'Offered CTC', tag: '{{offeredCTC}}', desc: 'Offered CTC amount' },
            { name: 'Joining Date', tag: '{{joiningDate}}', desc: 'Date of joining' }
          ]
        }
      ]
    },
    Onboarding: {
      DEFAULT: [
        {
          section: 'Employee Details',
          placeholders: [
            { name: 'Employee Name', tag: '{{employeeName}}', desc: 'Full name of the employee' },
            { name: 'Employee Code', tag: '{{employeeCode}}', desc: 'Unique code of the employee' }
          ]
        },
        {
          section: 'Onboarding Details',
          placeholders: [
            { name: 'Document Name', tag: '{{documentName}}', desc: 'Name of document(s) requested or received' },
            { name: 'Joining Date', tag: '{{joiningDate}}', desc: 'Date of joining' },
            { name: 'Task Name', tag: '{{taskName}}', desc: 'Name of the onboarding task' },
            { name: 'Company Name', tag: '{{companyName}}', desc: 'Name of the organization' }
          ]
        }
      ]
    },
    General: {
      DEFAULT: [
        {
          section: 'Employee Details',
          placeholders: [
            { name: 'Employee Name', tag: '{{employeeName}}', desc: 'Full name of the employee' },
            { name: 'Employee Code', tag: '{{employeeCode}}', desc: 'Unique code of the employee' }
          ]
        },
        {
          section: 'Action & Info',
          placeholders: [
            { name: 'Reset Link', tag: '{{resetLink}}', desc: 'Password reset link' },
            { name: 'Announcement Title', tag: '{{announcementTitle}}', desc: 'Title of the announcement' },
            { name: 'Account Username', tag: '{{username}}', desc: 'Username of the user account' },
            { name: 'Company Name', tag: '{{companyName}}', desc: 'Name of the organization' }
          ]
        }
      ]
    },
    Custom: {
      DEFAULT: [
        {
          section: 'General Details',
          placeholders: [
            { name: 'Employee/Candidate Name', tag: '{{employeeName}}', desc: 'Full name' },
            { name: 'Employee Code', tag: '{{employeeCode}}', desc: 'Unique code of the employee' },
            { name: 'Company Name', tag: '{{companyName}}', desc: 'Name of your organization' },
            { name: 'Date', tag: '{{date}}', desc: 'Relevant event date' },
            { name: 'Link/URL', tag: '{{link}}', desc: 'Action URL or link' }
          ]
        }
      ]
    }
  };

  const mockDetails = {
    // Recruitment
    candidateName: 'John Doe',
    candidateEmail: 'johndoe@example.com',
    interviewDate: '28-Jun-2026',
    interviewTime: '10:30 AM',
    offeredCTC: '₹ 8,50,000',
    joiningDate: '01-Jul-2026',
    ctcYearly: '₹ 8,50,000',
    designation: 'Senior Software Engineer',
    department: 'Engineering',
    offerExpiry: '25th June, 2026',
    approvalUrl: '#',
    companyName: 'Gitakshmi Enterprises',

    // Leave
    employeeName: 'Iva Harpal',
    employeeCode: 'EMP042',
    leaveType: 'Casual Leave',
    fromDate: '25-Jun-2026',
    toDate: '27-Jun-2026',
    totalDays: '3',
    approverName: 'HR Team',
    leaveReason: 'Family emergency',
    requestDate: '23-Jun-2026',
    approvalLink: 'https://gitakshmi.com/approve-leave/mock-id',
    approvalDate: '24-Jun-2026',
    approvalRemarks: 'Approved. Handover task to peer.',
    approvalLevel: 'L1 Manager',
    rejectionReason: 'Project deadline critical. Please postpone if possible.',
    cancelledBy: 'Iva Harpal',
    cancelledDate: '24-Jun-2026',
    availableBalance: '15',
    usedLeaves: '5',
    pendingLeaves: '1',
    date: '23-Jun-2026',

    // Onboarding
    documentName: 'Aadhar Card and PAN Card',
    taskName: 'Verify Bank Details',

    // General
    resetLink: 'https://gitakshmi.com/reset-password?token=mock_token',
    announcementTitle: 'Annual Company Picnic 2026',
    username: 'robert.d',

    // Fallbacks
    currentCTC: '₹ 7,50,000',
    hikePercentage: '13.3%',
    currentDesignation: 'Software Engineer',
    ctcBreakdown: `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; text-align: left; border: 1px solid #e0e0e0; font-family: sans-serif;">
        <thead>
          <tr style="background-color: #f8f9fa; border-bottom: 2px solid #e0e0e0;">
            <th style="padding: 10px; border: 1px solid #e0e0e0;">Salary Component</th>
            <th style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">Monthly (₹)</th>
            <th style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">Yearly (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #f1f3f5; font-weight: bold;">
            <td colspan="3" style="padding: 8px 10px; border: 1px solid #e0e0e0;">A. Earnings (Gross Pay)</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Basic Salary</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">35,417</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">4,25,000</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">House Rent Allowance (HRA)</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">17,708</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">2,12,500</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Special Allowance</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">12,500</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">1,50,000</td>
          </tr>
          <tr style="font-weight: bold; background-color: #f8f9fa;">
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Total Gross Earnings (A)</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">65,625</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">7,87,500</td>
          </tr>
          <tr style="background-color: #f1f3f5; font-weight: bold;">
            <td colspan="3" style="padding: 8px 10px; border: 1px solid #e0e0e0;">B. Employer Contributions & Retirals</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Employer Provident Fund (PF)</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">4,250</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">51,000</td>
          </tr>
          <tr>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Gratuity (Provisional)</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">958</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">11,500</td>
          </tr>
          <tr style="font-weight: bold; background-color: #f8f9fa;">
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; padding-left: 20px;">Total Benefits (B)</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">5,208</td>
            <td style="padding: 8px 10px; border: 1px solid #e0e0e0; text-align: right;">62,500</td>
          </tr>
          <tr style="font-weight: bold; background-color: #e9ecef; border-top: 2px solid #ced4da;">
            <td style="padding: 10px; border: 1px solid #e0e0e0;">Total Cost to Company (CTC)</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">70,833</td>
            <td style="padding: 10px; border: 1px solid #e0e0e0; text-align: right;">8,50,000</td>
          </tr>
        </tbody>
      </table>
    `
  };

  const getMockValueForTag = (tag) => {
    if (mockDetails[tag] !== undefined) {
      return mockDetails[tag];
    }
    const lower = tag.toLowerCase();
    if (lower === 'first_name') return 'Iva';
    if (lower === 'last_name') return 'Harpal';
    if (lower.includes('name')) return 'Iva Harpal';
    if (lower.includes('email')) return 'employee@company.com';
    if (lower.includes('date')) return '23-Jun-2026';
    if (lower.includes('link') || lower.includes('url')) return 'https://gitakshmi.com/mock-link';
    if (lower.includes('ctc') || lower.includes('salary') || lower.includes('amount')) return '₹ 8,50,000';
    return `[${tag.split(/(?=[A-Z])|_/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}]`;
  };

  const handlePreview = () => {
    const formValues = form.getFieldsValue();
    const currentSubject = formValues.subject || '';
    const currentBody = htmlContent || '';

    let parsedSubject = currentSubject;
    let parsedBody = currentBody;

    const allTags = extractPlaceholders(currentBody, currentSubject);
    allTags.forEach(tag => {
      const regex = new RegExp(`{{${tag}}}`, 'g');
      const val = getMockValueForTag(tag);
      parsedSubject = parsedSubject.replace(regex, val);
      parsedBody = parsedBody.replace(regex, val);
    });

    setPreviewData({ subject: parsedSubject, body: parsedBody });
    setIsPreviewVisible(true);
  };

  const showTestEmailModal = () => {
    setIsTestEmailVisible(true);
  };

  const handleSendTestEmail = async () => {
    if (!testRecipient) {
      message.error('Please enter a recipient email address');
      return;
    }

    setSendingTest(true);
    setTestEmailError('');
    try {
      const formValues = form.getFieldsValue();
      const currentSubject = formValues.subject || 'Test Email from Gitakshmi HRMS';
      const currentBody = htmlContent || '<p>This is a test email from Gitakshmi HRMS.</p>';

      let parsedSubject = currentSubject;
      let parsedBody = currentBody;

      const allTags = extractPlaceholders(currentBody, currentSubject);
      allTags.forEach(tag => {
        const regex = new RegExp(`{{${tag}}}`, 'g');
        const val = getMockValueForTag(tag);
        parsedSubject = parsedSubject.replace(regex, val);
        parsedBody = parsedBody.replace(regex, val);
      });

      const { data } = await api.post('/email-templates/send-test', {
        to: testRecipient,
        subject: parsedSubject,
        html: parsedBody
      });

      if (data.success) {
        message.success('✅ Test email sent successfully to ' + testRecipient);
        setIsTestEmailVisible(false);
        setTestRecipient('');
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Failed to send test email. Please check your SMTP Settings.';
      setTestEmailError(errMsg);
    } finally {
      setSendingTest(false);
    }
  };

  const imageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      // Save cursor position before async upload
      const quill = reactQuillRef.current?.getEditor();
      const range = quill ? quill.getSelection(true) : { index: 0 };
      setPendingImageInsertRange(range);

      const formData = new FormData();
      formData.append('file', file);

      setImageUploading(true);
      message.loading({ content: 'Uploading image...', key: 'image_upload' });
      try {
        const { data } = await api.post('/uploads/email-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (data.success) {
          let imageUrl = data.url;
          if (imageUrl.startsWith('/')) {
            const backendUrl = api.defaults?.baseURL || '';
            const cleanBase = backendUrl.replace(/\/api\/?$/, '') || window.location.origin;
            imageUrl = `${cleanBase}${imageUrl}`;
          }
          message.success({ content: 'Image uploaded! Now set size below.', key: 'image_upload' });
          setPendingImageUrl(imageUrl);
          setImageWidth('400');
          setImageHeight('auto');
          setImageSizeUnit('px');
          setImageAlign('left');
          setIsImageSizeModalVisible(true);
        } else {
          message.error({ content: 'Failed to upload image', key: 'image_upload' });
        }
      } catch (err) {
        console.error(err);
        message.error({ content: 'Image upload failed', key: 'image_upload' });
      } finally {
        setImageUploading(false);
      }
    };
  };

  const handleInsertImage = () => {
    const quill = reactQuillRef.current?.getEditor();
    if (!quill || !pendingImageUrl) return;

    const widthVal  = imageWidth  ? `${imageWidth}${imageSizeUnit}`  : '';
    const heightVal = (imageHeight && imageHeight !== 'auto') ? `${imageHeight}${imageSizeUnit}` : '';

    // Step 1: Insert image embed at cursor
    const index = pendingImageInsertRange ? pendingImageInsertRange.index : Math.max(0, quill.getLength() - 1);
    quill.insertEmbed(index, 'image', pendingImageUrl, 'user');
    quill.setSelection(index + 1, 0, 'user');

    // Step 2: After Quill renders the <img>, set size + alignment directly on the DOM node
    // This bypasses Quill's clipboard sanitizer which strips style attributes
    setTimeout(() => {
      const imgs = quill.root.querySelectorAll('img');
      let targetImg = null;
      imgs.forEach(img => {
        if (img.getAttribute('src') === pendingImageUrl) targetImg = img;
      });

      if (targetImg) {
        // Set both attribute and style so it works in email clients AND in editor
        if (widthVal)  { targetImg.style.width  = widthVal;  targetImg.setAttribute('width',  imageWidth); }
        if (heightVal) { targetImg.style.height = heightVal; targetImg.setAttribute('height', imageHeight); }
        targetImg.style.display = 'block';
        targetImg.style.maxWidth = widthVal || '100%';

        // Apply alignment via parent paragraph
        const parent = targetImg.closest('p') || targetImg.parentElement;
        if (parent) {
          parent.style.textAlign = imageAlign;
          if (imageAlign === 'center') {
            targetImg.style.margin = '0 auto';
          } else if (imageAlign === 'right') {
            targetImg.style.marginLeft = 'auto';
          }
        }

        // Step 3: Sync the real DOM HTML (with our inline styles) back into React state
        // so the saved template body has correct width/height attributes
        const updatedHtml = quill.root.innerHTML;
        setHtmlContent(updatedHtml);
      }
    }, 50);

    setIsImageSizeModalVisible(false);
    setPendingImageUrl('');
    setPendingImageInsertRange(null);
    message.success('✅ Image inserted with size ' + (widthVal || 'auto') + (heightVal ? ' × ' + heightVal : ''));
  };

  const quillModules = React.useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    clipboard: {
      matchVisual: false  // Prevents Quill from stripping inline styles on paste
    }
  }), []);

  const insertPlaceholder = (tag) => {
    const quill = reactQuillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection(true);
      quill.insertText(range.index, tag);
      quill.setSelection(range.index + tag.length);
    }
  };

  const handleDragStart = (e, tag) => {
    e.dataTransfer.setData('text/plain', tag);
  };

  // SMTP State
  const [smtpConfig, setSmtpConfig] = useState({});
  const [smtpForm] = Form.useForm();
  const [smtpLoading, setSmtpLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchSmtpConfig();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/email-templates');
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (err) {
      message.error('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const fetchSmtpConfig = async () => {
    try {
      const { data } = await api.get('/email-templates/smtp');
      if (data.success && data.smtpConfig) {
        setSmtpConfig(data.smtpConfig);
        smtpForm.setFieldsValue(data.smtpConfig);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSmtpSave = async (values) => {
    setSmtpLoading(true);
    try {
      const { data } = await api.put('/email-templates/smtp', values);
      if (data.success) {
        message.success('SMTP Configuration saved successfully');
        setSmtpConfig(data.smtpConfig);
      }
    } catch (err) {
      message.error('Failed to save SMTP configuration');
    } finally {
      setSmtpLoading(false);
    }
  };

  const openModal = (record = null) => {
    if (record) {
      setEditingId(record._id);

      const predefinedModules = ['Recruitment', 'Leave', 'Onboarding', 'General'];
      const isModCustom = record.module && !predefinedModules.includes(record.module);
      let initialModule = record.module || 'Recruitment';
      let customModValue = '';
      if (isModCustom) {
        initialModule = 'Custom';
        customModValue = record.module;
      }
      setSelectedModule(record.module || 'Recruitment');
      setIsCustomModule(isModCustom);

      const predefinedTriggers = triggerTypesConfig[record.module] || [];
      const isTrigCustom = record.triggerType && !predefinedTriggers.includes(record.triggerType);
      let initialTrigger = record.triggerType || undefined;
      let customTrigValue = '';
      if (isTrigCustom) {
        initialTrigger = 'Custom';
        customTrigValue = record.triggerType;
      }
      setSelectedTriggerType(record.triggerType || undefined);
      setIsCustomTrigger(isTrigCustom);

      const predefinedRecipients = ['Reporting Manager', 'Employee', 'Candidate', 'HR Team'];
      const isRecCustom = record.recipientType && !predefinedRecipients.includes(record.recipientType);
      let initialRecipient = record.recipientType || undefined;
      let customRecValue = '';
      if (isRecCustom) {
        initialRecipient = 'Custom';
        customRecValue = record.recipientType;
      }
      setIsCustomRecipient(isRecCustom);

      form.setFieldsValue({
        ...record,
        module: initialModule,
        customModule: customModValue,
        triggerType: initialTrigger,
        customTriggerType: customTrigValue,
        recipientType: initialRecipient,
        customRecipientType: customRecValue
      });
      setHtmlContent(record.bodyHtml || '');
    } else {
      setEditingId(null);
      form.resetFields();
      setSelectedModule('Recruitment');
      setSelectedTriggerType(undefined);
      setIsCustomModule(false);
      setIsCustomTrigger(false);
      setIsCustomRecipient(false);
      form.setFieldsValue({ module: 'Recruitment', isActive: true });
      setHtmlContent('');
    }
    setIsEditingMode(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const values = await form.validateFields();

      let finalModule = values.module;
      if (values.module === 'Custom') {
        finalModule = values.customModule;
      }

      let finalTriggerType = values.triggerType;
      if (values.triggerType === 'Custom') {
        finalTriggerType = values.customTriggerType;
      }

      let finalRecipientType = values.recipientType;
      if (values.recipientType === 'Custom') {
        finalRecipientType = values.customRecipientType;
      }
      
      const payload = {
        ...values,
        module: finalModule,
        triggerType: finalTriggerType,
        recipientType: finalRecipientType,
        bodyHtml: htmlContent
      };

      if (editingId) {
        await api.put(`/email-templates/${editingId}`, payload);
        message.success('Template updated successfully');
      } else {
        await api.post('/email-templates', payload);
        message.success('Template created successfully');
      }
      setIsEditingMode(false);
      fetchTemplates();
    } catch (error) {
      console.log('Validation/Save failed:', error);
      message.error('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await api.delete(`/email-templates/${id}`);
      message.success('Template deleted successfully');
      fetchTemplates();
    } catch (err) {
      message.error('Failed to delete template');
    }
  };

  const handlePreviewRecord = (record) => {
    const currentSubject = record.subject || '';
    const currentBody = record.bodyHtml || '';

    let parsedSubject = currentSubject;
    let parsedBody = currentBody;

    const allTags = extractPlaceholders(currentBody, currentSubject);
    allTags.forEach(tag => {
      const regex = new RegExp(`{{${tag}}}`, 'g');
      const val = getMockValueForTag(tag);
      parsedSubject = parsedSubject.replace(regex, val);
      parsedBody = parsedBody.replace(regex, val);
    });

    setPreviewData({ subject: parsedSubject, body: parsedBody });
    setIsPreviewVisible(true);
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (val) => <span className="font-medium">{val}</span> },
    {
      title: 'Module',
      dataIndex: 'module',
      key: 'module',
      render: (val) => {
        const colors = { Leave: 'blue', Recruitment: 'purple', Onboarding: 'green', General: 'orange' };
        const color = colors[val] || 'default';
        return <span style={{ color: color === 'blue' ? '#1677ff' : color === 'purple' ? '#722ed1' : color === 'green' ? '#52c41a' : color === 'orange' ? '#fa8c16' : '#666', fontWeight: 600, fontSize: 12 }}>{val}</span>;
      }
    },
    { title: 'Trigger Type', dataIndex: 'triggerType', key: 'triggerType', render: (val) => <code style={{ fontSize: 11 }}>{val}</code> },
    { title: 'Recipient Type', dataIndex: 'recipientType', key: 'recipientType', render: (val) => val || '-' },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (val) => (
        <span style={{
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
          background: val ? '#f6ffed' : '#fff1f0',
          color: val ? '#52c41a' : '#ff4d4f',
          border: `1px solid ${val ? '#b7eb8f' : '#ffa39e'}`
        }}>
          {val ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            title="Preview Template"
            onClick={() => handlePreviewRecord(record)}
          />
          <Button icon={<EditOutlined />} title="Edit Template" onClick={() => openModal(record)} />
          <Button danger icon={<DeleteOutlined />} title="Delete Template" onClick={() => handleDeleteTemplate(record._id)} />
        </Space>
      )
    }
  ];

  const getActivePlaceholders = () => {
    const modConfig = placeholderConfig[selectedModule] || placeholderConfig['Custom'];
    let groups = [];

    if (selectedTriggerType && modConfig[selectedTriggerType]) {
      groups = JSON.parse(JSON.stringify(modConfig[selectedTriggerType]));
    } else if (modConfig.DEFAULT) {
      groups = JSON.parse(JSON.stringify(modConfig.DEFAULT));
    } else if (Array.isArray(modConfig)) {
      groups = [{ section: 'Placeholders', placeholders: JSON.parse(JSON.stringify(modConfig)) }];
    } else {
      groups = JSON.parse(JSON.stringify(placeholderConfig.Custom.DEFAULT));
    }

    const predefinedTags = new Set();
    groups.forEach(g => {
      g.placeholders.forEach(p => {
        predefinedTags.add(p.tag);
      });
    });

    const customList = [];
    userAddedPlaceholders.forEach(p => {
      if (!predefinedTags.has(p.tag)) {
        customList.push(p);
      }
    });

    const currentSubject = form.getFieldValue('subject') || '';
    const currentBody = htmlContent || '';
    const extractedTags = extractPlaceholders(currentBody, currentSubject);
    extractedTags.forEach(tagKey => {
      const fullTag = `{{${tagKey}}}`;
      if (!predefinedTags.has(fullTag) && !customList.some(c => c.tag === fullTag)) {
        customList.push({
          name: tagKey.split(/(?=[A-Z])|_/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
          tag: fullTag,
          desc: 'Extracted from template content'
        });
      }
    });

    if (customList.length > 0) {
      groups.push({
        section: 'Custom & Added Details',
        placeholders: customList
      });
    }

    return groups;
  };

  const activePlaceholderGroups = getActivePlaceholders();
  const activeTriggers = triggerTypesConfig[selectedModule] || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{isEditingMode ? (editingId ? 'Edit Template' : 'Create Template') : 'Email Configuration'}</h1>

      {!isEditingMode ? (
        <>
          <Alert 
            message={<span className="font-bold text-base">System Manual: Connecting Templates to System Events</span>}
            description={<div className="mt-2 text-gray-700">
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Design:</strong> Create your email here and assign it a unique <strong>Trigger Type</strong> (e.g., <code>WELCOME_EMAIL</code>).</li>
                <li><strong>Trigger:</strong> System events will automatically use this template matching the specified <strong>Trigger Type</strong>.</li>
              </ul>
            </div>}
            type="info"
            showIcon
            className="mb-6 shadow-sm rounded-lg border-blue-200 bg-blue-50/50"
          />

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'templates',
                label: 'Email Templates',
                children: (
                  <Card
                    title="Templates"
                    extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Create Template</Button>}
                  >
                    <Table
                      dataSource={templates}
                      columns={columns}
                      rowKey="_id"
                      loading={loading}
                    />
                  </Card>
                )
              },
              {
                key: 'smtp',
                label: 'SMTP Settings',
                children: (
                  <Card title="SMTP Configuration" className="max-w-2xl">
                    <Alert
                      type="info"
                      showIcon
                      className="mb-4"
                      message="SMTP Setup Required for Email Sending"
                      description="Configure your SMTP server here to enable sending actual emails (Leave notifications, Offer letters, etc.). For Gmail, use an App Password (not your regular password). Enable 2-Factor Authentication first, then generate an App Password from your Google account."
                    />
                    <Form layout="vertical" form={smtpForm} onFinish={handleSmtpSave}>
                      <Form.Item label="SMTP Host" name="host" rules={[{ required: true }]}>
                        <Input placeholder="smtp.gmail.com" />
                      </Form.Item>
                      <Form.Item label="SMTP Port" name="port" rules={[{ required: true }]}>
                        <Input type="number" placeholder="587" />
                      </Form.Item>
                      <Form.Item label="Use Secure (TLS/SSL)" name="secure" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                      <Form.Item label="Username (Email)" name="user" rules={[{ required: true }]}>
                        <Input placeholder="youremail@gmail.com" />
                      </Form.Item>
                      <Form.Item label="Password / App Password" name="pass" rules={[{ required: true }]}>
                        <Input.Password placeholder="Gmail App Password (16 chars, no spaces)" />
                      </Form.Item>
                      <Form.Item label="From Email" name="fromEmail">
                        <Input placeholder="noreply@yourcompany.com" />
                      </Form.Item>
                      <Form.Item label="From Name" name="fromName">
                        <Input placeholder="Gitakshmi HR Team" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={smtpLoading}>
                        Save SMTP Settings
                      </Button>
                    </Form>
                  </Card>
                )
              }
            ]}
          />
        </>
      ) : (
        <Card title={editingId ? 'Edit Template' : 'Create Template'} extra={
          <Space>
            <Button onClick={() => setIsEditingMode(false)}>Cancel</Button>
            <Button type="default" onClick={handlePreview}>Preview Template</Button>
            <Button type="default" onClick={showTestEmailModal}>Send Test Email</Button>
            <Button type="primary" onClick={handleSaveTemplate}>Save Template</Button>
          </Space>
        }>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Editor Form */}
            <div className="col-span-1 lg:col-span-9">
              <Form form={form} layout="vertical" initialValues={{ isActive: true }}>
                <div className="grid grid-cols-2 gap-4">
                  <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item label="Active" name="isActive" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Form.Item label="Module" name="module" rules={[{ required: true }]}>
                    <Select onChange={(val) => {
                      setSelectedModule(val);
                      setIsCustomModule(val === 'Custom');
                      form.setFieldsValue({ triggerType: undefined, customModule: '', customTriggerType: '' });
                      setIsCustomTrigger(false);
                      setSelectedTriggerType(undefined);
                    }}>
                      <Option value="Recruitment">Recruitment</Option>
                      <Option value="Leave">Leave</Option>
                      <Option value="Onboarding">Onboarding</Option>
                      <Option value="General">General</Option>
                      <Option value="Custom">Custom Module</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="Trigger Type" name="triggerType" rules={[{ required: true }]}>
                    <Select placeholder="Select trigger type" onChange={(val) => {
                      setIsCustomTrigger(val === 'Custom');
                      setSelectedTriggerType(val);
                      form.setFieldsValue({ customTriggerType: '' });
                    }}>
                      {activeTriggers.map(t => (
                        <Option key={t} value={t}>{t}</Option>
                      ))}
                      <Option value="Custom">Custom Trigger</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label="Recipient Type" name="recipientType" rules={[{ required: true }]}>
                    <Select placeholder="Select recipient" onChange={(val) => {
                      setIsCustomRecipient(val === 'Custom');
                      form.setFieldsValue({ customRecipientType: '' });
                    }}>
                      <Option value="Reporting Manager">Reporting Manager</Option>
                      <Option value="Employee">Employee</Option>
                      <Option value="Candidate">Candidate</Option>
                      <Option value="HR Team">HR Team</Option>
                      <Option value="Custom">Custom Recipient</Option>
                    </Select>
                  </Form.Item>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {isCustomModule && (
                    <Form.Item label="Custom Module Name" name="customModule" rules={[{ required: true, message: 'Please enter custom module name' }]}>
                      <Input placeholder="e.g. PMS, Approval" onChange={(e) => setSelectedModule(e.target.value || 'Custom')} />
                    </Form.Item>
                  )}
                  {isCustomTrigger && (
                    <Form.Item label="Custom Trigger Name" name="customTriggerType" rules={[{ required: true, message: 'Please enter custom trigger name' }]}>
                      <Input placeholder="e.g. PMS_SCORE_UPDATED" onChange={(e) => setSelectedTriggerType(e.target.value || undefined)} />
                    </Form.Item>
                  )}
                  {isCustomRecipient && (
                    <Form.Item label="Custom Recipient Name" name="customRecipientType" rules={[{ required: true, message: 'Please enter custom recipient name' }]}>
                      <Input placeholder="e.g. Department Head" />
                    </Form.Item>
                  )}
                </div>
                <Form.Item label="Subject" name="subject" rules={[{ required: true }]}>
                  <Input placeholder="e.g. Offer Letter - {{candidateName}}" />
                </Form.Item>
                
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-medium">Email Content</label>
                    <Button 
                      size="small" 
                      onClick={() => setIsHtmlMode(!isHtmlMode)}
                      type={isHtmlMode ? "primary" : "default"}
                    >
                      {isHtmlMode ? "Switch to Visual Editor" : "Switch to HTML Editor"}
                    </Button>
                  </div>
                  <div className="bg-white" style={{ minHeight: '400px' }}>
                    {isHtmlMode ? (
                      <Input.TextArea
                        value={htmlContent}
                        onChange={(e) => setHtmlContent(e.target.value)}
                        style={{ height: '350px', fontFamily: 'monospace', fontSize: '13px' }}
                        placeholder="Paste your HTML code here..."
                      />
                    ) : (
                      <ReactQuill
                        ref={reactQuillRef}
                        theme="snow"
                        value={htmlContent}
                        onChange={setHtmlContent}
                        style={{ height: '350px' }}
                        modules={quillModules}
                      />
                    )}
                  </div>
                </div>
              </Form>
            </div>

            {/* Right Column: Placeholders Panel */}
            <div className="col-span-1 lg:col-span-3">
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl shadow-sm sticky top-4">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-slate-800 text-sm">Placeholders Panel</h3>
                  <Button size="small" type="primary" className="text-[10px] px-2 h-6" onClick={() => setIsAddPlaceholderModalVisible(true)}>
                    + Add Custom
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                  💡 Drag a placeholder directly into the subject or editor, or click to insert at cursor position.
                </p>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {activePlaceholderGroups.map((group) => (
                    <div key={group.section} className="space-y-1.5">
                      <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-100/50 pb-0.5 mt-2">
                        {group.section}
                      </div>
                      {group.placeholders.map((p) => (
                        <div
                          key={p.tag}
                          draggable="true"
                          onDragStart={(e) => handleDragStart(e, p.tag)}
                          onClick={() => insertPlaceholder(p.tag)}
                          className="cursor-grab select-none active:cursor-grabbing border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/50 p-2.5 rounded-lg flex flex-col gap-0.5 text-xs text-slate-700 shadow-sm hover:shadow transition-all duration-200 text-left group"
                          title="Drag into the editor or click to insert"
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className="font-bold text-slate-800 text-[11px]">{p.name}</span>
                            <span className="font-mono text-[9px] bg-slate-100 group-hover:bg-indigo-100 text-slate-500 group-hover:text-indigo-600 px-1.5 py-0.5 rounded transition-colors">{p.tag}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 group-hover:text-indigo-400/80 transition-colors leading-tight">{p.desc}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Preview Modal */}
      <Modal
        title={<span className="font-bold text-lg text-slate-800 font-sans">Email Format Preview</span>}
        open={isPreviewVisible}
        onCancel={() => setIsPreviewVisible(false)}
        footer={[
          <Button key="close" type="primary" className="bg-indigo-600 border-none rounded-lg" onClick={() => setIsPreviewVisible(false)}>
            Close Preview
          </Button>
        ]}
        width={800}
        styles={{ body: { padding: '24px', backgroundColor: '#f8f9fa' } }}
      >
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm font-sans">
          {/* Email Header */}
          <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-2">
            <div className="flex text-sm">
              <span className="font-bold text-slate-500 w-20">Subject:</span>
              <span className="text-slate-800 font-semibold">{previewData.subject}</span>
            </div>
            <div className="flex text-sm">
              <span className="font-bold text-slate-500 w-20">From:</span>
              <span className="text-slate-600 font-medium">noreply@notifications.gitakshmi.com</span>
            </div>
            <div className="flex text-sm">
              <span className="font-bold text-slate-500 w-20">To:</span>
              <span className="text-slate-600 font-medium">johndoe@example.com</span>
            </div>
          </div>

          {/* Email Body */}
          <div className="p-6 overflow-auto max-h-[500px]">
            <div 
              className="prose max-w-none text-slate-800"
              dangerouslySetInnerHTML={{ __html: previewData.body }} 
            />
          </div>
        </div>
      </Modal>

      {/* Test Email Recipient Modal */}
      <Modal
        title={<span className="font-bold text-lg text-slate-800 font-sans">Send Test Email</span>}
        open={isTestEmailVisible}
        onCancel={() => { setIsTestEmailVisible(false); setTestEmailError(''); setTestRecipient(''); }}
        onOk={handleSendTestEmail}
        okText="Send Email"
        confirmLoading={sendingTest}
        okButtonProps={{ disabled: !testRecipient }}
      >
        <div className="py-4 space-y-4">
          {testEmailError && (
            <Alert
              type="error"
              showIcon
              message="Failed to Send Test Email"
              description={
                <div>
                  <p className="mb-2">{testEmailError}</p>
                  {testEmailError.toLowerCase().includes('smtp') && (
                    <Button
                      size="small"
                      type="link"
                      className="p-0"
                      onClick={() => {
                        setIsTestEmailVisible(false);
                        setTestEmailError('');
                        setActiveTab('smtp');
                        setIsEditingMode(false);
                      }}
                    >
                      → Go to SMTP Settings
                    </Button>
                  )}
                </div>
              }
            />
          )}
          <div>
            <p className="text-sm text-slate-600 mb-3">
              Placeholders will be replaced with sample data. Enter the recipient email:
            </p>
            <Input
              placeholder="hr-test@company.com"
              value={testRecipient}
              onChange={(e) => { setTestRecipient(e.target.value); setTestEmailError(''); }}
              onPressEnter={handleSendTestEmail}
            />
          </div>
        </div>
      </Modal>

      {/* Add Custom Placeholder Modal */}
      <Modal
        title={<span className="font-bold text-lg text-slate-800 font-sans">Add Custom Placeholder</span>}
        open={isAddPlaceholderModalVisible}
        onCancel={() => {
          setIsAddPlaceholderModalVisible(false);
          newPlaceholderForm.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await newPlaceholderForm.validateFields();
            const cleanTag = values.tag.replace(/[{}]/g, '').trim();
            const newP = {
              name: values.name.trim(),
              tag: `{{${cleanTag}}}`,
              desc: (values.desc || 'User custom details').trim()
            };
            setUserAddedPlaceholders(prev => [...prev, newP]);
            setIsAddPlaceholderModalVisible(false);
            newPlaceholderForm.resetFields();
            message.success(`Placeholder {{${cleanTag}}} added successfully!`);
          } catch (err) {
            console.error(err);
          }
        }}
        okText="Add Placeholder"
      >
        <Form form={newPlaceholderForm} layout="vertical">
          <Form.Item name="name" label="Placeholder Name" rules={[{ required: true, message: 'Please enter placeholder name' }]}>
            <Input placeholder="e.g. First Name" />
          </Form.Item>
          <Form.Item name="tag" label="Placeholder Tag/Key" rules={[{ required: true, message: 'Please enter tag key' }]}>
            <Input placeholder="e.g. first_name" />
          </Form.Item>
          <Form.Item name="desc" label="Description">
            <Input placeholder="e.g. First name of the employee" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Image Size & Alignment Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 20 }}>🖼️</span>
            <span className="font-bold text-lg text-slate-800">Insert Image</span>
          </div>
        }
        open={isImageSizeModalVisible}
        onCancel={() => { setIsImageSizeModalVisible(false); setPendingImageUrl(''); }}
        onOk={handleInsertImage}
        okText="Insert Image"
        okButtonProps={{ disabled: !pendingImageUrl }}
        width={520}
      >
        <div className="py-2 space-y-5">
          {/* Preview */}
          {pendingImageUrl && (
            <div
              className="border border-dashed border-slate-300 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden"
              style={{ minHeight: 140, textAlign: imageAlign }}
            >
              <img
                src={pendingImageUrl}
                alt="preview"
                style={{
                  width: imageWidth ? `${imageWidth}${imageSizeUnit}` : 'auto',
                  height: (imageHeight && imageHeight !== 'auto') ? `${imageHeight}${imageSizeUnit}` : 'auto',
                  maxWidth: '100%',
                  maxHeight: 200,
                  objectFit: 'contain',
                  display: 'inline-block'
                }}
              />
            </div>
          )}

          {/* Unit Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600 w-20">Size Unit:</span>
            <div className="flex gap-2">
              {['px', '%'].map(u => (
                <button
                  key={u}
                  onClick={() => setImageSizeUnit(u)}
                  style={{
                    padding: '4px 18px',
                    borderRadius: 6,
                    border: imageSizeUnit === u ? '2px solid #6366f1' : '1px solid #d1d5db',
                    background: imageSizeUnit === u ? '#eef2ff' : '#fff',
                    color: imageSizeUnit === u ? '#4f46e5' : '#374151',
                    fontWeight: imageSizeUnit === u ? 700 : 400,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >{u}</button>
              ))}
            </div>
          </div>

          {/* Width */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600 w-20">Width:</span>
            <Input
              type="number"
              value={imageWidth}
              onChange={e => setImageWidth(e.target.value)}
              suffix={imageSizeUnit}
              placeholder="e.g. 400"
              style={{ width: 140 }}
              min={1}
            />
            <span className="text-xs text-slate-400">Leave empty for auto</span>
          </div>

          {/* Height */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600 w-20">Height:</span>
            <Input
              type="number"
              value={imageHeight === 'auto' ? '' : imageHeight}
              onChange={e => setImageHeight(e.target.value || 'auto')}
              suffix={imageHeight === 'auto' ? '' : imageSizeUnit}
              placeholder="auto"
              style={{ width: 140 }}
              min={1}
            />
            <span className="text-xs text-slate-400">Leave empty for auto</span>
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600 w-20">Align:</span>
            <div className="flex gap-2">
              {[
                { val: 'left',   icon: '⬅️', label: 'Left' },
                { val: 'center', icon: '↔️', label: 'Center' },
                { val: 'right',  icon: '➡️', label: 'Right' }
              ].map(a => (
                <button
                  key={a.val}
                  onClick={() => setImageAlign(a.val)}
                  style={{
                    padding: '4px 14px',
                    borderRadius: 6,
                    border: imageAlign === a.val ? '2px solid #6366f1' : '1px solid #d1d5db',
                    background: imageAlign === a.val ? '#eef2ff' : '#fff',
                    color: imageAlign === a.val ? '#4f46e5' : '#374151',
                    fontWeight: imageAlign === a.val ? 700 : 400,
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >{a.icon} {a.label}</button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
