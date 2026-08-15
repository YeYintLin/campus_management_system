import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/apiClient';
import { AuthContext } from '../context/AuthContext';
import { X, BookOpen, FileText, CheckCircle, Calendar, Award, Download, Folder } from 'lucide-react';
import { getNormalizedUserYear, normalizeYear, parseYearNumber } from '../utils/userYear';
import './Courses.css';

const yearFilters = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];
const palette = ['#6366f1', '#10b981', '#f97316', '#ec4899', '#0ea5e9'];

const deriveYearTag = (code = '', defaultYear = null) => {
    if (defaultYear) {
        return normalizeYear(defaultYear);
    }
    const clean = String(code).trim().toUpperCase();
    const match = clean.match(/[-_\s]?(\d{1,5})/);
    if (match) {
        const numStr = match[1];
        const firstDigit = numStr[0];
        if (firstDigit === '6') return '6th Year';
        if (firstDigit === '5') return '5th Year';
        if (firstDigit === '4') return '4th Year';
        if (firstDigit === '3') return '3rd Year';
        if (firstDigit === '2') return '2nd Year';
        if (firstDigit === '1') return '1st Year';
    }
    return '1st Year';
};

const yearNumberToLabel = (num) => {
    const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year' };
    return labels[num] || '1st Year';
};

const deriveSemFromCode = (code = '') => {
    const digits = String(code).replace(/[^0-9]/g, '');
    if (digits.length >= 5) {
        const semD = parseInt(digits[1], 10);
        if (semD === 1 || semD === 2) return semD;
    }
    return null;
};

const isCourseTaughtByTeacher = (course, user) => {
    if (!user) return false;
    const userTeacherId = user._id ? String(user._id) : (user.id ? String(user.id) : '');
    const userTeacherName = (user.name || '').toLowerCase().trim();
    const userTeacherEmail = (user.email || '').toLowerCase().trim();

    const cTeacher = course.teacher;
    if (!cTeacher) return false;

    let cId = '';
    let cName = '';
    let cEmail = '';

    if (typeof cTeacher === 'object' && cTeacher !== null) {
        cId = cTeacher._id ? String(cTeacher._id) : (cTeacher.id ? String(cTeacher.id) : '');
        cName = (cTeacher.name || '').toLowerCase().trim();
        cEmail = (cTeacher.email || '').toLowerCase().trim();
    } else if (typeof cTeacher === 'string') {
        cName = cTeacher.toLowerCase().trim();
        if (cTeacher.includes('@')) cEmail = cTeacher.toLowerCase().trim();
        else cId = cTeacher;
    }

    if (userTeacherId && cId && userTeacherId === cId) return true;
    if (userTeacherEmail && cEmail && userTeacherEmail === cEmail) return true;

    // Strip honorifics (Daw, U, Prof, Dr) for resilient matching
    const cleanUser = userTeacherName.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim();
    const cleanCourse = cName.replace(/\b(daw|u|prof|dr|mr|mrs|ms)\b/gi, '').trim();

    if (cleanUser.length >= 3 && cleanCourse.length >= 3) {
        if (cleanCourse.includes(cleanUser) || cleanUser.includes(cleanCourse)) return true;
    }

    return false;
};

const DEFAULT_GRADING_SCHEME = {
    finalExam: 40,
    midterm: 25,
    lab: 20,
    quizzes: 15,
};

const DEFAULT_CURRICULUM_MODULES = [
    { week: 'Weeks 1 – 4', title: 'Foundational Theory & Mathematics', description: 'Core definitions, mathematical modeling, system equations, and initial conditions.' },
    { week: 'Weeks 5 – 8', title: 'Intermediate Analysis & Laboratory Design', description: 'Transfer functions, frequency response, system stability, and simulation labs.' },
    { week: 'Weeks 9 – 12', title: 'Advanced Engineering Applications', description: 'Digital control, sensor integration, state-space representation, and case studies.' },
    { week: 'Weeks 13 – 16', title: 'Review, Project & Final Assessment', description: 'System optimization, team project demonstrations, and comprehensive final evaluation.' },
];

const DEFAULT_REFERENCES = [
    'TU Hmawbi Engineering Department Official Curriculum Guide',
    'Standard Academic Course Textbook & Lecture Manual',
    'IEEE & Digital Simulation Guidelines'
];

