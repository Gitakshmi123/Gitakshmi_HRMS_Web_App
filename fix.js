const fs = require('fs');
const file = 'c:/Users/baldaniya nitesh/Desktop/PROJECT/GT_HRMS/client/src/components/RequirementForm.jsx';
let content = fs.readFileSync(file, 'utf8');

const correctImports = `import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../utils/api';
import {
    Briefcase,
    Users,
    User,
    Clock,
    MapPin,
    Shield,
    Eye,
    EyeOff,
    Plus,
    Trash2,
    Check,
    ArrowRight,
    ArrowLeft,
    Building2,
    Calendar,
    ChevronRight,
    ChevronDown,
    Search,
    Type,
    Layers,
    X,
    Zap,
    AlertTriangle,
    Settings,
    Globe,
    Lock,
    Unlock,
    Target,
    FileText,
    GripVertical,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import StageModal from './StageModal';
import FeedbackTemplateBuilder from './FeedbackTemplateBuilder';
import CustomSelect from './shared/CustomSelect';
import toast from 'react-hot-toast';
import { DEPARTMENT_OPTIONS, getDesignationsForDepartment, ALL_DESIGNATION_OPTIONS } from '../constants/departmentDesignationMaster';
import { COUNTRY_OPTIONS, getCitiesForState, getStatesForCountry } from '../constants/locationMaster';

const COMMON_SKILLS = [
`;

const replaceRegex = /import React.*?const COMMON_SKILLS = \[/s;
content = content.replace(replaceRegex, correctImports);
fs.writeFileSync(file, content);
console.log('Fixed');