const initialCourseForm = {
    name: '',
    code: '',
    year: 1,
    description: '',
    teacher: '',
    gradingScheme: { ...DEFAULT_GRADING_SCHEME },
    curriculumModules: DEFAULT_CURRICULUM_MODULES.map(m => ({ ...m })),
    references: [...DEFAULT_REFERENCES],
};

const Courses = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const roleStr = (user?.role || '').toLowerCase().trim();
    const isAdmin = roleStr === 'admin' || roleStr === 'superadmin' || roleStr === 'academicadmin';
    const isTeacher = roleStr === 'teacher';
    const isStudent = roleStr === 'student';
    const studentYear = getNormalizedUserYear(user);
    const canCreateCourses = isAdmin;
    const canEditCourses = isAdmin || isTeacher;

    const [courses, setCourses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedYear, setSelectedYear] = useState(isStudent ? studentYear : 'All');
    const [selectedSemester, setSelectedSemester] = useState('All');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [teachers, setTeachers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalCourse, setModalCourse] = useState(null);
    const [formData, setFormData] = useState({ ...initialCourseForm });
    const [savingCourse, setSavingCourse] = useState(false);

    const teacherYears = useMemo(() => {
        if (!isTeacher) return [];
        const set = new Set();
        courses.forEach(c => {
            if (isCourseTaughtByTeacher(c, user)) {
                const yLabel = c.yearLabel ? normalizeYear(c.yearLabel) : normalizeYear(yearNumberToLabel(c.year || 1));
                if (yLabel && yLabel !== 'All') set.add(yLabel);
            }
        });
        const order = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', 'ME Program'];
        return order.filter(y => set.has(y));
    }, [isTeacher, courses, user]);

    const yearFilters = isStudent
        ? [studentYear]
        : isTeacher
        ? (teacherYears.length > 0 ? ['All', ...teacherYears] : ['All'])
        : ['All', '1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', 'ME Program'];

    const canManageCourse = (course) => {
        if (isAdmin) return true;
        if (isTeacher) {
            return isCourseTaughtByTeacher(course, user);
        }
        return false;
    };
    const [modalError, setModalError] = useState('');
    const [selectedSyllabus, setSelectedSyllabus] = useState(null);
    const [downloadConfirmCourse, setDownloadConfirmCourse] = useState(null);

    const handleDownloadSyllabusPDF = (course) => {
        if (!course) return;

        const yearTag = deriveYearTag(course.code);
        const instructor = course.teacher?.name || 'Faculty Member';
        const email = course.teacher?.email || 'N/A';
        const gs = course.gradingScheme || DEFAULT_GRADING_SCHEME;
        const modules = (course.curriculumModules && course.curriculumModules.length > 0) ? course.curriculumModules : DEFAULT_CURRICULUM_MODULES;
        const refs = (course.references && course.references.length > 0) ? course.references : DEFAULT_REFERENCES;

        const content = `================================================================================
                    TECHNOLOGICAL UNIVERSITY (HMAWBI)
                   DEPARTMENT OF ACADEMIC AFFAIRS
                     OFFICIAL COURSE SYLLABUS
================================================================================

SUBJECT CODE : ${course.code}
SUBJECT NAME : ${course.name}
ACADEMIC YEAR: ${yearTag}
INSTRUCTOR   : ${instructor} (${email})
STATUS       : Active Academic Offerings

--------------------------------------------------------------------------------
1. COURSE OVERVIEW & DESCRIPTION
--------------------------------------------------------------------------------
${course.description || 'Comprehensive curriculum covering theoretical foundations, analytical problem-solving, and practical laboratory implementations.'}

--------------------------------------------------------------------------------
2. GRADING & ASSESSMENT SCHEME
--------------------------------------------------------------------------------
- Final Examination       : ${gs.finalExam ?? 40}%
- Midterm Examination     : ${gs.midterm ?? 25}%
- Laboratory & Practical  : ${gs.lab ?? 20}%
- Quizzes & Assignments   : ${gs.quizzes ?? 15}%
- Total Score             : 100% (Minimum Passing Score: 50% / Grade C)

--------------------------------------------------------------------------------
3. 16-WEEK ACADEMIC CURRICULUM
--------------------------------------------------------------------------------
${modules.map(m => `[${m.week || 'Module'}]   ${m.title || ''}\n                ${m.description || ''}`).join('\n\n')}

--------------------------------------------------------------------------------
4. RECOMMENDED REFERENCE MATERIALS
--------------------------------------------------------------------------------
${refs.map(r => `- ${r}`).join('\n')}

================================================================================
Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
TU Hmawbi Smart Campus Management System
================================================================================
`;

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${course.code}_Syllabus.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const loadCourses = async () => {
        setLoading(true);
        setError('');
        try {
            const [coursesRes, timetableRes] = await Promise.all([
                apiClient.get('/courses').catch(() => ({ data: [] })),
                apiClient.get('/timetable').catch(() => ({ data: [] })),
            ]);

            const dbCourses = Array.isArray(coursesRes.data) ? coursesRes.data : [];
            const timetableData = Array.isArray(timetableRes.data) ? timetableRes.data : [];

            // Extract timetable legend items by code (timetable legend is authoritative)
            const timetableMap = new Map();
            timetableData.forEach(sheet => {
                const sheetYearNum = sheet.yearNumber || (sheet.yearLabel ? parseYearNumber(sheet.yearLabel) : 1);
                const sheetYear = sheet.yearLabel ? normalizeYear(sheet.yearLabel) : normalizeYear(sheetYearNum);
                let sheetSemNum = sheet.semesterNumber;
                if (!sheetSemNum && sheet.semesterLabel) {
                    sheetSemNum = sheet.semesterLabel.includes('2') ? 2 : 1;
                }

                if (Array.isArray(sheet.legend)) {
                    sheet.legend.forEach(item => {
                        if (item.code) {
                            const cleanCode = item.code.replace(/\s+/g, '').toUpperCase();
                            timetableMap.set(cleanCode, {
                                code: item.code.trim(),
                                name: item.subject || item.code,
                                year: sheetYearNum,
                                yearLabel: sheetYear,
                                semester: deriveSemFromCode(item.code) || sheetSemNum || 1,
                                teacherName: item.teacher ? item.teacher.trim() : '',
                                isFromTimetable: true
                            });
                        }
                    });
                }
            });

            // Process DB Courses & override with Timetable legend info if available
            const mergedCoursesMap = new Map();

            dbCourses.forEach(dbc => {
                const cleanCode = (dbc.code || '').replace(/\s+/g, '').toUpperCase();
                if (!cleanCode) return;

                const ttInfo = timetableMap.get(cleanCode);
                const effectiveYearNum = dbc.year || (ttInfo ? ttInfo.year : parseYearNumber(dbc.yearLabel));
                const effectiveYearLabel = normalizeYear(dbc.yearLabel || effectiveYearNum);
                const effectiveSem = dbc.semester || (ttInfo ? ttInfo.semester : deriveSemFromCode(dbc.code));

                let newCourseObj = null;

                if (ttInfo) {
                    newCourseObj = {
                        ...dbc,
                        name: dbc.name || ttInfo.name,
                        year: effectiveYearNum,
                        yearLabel: effectiveYearLabel,
                        semester: effectiveSem,
                        teacher: dbc.teacher || (ttInfo.teacherName ? { name: ttInfo.teacherName } : null),
                        isFromTimetable: true
                    };
                } else if (dbc.teacher) {
                    newCourseObj = {
                        ...dbc,
                        year: effectiveYearNum,
                        yearLabel: effectiveYearLabel,
                        semester: effectiveSem
                    };
                }

                if (newCourseObj) {
                    if (mergedCoursesMap.has(cleanCode)) {
                        const existing = mergedCoursesMap.get(cleanCode);
                        // Prefer the course that does NOT have the generic auto-generated description
                        const existingIsGeneric = existing.description && existing.description.includes('Official timetable subject offering');
                        const newIsGeneric = newCourseObj.description && newCourseObj.description.includes('Official timetable subject offering');
                        
                        if (existingIsGeneric && !newIsGeneric) {
                            mergedCoursesMap.set(cleanCode, newCourseObj);
                        }
                    } else {
                        mergedCoursesMap.set(cleanCode, newCourseObj);
                    }
                }
            });

            const mergedCourses = Array.from(mergedCoursesMap.values());
            const processedCodes = new Set(mergedCoursesMap.keys());

            // Add any remaining timetable legend subjects not yet in DB
            timetableMap.forEach((ttInfo, cleanCode) => {
                if (!processedCodes.has(cleanCode)) {
                    processedCodes.add(cleanCode);
                    mergedCourses.push({
                        _id: `tt_${ttInfo.code}`,
                        code: ttInfo.code,
                        name: ttInfo.name,
                        year: ttInfo.year,
                        yearLabel: ttInfo.yearLabel,
                        semester: ttInfo.semester || deriveSemFromCode(ttInfo.code) || 1,
                        description: `Official timetable subject offering for ${ttInfo.yearLabel}`,
                        teacher: ttInfo.teacherName ? { name: ttInfo.teacherName } : null,
                        students: [],
                        isFromTimetable: true,
                    });
                }
            });

            // Filter for Teacher role: strictly show subjects taught by this teacher
            let finalCourses = mergedCourses;
            if (isTeacher) {
                finalCourses = mergedCourses.filter(c => isCourseTaughtByTeacher(c, user));
            }

            // Final bulletproof deduplication by normalized code
            const finalDedup = new Map();
            finalCourses.forEach(c => {
                const key = (c.code || '').replace(/[\s-]+/g, '').toUpperCase();
                if (!key) return;
                if (finalDedup.has(key)) {
                    const existing = finalDedup.get(key);
                    const existingIsGeneric = (existing.description || '').includes('Official timetable subject offering');
                    const newIsGeneric = (c.description || '').includes('Official timetable subject offering');
                    if (existingIsGeneric && !newIsGeneric) {
                        finalDedup.set(key, c);
                    }
                } else {
                    finalDedup.set(key, c);
                }
            });

            setCourses(Array.from(finalDedup.values()));
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load courses');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCourses();
    }, []);

    useEffect(() => {
        if (!isAdmin && !isTeacher) return;
        const fetchTeachers = async () => {
            try {
                const { data } = await apiClient.get('/users?role=Teacher');
                setTeachers(data);
            } catch (err) {
                console.error('Unable to load teacher list', err);
            }
        };

        fetchTeachers();
    }, [isAdmin, isTeacher]);

    const resetForm = () => {
        setFormData({
            ...initialCourseForm,
            gradingScheme: { ...DEFAULT_GRADING_SCHEME },
            curriculumModules: DEFAULT_CURRICULUM_MODULES.map(m => ({ ...m })),
            references: [...DEFAULT_REFERENCES],
        });
        setModalCourse(null);
        setModalError('');
    };

    const openCourseModal = (course = null) => {
        setIsModalOpen(true);
        setModalCourse(course);
        setModalError('');
        if (course) {
            setFormData({
                name: course.name,
                code: course.code,
                year: course.year || 1,
                description: course.description || '',
                teacher: course.teacher?._id || course.teacher || '',
                gradingScheme: {
                    finalExam: course.gradingScheme?.finalExam ?? DEFAULT_GRADING_SCHEME.finalExam,
                    midterm: course.gradingScheme?.midterm ?? DEFAULT_GRADING_SCHEME.midterm,
                    lab: course.gradingScheme?.lab ?? DEFAULT_GRADING_SCHEME.lab,
                    quizzes: course.gradingScheme?.quizzes ?? DEFAULT_GRADING_SCHEME.quizzes,
                },
                curriculumModules: (course.curriculumModules && course.curriculumModules.length > 0)
                    ? course.curriculumModules.map(m => ({ ...m }))
                    : DEFAULT_CURRICULUM_MODULES.map(m => ({ ...m })),
                references: (course.references && course.references.length > 0)
                    ? [...course.references]
                    : [...DEFAULT_REFERENCES],
            });
        } else {
            resetForm();
        }
    };

    const closeCourseModal = () => {
        resetForm();
        setIsModalOpen(false);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGradingChange = (key, val) => {
        const num = Math.max(0, Math.min(100, Number(val) || 0));
        setFormData(prev => ({
            ...prev,
            gradingScheme: {
                ...prev.gradingScheme,
                [key]: num,
            }
        }));
    };

    const handleCurriculumChange = (index, field, val) => {
        setFormData(prev => {
            const modules = [...(prev.curriculumModules || DEFAULT_CURRICULUM_MODULES)];
            modules[index] = {
                ...modules[index],
                [field]: val,
            };
            return { ...prev, curriculumModules: modules };
        });
    };

    const handleSaveCourse = async (event) => {
        event.preventDefault();
        if (!canEditCourses || savingCourse) return;

        const payload = {
            name: formData.name,
            code: formData.code,
            year: Number(formData.year) || 1,
            description: formData.description,
            teacher: formData.teacher,
            gradingScheme: formData.gradingScheme,
            curriculumModules: formData.curriculumModules,
            references: formData.references,
        };

        if (modalCourse) {
            payload.students = (modalCourse.students?.map(student => student._id) ?? []);
        }

        setSavingCourse(true);
        setModalError('');

        try {
            if (modalCourse) {
                await apiClient.put(`/courses/${modalCourse._id}`, payload);
            } else {
                await apiClient.post('/courses', payload);
            }

            closeCourseModal();
            loadCourses();
        } catch (err) {
            setModalError(err.response?.data?.message || err.message || 'Unable to save course');
        } finally {
            setSavingCourse(false);
        }
    };

    const handleDeleteCourse = async (courseId) => {
        if (!window.confirm('Are you sure you want to delete this subject? This action cannot be undone.')) return;
        
        try {
            await apiClient.delete(`/courses/${courseId}`);
            closeCourseModal();
            loadCourses();
        } catch (err) {
            setModalError(err.response?.data?.message || err.message || 'Unable to delete course');
        }
    };

    const filteredCourses = courses.filter(course => {
        // Teacher role filter: only show courses taught by this specific teacher
        if (isTeacher && !isCourseTaughtByTeacher(course, user)) {
            return false;
        }

        const target = `${course.name} ${course.code} ${course.description || ''} ${course.teacher?.name || ''}`.toLowerCase();
        const matchesSearch = target.includes(searchTerm.toLowerCase());

        const courseYear = course.yearLabel ? normalizeYear(course.yearLabel) : normalizeYear(yearNumberToLabel(course.year || 1));
        const targetYear = normalizeYear(selectedYear);

        const matchesYear = targetYear === 'All' || courseYear === 'All' || courseYear === targetYear;

        let matchesSemester = true;
        if (selectedSemester !== 'All') {
            const targetSemNum = (selectedSemester === 'Semester 1' || selectedSemester === 1) ? 1 : 2;
            const cSem = course.semester || deriveSemFromCode(course.code);
            if (cSem) {
                matchesSemester = (cSem === targetSemNum);
            }
        }

        return matchesSearch && matchesYear && matchesSemester;
    });

    return (
        <div className={`courses-page${isModalOpen || selectedSyllabus ? '' : ' animate-fade-in'}`}>
            <header className="page-header">
                <div>
                    <h1>Subjects Directory</h1>
                    <p className="subtitle">
                        {isStudent ? `Showing ${studentYear} Academic Subjects` : 'Explore and manage academic subjects'}
                    </p>
                </div>
                <div className="header-actions">
                    <input
                        type="text"
                        placeholder="Search subjects..."
                        className="form-input search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {canCreateCourses && (
                        <button className="btn btn-primary" onClick={() => openCourseModal()}>
                            + Add Subject
                        </button>
                    )}
                </div>
            </header>

            <div className="year-filter-bar glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    {yearFilters.map(year => (
                        <button
                            key={year}
                            className={`year-tag ${selectedYear === year ? 'active' : ''}`}
                            onClick={() => setSelectedYear(year)}
                        >
                            {year}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.6rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginRight: '0.25rem' }}>Semester:</span>
                    {['All', 'Semester 1', 'Semester 2'].map(sem => (
                        <button
                            key={sem}
                            className={`year-tag ${selectedSemester === sem ? 'active' : ''}`}
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
                            onClick={() => setSelectedSemester(sem)}
                        >
                            {sem}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="glass-panel empty-state">
                    <p>{error}</p>
                </div>
            )}

            <div className="courses-grid">
                {loading ? (
                    <div className="glass-panel empty-state">
                        <p>Loading subjects...</p>
                    </div>
                ) : filteredCourses.length > 0 ? (
                    filteredCourses.map((course, index) => {
                        const enrolled = course.students?.length ?? 0;
                        const capacity = Math.max(enrolled + 5, 30);
                        const enrollmentPercentage = Math.min(100, Math.round((enrolled / capacity) * 100));
                        const status = enrollmentPercentage >= 100 ? 'Full' : 'Active';
                        const baseColor = palette[index % palette.length];
                        const yearTag = course.yearLabel || (course.year ? yearNumberToLabel(course.year) : deriveYearTag(course.code));
                        const isManageable = canManageCourse(course);
                        const courseSem = course.semester || deriveSemFromCode(course.code);

                        // Clean display code and title
                        let displayCode = (course.code || '').trim().replace(/^\(\d+\)\s*/, '');
                        if (displayCode.includes(' ')) {
                            displayCode = displayCode.split(' ')[0];
                        }

                        let displayName = (course.name || '').trim().replace(/^\(\d+\)\s*/, '');
                        // Strip repeated code from start of name if present
                        if (displayName.toUpperCase().startsWith(displayCode.toUpperCase())) {
                            displayName = displayName.substring(displayCode.length).trim();
                        }
                        // Strip teacher name from end of name if present
                        if (course.teacher?.name) {
                            const tName = course.teacher.name.trim();
                            if (displayName.endsWith(tName)) {
                                displayName = displayName.substring(0, displayName.length - tName.length).trim();
                            }
                        }
                        if (!displayName) displayName = course.code;

                        return (
                            <div key={course._id} className="glass-card course-card">
                                <div className="course-color-strip" style={{ backgroundColor: baseColor }}></div>
                                <div className="course-card-header">
                                    <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        <span className="course-code">{displayCode}</span>
                                        <span className="year-badge">{yearTag}</span>
                                        {courseSem && (
                                            <span className="year-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                                Sem {courseSem}
                                            </span>
                                        )}
                                    </div>
                                    <span className={`badge ${status === 'Full' ? 'badge-warning' : 'badge-success'}`}>
                                        {status}
                                    </span>
                                </div>

                                <div className="course-card-body">
                                    <h3>{displayName}</h3>
                                    <p className="course-instructor">Instructor: {course.teacher?.name || 'TBA'}</p>
                                    <p className="course-description">{course.description || 'No description yet.'}</p>

                                    <div className="course-meta">
                                        <span className="meta-item">{`Enrolled ${enrolled}`}</span>
                                        <span className="meta-item">{`Teacher: ${course.teacher?.email || '?'}`}</span>
                                    </div>

                                    <div className="enrollment-section">
                                        <div className="enrollment-header">
                                            <span className="enrollment-label">Enrollment</span>
                                            <span className="enrollment-stats">{`${enrolled} / ${capacity}`}</span>
                                        </div>
                                        <div className="progress-bar-container">
                                            <div
                                                className="progress-bar-fill"
                                                style={{
                                                    width: `${enrollmentPercentage}%`,
                                                    backgroundColor: status === 'Full' ? 'var(--warning)' : baseColor,
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="course-card-footer">
                                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSyllabus(course)}>
                                        View Syllabus
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                        onClick={() => navigate(`/files?folder=${encodeURIComponent(`${course.code} - ${course.name}`)}`)}
                                    >
                                        <Folder size={14} />
                                        Files
                                    </button>
                                    {isManageable && (
                                        <button
                                            className="btn btn-primary btn-sm"
                                            style={{ background: baseColor, border: 'none' }}
                                            onClick={() => openCourseModal(course)}
                                        >
                                            Manage
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="glass-panel empty-state">
                        <p>No subjects found matching your search.</p>
                    </div>
                )}
            </div>
            {canEditCourses && isModalOpen && (
                <div className="modal-overlay" onClick={closeCourseModal}>
                    <form
                        className="modal-content glass-panel course-modal"
                        onSubmit={handleSaveCourse}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <div>
                                <h2>{modalCourse ? 'Edit Subject' : 'Add Subject'}</h2>
                                <p className="subtitle">{modalCourse ? 'Modify existing data' : 'Create a new offering'}</p>
                            </div>
                            <button className="close-btn" type="button" onClick={closeCourseModal}><X size={18} /></button>
                        </div>

                        <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
                            <div className="form-group">
                                <label className="form-label">Subject Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    className="form-input"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subject Code</label>
                                <input
                                    type="text"
                                    name="code"
                                    className="form-input"
                                    value={formData.code}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Academic Year</label>
                                <select
                                    name="year"
                                    className="form-input"
                                    value={formData.year}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value={1}>1st Year</option>
                                    <option value={2}>2nd Year</option>
                                    <option value={3}>3rd Year</option>
                                    <option value={4}>4th Year</option>
                                    <option value={5}>5th Year</option>
                                    <option value={6}>6th Year</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Instructor</label>
                                <select
                                    name="teacher"
                                    className="form-input"
                                    value={formData.teacher}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value="">Select instructor</option>
                                    {teachers.map(teacher => (
                                        <option key={teacher._id} value={teacher._id}>
                                            {teacher.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Course Overview & Description</label>
                                <textarea
                                    name="description"
                                    className="form-input"
                                    rows={2}
                                    value={formData.description}
                                    onChange={handleFormChange}
                                    placeholder="Enter course scope, objectives, or laboratory overview..."
                                />
                            </div>

                            {/* GRADING & ASSESSMENT SCHEME (%) */}
                            <div className="form-section-title">
                                <span>Grading & Assessment Scheme</span>
                                {(() => {
                                    const sum = (Number(formData.gradingScheme?.finalExam) || 0) +
                                                (Number(formData.gradingScheme?.midterm) || 0) +
                                                (Number(formData.gradingScheme?.lab) || 0) +
                                                (Number(formData.gradingScheme?.quizzes) || 0);
                                    return (
                                        <span className={`grading-total-badge ${sum === 100 ? 'grading-total-valid' : 'grading-total-invalid'}`}>
                                            Total: {sum}% {sum === 100 ? '✓' : '(Target: 100%)'}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="grading-edit-grid">
                                <div className="grading-input-group">
                                    <label>Final Exam (%)</label>
                                    <div className="grading-input-wrap">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            className="form-input"
                                            value={formData.gradingScheme?.finalExam ?? 40}
                                            onChange={(e) => handleGradingChange('finalExam', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grading-input-group">
                                    <label>Midterm Exam (%)</label>
                                    <div className="grading-input-wrap">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            className="form-input"
                                            value={formData.gradingScheme?.midterm ?? 25}
                                            onChange={(e) => handleGradingChange('midterm', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grading-input-group">
                                    <label>Lab / Practical (%)</label>
                                    <div className="grading-input-wrap">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            className="form-input"
                                            value={formData.gradingScheme?.lab ?? 20}
                                            onChange={(e) => handleGradingChange('lab', e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grading-input-group">
                                    <label>Quizzes / Assign (%)</label>
                                    <div className="grading-input-wrap">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            className="form-input"
                                            value={formData.gradingScheme?.quizzes ?? 15}
                                            onChange={(e) => handleGradingChange('quizzes', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 16-WEEK ACADEMIC CURRICULUM MODULES */}
                            <div className="form-section-title">
                                <span>16-Week Academic Curriculum Outline</span>
                            </div>
                            {(formData.curriculumModules || DEFAULT_CURRICULUM_MODULES).map((mod, idx) => (
                                <div key={idx} className="curriculum-module-edit-card">
                                    <div className="curriculum-module-header">
                                        <span className="module-week">{mod.week || `Weeks ${idx * 4 + 1} – ${(idx + 1) * 4}`}</span>
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{ flex: 1, padding: '0.4rem 0.65rem', fontSize: '0.88rem' }}
                                            value={mod.title || ''}
                                            onChange={(e) => handleCurriculumChange(idx, 'title', e.target.value)}
                                            placeholder="Module topic title..."
                                        />
                                    </div>
                                    <textarea
                                        className="form-input"
                                        rows={2}
                                        style={{ fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                                        value={mod.description || ''}
                                        onChange={(e) => handleCurriculumChange(idx, 'description', e.target.value)}
                                        placeholder="Module content details & learning outcomes..."
                                    />
                                </div>
                            ))}

                            {modalError && (
                                <div className="alert alert-warning mt-4">
                                    {modalError}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                            {modalCourse ? (
                                <button type="button" className="btn btn-danger" onClick={() => handleDeleteCourse(modalCourse._id)} style={{ backgroundColor: '#ef4444', color: 'white' }}>
                                    Delete Subject
                                </button>
                            ) : (
                                <div></div>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={closeCourseModal}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={savingCourse}>
                                    {savingCourse ? 'Saving…' : modalCourse ? 'Save Changes' : 'Create Subject'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* View Syllabus Modal */}
            {selectedSyllabus && (() => {
                const gs = selectedSyllabus.gradingScheme || DEFAULT_GRADING_SCHEME;
                const modules = (selectedSyllabus.curriculumModules && selectedSyllabus.curriculumModules.length > 0)
                    ? selectedSyllabus.curriculumModules
                    : DEFAULT_CURRICULUM_MODULES;
                const refs = (selectedSyllabus.references && selectedSyllabus.references.length > 0)
                    ? selectedSyllabus.references
                    : DEFAULT_REFERENCES;

                return (
                    <div className="modal-overlay animate-fade-in" onClick={() => setSelectedSyllabus(null)}>
                        <div className="syllabus-modal glass-panel" onClick={(e) => e.stopPropagation()}>
                            <div className="syllabus-header">
                                <div className="syllabus-title-area">
                                    <div className="syllabus-meta-row">
                                        <span className="course-code-tag">{selectedSyllabus.code}</span>
                                        <span className="year-badge">{deriveYearTag(selectedSyllabus.code)}</span>
                                    </div>
                                    <h2>{selectedSyllabus.name}</h2>
                                    <p className="subtitle">Instructor: {selectedSyllabus.teacher?.name || 'Faculty Member'} ({selectedSyllabus.teacher?.email || 'TBA'})</p>
                                </div>
                                <button className="close-panel-btn" onClick={() => setSelectedSyllabus(null)}><X size={18} /></button>
                            </div>

                            <div className="syllabus-body">
                                <div className="syllabus-section">
                                    <h4>Course Overview & Description</h4>
                                    <p className="syllabus-desc">
                                        {selectedSyllabus.description || 'Comprehensive curriculum covering theoretical foundations, analytical problem-solving, and practical laboratory implementations.'}
                                    </p>
                                </div>

                                <div className="syllabus-section">
                                    <h4>Grading & Assessment Scheme</h4>
                                    <div className="grading-pills-grid">
                                        <div className="grading-pill"><span className="pill-label">Final Examination</span><span className="pill-val">{gs.finalExam ?? 40}%</span></div>
                                        <div className="grading-pill"><span className="pill-label">Midterm Exam</span><span className="pill-val">{gs.midterm ?? 25}%</span></div>
                                        <div className="grading-pill"><span className="pill-label">Lab & Practical Work</span><span className="pill-val">{gs.lab ?? 20}%</span></div>
                                        <div className="grading-pill"><span className="pill-label">Quizzes & Assignments</span><span className="pill-val">{gs.quizzes ?? 15}%</span></div>
                                    </div>
                                </div>

                                <div className="syllabus-section">
                                    <h4>16-Week Academic Curriculum</h4>
                                    <div className="modules-timeline">
                                        {modules.map((mod, idx) => (
                                            <div key={idx} className="module-item glass-panel">
                                                <div className="module-week">{mod.week || `Weeks ${idx * 4 + 1} – ${(idx + 1) * 4}`}</div>
                                                <div className="module-info">
                                                    <h5>{mod.title}</h5>
                                                    <p>{mod.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="syllabus-section">
                                    <h4>Recommended References</h4>
                                    <ul className="reference-list">
                                        {refs.map((ref, idx) => (
                                            <li key={idx}>{ref}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="syllabus-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setDownloadConfirmCourse(selectedSyllabus)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <Download size={16} />
                                    <span>Download Syllabus Document</span>
                                </button>
                                <button className="btn btn-secondary-glass" onClick={() => setSelectedSyllabus(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Download Confirmation & File Details Preview Modal */}
            {downloadConfirmCourse && (
                <div className="modal-overlay animate-fade-in" style={{ zIndex: 1100 }} onClick={() => setDownloadConfirmCourse(null)}>
                    <div className="glass-panel" style={{
                        width: '90%',
                        maxWidth: '520px',
                        padding: '1.75rem',
                        borderRadius: '20px',
                        background: 'var(--surface-color, #1e293b)',
                        border: '1px solid var(--surface-border, rgba(255,255,255,0.1))',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }} onClick={(e) => e.stopPropagation()}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'rgba(99,102,241,0.15)', padding: '0.6rem', borderRadius: '12px', color: '#6366f1' }}>
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Download Syllabus File</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Confirm file details before saving to device</p>
                                </div>
                            </div>
                            <button className="close-btn" type="button" onClick={() => setDownloadConfirmCourse(null)}><X size={18} /></button>
                        </div>

                        {/* File Metadata Preview Box */}
                        <div style={{
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '14px',
                            padding: '1.25rem',
                            marginBottom: '1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>File Name:</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#818cf8', fontFamily: 'monospace' }}>
                                    {downloadConfirmCourse.code}_Official_Syllabus.txt
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Subject & Year:</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff' }}>
                                    {downloadConfirmCourse.name} ({deriveYearTag(downloadConfirmCourse.code)})
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Course Instructor:</span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {downloadConfirmCourse.teacher?.name || 'Faculty Member'}
                                </span>
                            </div>

                            <div>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Included Document Sections:
                                </span>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#4ade80' }}>
                                        <CheckCircle size={14} /> <span>16-Week Outline</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#4ade80' }}>
                                        <CheckCircle size={14} /> <span>Grading Scheme (40/25/20/15)</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#4ade80' }}>
                                        <CheckCircle size={14} /> <span>Official Textbook List</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#4ade80' }}>
                                        <CheckCircle size={14} /> <span>Verified Academic Seal</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                className="btn btn-secondary-glass"
                                onClick={() => setDownloadConfirmCourse(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                    handleDownloadSyllabusPDF(downloadConfirmCourse);
                                    setDownloadConfirmCourse(null);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
                            >
                                <Download size={16} />
                                <span>Confirm & Download</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Courses;
