import React, { useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Award, BookOpen, Download, Printer, TrendingUp, HelpCircle, ChevronLeft, User, Search, Users, FileText, Eye, X, Upload, FileSpreadsheet, Check, FileUp } from 'lucide-react';
import apiClient from '../api/apiClient';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, TableBorders, TextRun, VerticalAlign } from 'docx';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import './Grades.css';

const yearLookup = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

const semesterToYearLabel = (semester) => {
    if (!semester) return '1st Year';
    const bucket = Math.min(6, Math.max(1, Math.ceil(semester / 2)));
    return yearLookup[bucket - 1] || `${bucket}th Year`;
};

const deriveYearTag = (code = '') => {
    const digits = code?.match(/\d+/);
    if (!digits) return '1st Year';
    const number = parseInt(digits[0], 10);
    if (number < 200) return '1st Year';
    if (number < 300) return '2nd Year';
    if (number < 400) return '3rd Year';
    if (number < 500) return '4th Year';
    if (number < 600) return '5th Year';
    return '6th Year';
};

const getAvatarUrl = (name, id) => {
    const initials = name ? encodeURIComponent(name) : encodeURIComponent(id || 'Student');
    return `https://ui-avatars.com/api/?name=${initials}&background=1f2937&color=ffffff`;
};

const gradeYearFilters = ['All', ...yearLookup];

const normalizeGradeRecords = (records) => {
    const map = { default: [] };
    records.forEach(record => {
        const studentId = record.student?._id || record.student;
        if (!studentId) return;

        const entry = {
            term: record.term || 'Current Term',
            course: record.course?.code || record.course || 'GEN101',
            title: record.assessmentType || record.course?.name || 'Assessment',
            credits: record.course?.credits || 3,
            score: record.score ?? 0,
        };

        map[studentId] = [...(map[studentId] || []), entry];
    });
    return map;
};

const Grades = () => {
    const { user } = useContext(AuthContext);
    const isStudent = user?.role === 'Student';
    const canManageGrades = user?.role === 'Admin' || user?.role === 'Teacher';

    const location = useLocation();
    const navigate = useNavigate();
    const [studentList, setStudentList] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedYear, setSelectedYear] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [gradesData, setGradesData] = useState({ default: [] });
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState('');
    const [editingCell, setEditingCell] = useState(null); // { studentId, course }
    const [showPreview, setShowPreview] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [excelFile, setExcelFile] = useState(null);
    const [parsedMarks, setParsedMarks] = useState([]);
    const [importStatus, setImportStatus] = useState({ loading: false, error: '', success: '' });

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('import') === 'true' || location.state?.openImport) {
            setShowImportModal(true);
        }
    }, [location.search, location.state]);

    const handleDownloadMarksTemplate = () => {
        const templateData = [
            ['Roll No / ID', 'Student Name', 'Student Email', 'Course Code', 'Assessment Type', 'Score', 'Max Score', 'Comments'],
        ];

        if (studentList.length > 0) {
            studentList.forEach((s) => {
                const sampleCourse = courses[0]?.code || 'McE 61011';
                templateData.push([s.rollNo || s.id, s.name, s.email, sampleCourse, 'Final Exam', '', 100, '']);
            });
        } else {
            templateData.push(['STU-6001', 'Ye Yint Lin', 'studentuser@gmail.com', 'McE 61011', 'Final Exam', 85, 100, 'Sample grade']);
            templateData.push(['STU-6002', 'Aung Aung', 'aung@gmail.com', 'McE 61011', 'Final Exam', 90, 100, 'Sample grade']);
        }

        const ws = XLSX.utils.aoa_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Student Marks');
        XLSX.writeFile(wb, `Student_Marks_Import_Template.xlsx`);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setExcelFile(file);
        setImportStatus({ loading: true, error: '', success: '' });

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const buffer = evt.target.result;
                const workbook = XLSX.read(buffer, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (rawData.length < 2) {
                    setImportStatus({ loading: false, error: 'Excel sheet appears empty or missing rows.', success: '' });
                    return;
                }

                const records = [];
                for (let i = 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!row || row.length < 4) continue;

                    const rollNo = String(row[0] || '').trim();
                    const studentName = String(row[1] || '').trim();
                    const studentEmail = String(row[2] || '').trim();
                    const courseCode = String(row[3] || '').trim();
                    const assessmentType = String(row[4] || 'Final Exam').trim();
                    const score = Number(row[5]);
                    const maxScore = Number(row[6] || 100);
                    const comments = String(row[7] || '').trim();

                    if (!isNaN(score) && (rollNo || studentEmail || studentName) && courseCode) {
                        records.push({
                            rollNo,
                            studentName,
                            studentEmail,
                            courseCode,
                            assessmentType,
                            score,
                            maxScore,
                            comments
                        });
                    }
                }

                if (records.length === 0) {
                    setImportStatus({ loading: false, error: 'No valid mark records found in Excel sheet. Check column headers & scores.', success: '' });
                } else {
                    setParsedMarks(records);
                    setImportStatus({ loading: false, error: '', success: `Successfully parsed ${records.length} mark records.` });
                }
            } catch (err) {
                console.error('Excel parse error:', err);
                setImportStatus({ loading: false, error: 'Failed to read Excel file. Please ensure it is a valid .xlsx or .csv file.', success: '' });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSaveImportedMarks = async () => {
        if (parsedMarks.length === 0) return;
        setImportStatus({ loading: true, error: '', success: '' });
        try {
            const { data } = await apiClient.post('/grades/bulk', { grades: parsedMarks });
            setImportStatus({ loading: false, error: '', success: data.message || 'Marks imported successfully!' });
            setTimeout(() => {
                setShowImportModal(false);
                setParsedMarks([]);
                setExcelFile(null);
                window.location.reload();
            }, 1200);
        } catch (err) {
            setImportStatus({ loading: false, error: err.response?.data?.message || 'Failed to save imported marks.', success: '' });
        }
    };

    const years = gradeYearFilters;

    useEffect(() => {
        if (!user) return;
        const fetchCourses = async () => {
            try {
                const { data } = await apiClient.get('/courses');
                setCourses(data);
            } catch (error) {
                console.error('Unable to load courses', error);
            }
        };

        fetchCourses();
    }, [user]);

    useEffect(() => {
        if (!canManageGrades) return;
        const fetchStudents = async () => {
            try {
                const { data } = await apiClient.get('/students');
                const mapped = data.map(student => ({
                    id: student.user?._id || student._id,
                    displayId: student.enrollmentNumber,
                    name: student.user?.name || 'Student',
                    major: student.department || 'Undeclared',
                    year: semesterToYearLabel(student.semester),
                    avatar: getAvatarUrl(student.user?.name, student.user?._id),
                    semester: student.semester,
                    user: student.user,
                }));
                setStudentList(mapped);
            } catch (error) {
                console.error('Failed to load students', error);
            }
        };

        fetchStudents();
    }, [canManageGrades]);

    useEffect(() => {
        if (!user) return;
        if (!courses.length) {
            setGradesData({ default: [] });
            setDataLoading(false);
            setDataError('');
            return;
        }
        const fetchGradeRecords = async () => {
            setDataLoading(true);
            setDataError('');
            try {
                const gradePromises = courses.map(course => {
                    if (canManageGrades) {
                        return apiClient.get(`/grades/course/${course._id}`);
                    }
                    return apiClient.get(`/grades/student/${user._id}/course/${course._id}`);
                });
                const responses = await Promise.all(gradePromises);
                const records = responses.flatMap((res) => res.data);
                const normalized = normalizeGradeRecords(records);
                normalized.default = normalized.default || [];
                setGradesData(normalized);
            } catch (error) {
                setDataError(error.response?.data?.message || error.message || 'Failed to load grade data');
            } finally {
                setDataLoading(false);
            }
        };

        fetchGradeRecords();
    }, [courses, user, canManageGrades]);

    useEffect(() => {
        if (location.state?.studentId && studentList.length) {
            const student = studentList.find(s => s.id === location.state.studentId);
            if (student) {
                setSelectedStudent(student);
                return;
            }
        }

        if (canManageGrades) {
            setSelectedStudent(null);
            return;
        }

        if (isStudent) {
            setSelectedStudent({
                id: user?._id,
                name: user?.name || 'Student',
                year: semesterToYearLabel(user?.semester),
            });
            return;
        }

        setSelectedStudent(null);
    }, [location.state, location.pathname, user, studentList, canManageGrades, isStudent]);

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
        navigate('/grades', { replace: true, state: {} });
    };

    const calculateLetterGrade = (score) => {
        if (score >= 81) return 'A';
        if (score >= 61) return 'B';
        if (score >= 41) return 'C';
        if (score >= 21) return 'D';
        return 'E';
    };

    const getGradePoints = (grade) => {
        const points = { 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'E': 0.0 };
        return points[grade] || 0;
    };

    const calculateGPA = (studentId) => {
        const grades = gradesData[studentId] || gradesData['default'];
        const totalPoints = grades.reduce((acc, g) => {
            const letterGrade = calculateLetterGrade(g.score);
            return acc + (getGradePoints(letterGrade) * g.credits);
        }, 0);
        const totalCredits = grades.reduce((acc, g) => acc + g.credits, 0);
        return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
    };

    const handleSaveScore = async (studentId, courseCode, newScore) => {
        if (!canManageGrades || !studentId) return;

        const score = Math.max(0, Math.min(100, Number.isFinite(Number(newScore)) ? Math.round(Number(newScore)) : 0));
        const gradeRecord = (gradesData[studentId] || []).find(g => g.course === courseCode);
        const courseCandidates = courses.find(c => c.code === courseCode) || {};
        const courseIdForPost = gradeRecord?.courseId || courseCandidates._id;
        const assessmentType = gradeRecord?.assessmentType || courseCode;

        if (!courseIdForPost) {
            setDataError(`Unable to determine course id for ${courseCode}`);
            setEditingCell(null);
            return;
        }

        try {
            const { data } = await apiClient.post('/grades', {
                course: courseIdForPost,
                student: studentId,
                assessmentType,
                score,
                maxScore: 100,
            });

            const updatedEntry = {
                courseId: data.course?._id || courseIdForPost,
                course: data.course?.code || courseCode,
                title: data.course?.name || assessmentType,
                credits: data.course?.credits || 3,
                score: data.score ?? score,
                assessmentType: data.assessmentType || assessmentType,
            };

            setGradesData(prev => {
                const studentGrades = [...(prev[studentId] || [])];
                const gradeIndex = studentGrades.findIndex(g => g.course === updatedEntry.course && g.assessmentType === updatedEntry.assessmentType);
                if (gradeIndex > -1) {
                    studentGrades[gradeIndex] = updatedEntry;
                } else {
                    studentGrades.push(updatedEntry);
                }

                return { ...prev, [studentId]: studentGrades };
            });
            setDataError('');
        } catch (error) {
            console.error('Failed to save grade', error);
            setDataError(error.response?.data?.message || error.message || `Unable to save grade for ${courseCode}`);
        } finally {
            setEditingCell(null);
        }
    };

    const handleExportWord = async () => {
        const tableHeaderRows = [
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ text: "ID", alignment: AlignmentType.CENTER, style: "Normal" })],
                        shading: { fill: "f3f4f6" },
                        verticalAlign: VerticalAlign.CENTER
                    }),
                    new TableCell({
                        children: [new Paragraph({ text: "NAME", alignment: AlignmentType.CENTER, style: "Normal" })],
                        shading: { fill: "f3f4f6" },
                        verticalAlign: VerticalAlign.CENTER
                    }),
                    ...allSubjects.map(sub => new TableCell({
                        children: [new Paragraph({ text: sub, alignment: AlignmentType.CENTER, style: "Normal" })],
                        shading: { fill: "f3f4f6" },
                        verticalAlign: VerticalAlign.CENTER
                    })),
                    ],
            }),
        ];

        const tableBodyRows = studentList.map(student => {
            const studentGrades = getGrades(student.id);

            return new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ text: student.displayId || student.id, alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph({ text: student.name.toUpperCase() })] }),
                    
                    ...allSubjects.map(sub => {
                        const gradeRecord = studentGrades.find(g => g.course === sub);
                        const letterGrade = gradeRecord ? calculateLetterGrade(gradeRecord.score) : "-";
                        return new TableCell({ children: [new Paragraph({ text: letterGrade, alignment: AlignmentType.CENTER })] });
                    }),
                    
                ],
            });
        });

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 inch margins
                    }
                },
                children: [
                    // Institutional Header
                    new Paragraph({
                        children: [
                            new TextRun({ text: "ALTAIR INSTITUTE OF TECHNOLOGY", bold: true, size: 28 }),
                        ],
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Office of the Registrar | Academic Records Division", size: 20 }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({ text: "OFFICIAL ACADEMIC PERFORMANCE REGISTRY", bold: true, size: 24, underline: {} }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({ text: `Date Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, size: 20 }),
                        ],
                        alignment: AlignmentType.RIGHT,
                        spacing: { after: 400 }
                    }),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [...tableHeaderRows, ...tableBodyRows],
                    }),

                    new Paragraph({ text: "", spacing: { before: 800 } }),

                    // Signatures
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: TableBorders.NONE,
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        children: [
                                            new Paragraph({ text: "__________________________", alignment: AlignmentType.CENTER }),
                                            new Paragraph({ text: "Registrar Signature", alignment: AlignmentType.CENTER, bold: true }),
                                        ],
                                    }),
                                    new TableCell({
                                        children: [
                                            new Paragraph({ text: "__________________________", alignment: AlignmentType.CENTER }),
                                            new Paragraph({ text: "Date of Approval", alignment: AlignmentType.CENTER, bold: true }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({
                        text: "This document is an official record of the Altair Institute of Technology.",
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 400 },
                        children: [
                            new TextRun({ text: "\nVerification Code: AIT-REG-" + Math.random().toString(36).substring(7).toUpperCase(), size: 16, color: "666666" })
                        ]
                    }),
                ],
            }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `Academic_Registry_${new Date().getFullYear()}.docx`);
    };

    const getGrades = (studentId) => {
        return gradesData[studentId] || gradesData['default'];
    };

    // Get filtered students first
    const filteredStudents = studentList.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesYear = selectedYear === 'All' || s.year === selectedYear;
        return matchesSearch && matchesYear;
    });

    // Robust helper: derive academic year label from course object (yearLabel, year string/num, or course code digits e.g. McE-52039 -> 5th Year)
    const deriveCourseYearLabel = (c) => {
        if (!c) return '1st Year';
        if (c.yearLabel) {
            const str = String(c.yearLabel).trim().toLowerCase();
            if (str.includes('1') || str.includes('first')) return '1st Year';
            if (str.includes('2') || str.includes('second')) return '2nd Year';
            if (str.includes('3') || str.includes('third')) return '3rd Year';
            if (str.includes('4') || str.includes('fourth')) return '4th Year';
            if (str.includes('5') || str.includes('fifth')) return '5th Year';
            if (str.includes('6') || str.includes('sixth') || str.includes('final')) return '6th Year';
        }
        if (c.year) {
            if (typeof c.year === 'number') {
                const labels = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year' };
                if (labels[c.year]) return labels[c.year];
            }
            const str = String(c.year).trim().toLowerCase();
            if (str.includes('1') || str.includes('first')) return '1st Year';
            if (str.includes('2') || str.includes('second')) return '2nd Year';
            if (str.includes('3') || str.includes('third')) return '3rd Year';
            if (str.includes('4') || str.includes('fourth')) return '4th Year';
            if (str.includes('5') || str.includes('fifth')) return '5th Year';
            if (str.includes('6') || str.includes('sixth') || str.includes('final')) return '6th Year';
        }
        const codeStr = c.code || c.name || '';
        const digits = codeStr.replace(/[^0-9]/g, '');
        if (digits.length > 0) {
            const firstDigit = digits.charAt(0);
            const labels = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year', '5': '5th Year', '6': '6th Year' };
            if (labels[firstDigit]) return labels[firstDigit];
        }
        return '1st Year';
    };

    // Get all unique subjects for table headers — filtered by derived course academic year
    const allSubjects = Array.from(new Set([
        ...courses
            .filter(c => selectedYear === 'All' || deriveCourseYearLabel(c) === selectedYear)
            .map(c => c.code),
        ...Object.values(gradesData).flat().map(g => g.course)
    ]))
    .filter(sub => {
        if (selectedYear === 'All') return true;
        const matchingCourse = courses.find(c => c.code === sub);
        return matchingCourse ? deriveCourseYearLabel(matchingCourse) === selectedYear : false;
    })
    .sort();

    const ExportPreviewPanel = () => (
        <div className="preview-modal-overlay animate-fade-in" onClick={() => setShowPreview(false)}>
            <div
                className="preview-floating-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="preview-panel-header">
                    <div className="header-info">
                        <h2>Formal Registry Preview</h2>
                        <p>Standard Institutional Format (.docx)</p>
                    </div>
                    <div className="panel-actions">
                        <button className="export-btn-premium" onClick={() => { handleExportWord(); setShowPreview(false); }}>
                            <Download size={16} />
                            Download
                        </button>
                        <button className="close-panel-btn" onClick={() => setShowPreview(false)}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="preview-content-scroll">
                    <div className="document-paper side-preview">
                        <div className="doc-formal-header">
                            <div className="school-name">ALTAIR INSTITUTE OF TECHNOLOGY</div>
                            <div className="office-name">Office of the Registrar | Academic Records Division</div>
                            <div className="doc-title-main">OFFICIAL ACADEMIC PERFORMANCE REGISTRY</div>
                        </div>

                        <div className="doc-meta-right">
                            Date Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>

                        <div className="doc-table-wrapper">
                            <table className="formal-doc-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>NAME</th>
                                        {allSubjects.map(sub => <th key={sub}>{sub}</th>)}
                                        <th>GPA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentList.map(student => {
                                        const studentGrades = getGrades(student.id);
                                        const gpa = calculateGPA(student.id);
                                        return (
                                            <tr key={student.id}>
                                                <td className="text-center">{student.displayId || student.id}</td>
                                                <td className="font-bold">{student.name.toUpperCase()}</td>
                                                
                                                {allSubjects.map(sub => {
                                                    const gradeRecord = studentGrades.find(g => g.course === sub);
                                                    return (
                                                        <td key={sub} className="text-center">
                                                            {gradeRecord ? calculateLetterGrade(gradeRecord.score) : "-"}
                                                        </td>
                                                    );
                                                })}
                                                <td className="text-center">{gpa}</td>
                                                
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="doc-signature-block">
                            <div className="sig-column">
                                <div className="sig-line">__________________________</div>
                                <div className="sig-label">Registrar Signature</div>
                            </div>
                            <div className="sig-column">
                                <div className="sig-line">__________________________</div>
                                <div className="sig-label">Date of Approval</div>
                            </div>
                        </div>

                        <div className="doc-footer-official">
                            <p>This document is an official record of the Altair Institute of Technology.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const ImportMarksModal = () => (
        <div className="preview-modal-overlay animate-fade-in" onClick={() => setShowImportModal(false)}>
            <div className="import-marks-modal glass-panel" onClick={(e) => e.stopPropagation()}>
                <div className="preview-panel-header">
                    <div className="modal-header-title">
                        <FileSpreadsheet size={22} className="text-primary" />
                        <h2>Import Marks from Excel Sheet</h2>
                    </div>
                    <button className="close-panel-btn" onClick={() => setShowImportModal(false)}>
                        <X size={18} />
                    </button>
                </div>

                <div className="import-modal-body">
                    <div className="import-step-card glass-panel">
                        <div className="step-badge">Step 1</div>
                        <div>
                            <h4>Download Standard Template</h4>
                            <p className="sub-text">Download the pre-structured Excel template populated with your active student roster and course codes.</p>
                            <button className="btn btn-secondary-glass mt-2" onClick={handleDownloadMarksTemplate}>
                                <Download size={16} /> Download Template (.xlsx)
                            </button>
                        </div>
                    </div>

                    <div className="import-step-card glass-panel">
                        <div className="step-badge">Step 2</div>
                        <div>
                            <h4>Upload Completed Excel Sheet</h4>
                            <p className="sub-text">Select your completed `.xlsx` or `.csv` spreadsheet containing student grades.</p>
                            <div className="file-upload-dropzone mt-2">
                                <FileUp size={28} className="upload-icon-pulse" />
                                <label htmlFor="marks-file-input" className="file-upload-label">
                                    {excelFile ? excelFile.name : 'Choose Excel File (.xlsx, .csv)'}
                                </label>
                                <input
                                    id="marks-file-input"
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        </div>
                    </div>

                    {importStatus.error && (
                        <div className="import-alert error-alert">
                            <p>{importStatus.error}</p>
                        </div>
                    )}

                    {importStatus.success && (
                        <div className="import-alert success-alert">
                            <p>{importStatus.success}</p>
                        </div>
                    )}

                    {parsedMarks.length > 0 && (
                        <div className="parsed-preview-section">
                            <h4>Preview Parsed Marks ({parsedMarks.length} records)</h4>
                            <div className="parsed-table-scroll">
                                <table className="premium-table mini-table">
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Course</th>
                                            <th>Type</th>
                                            <th className="text-center">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedMarks.slice(0, 5).map((m, idx) => (
                                            <tr key={idx}>
                                                <td>{m.studentName || m.rollNo || m.studentEmail}</td>
                                                <td><span className="course-code-tag">{m.courseCode}</span></td>
                                                <td>{m.assessmentType}</td>
                                                <td className="text-center"><strong>{m.score} / {m.maxScore}</strong></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedMarks.length > 5 && (
                                    <p className="sub-text mt-1">+ {parsedMarks.length - 5} more records ready for import...</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="import-modal-footer">
                    <button className="btn btn-secondary-glass" onClick={() => setShowImportModal(false)}>
                        Cancel
                    </button>
                    <button
                        className="export-btn-premium"
                        onClick={handleSaveImportedMarks}
                        disabled={parsedMarks.length === 0 || importStatus.loading}
                    >
                        <Check size={18} />
                        {importStatus.loading ? 'Saving Marks...' : 'Confirm & Save Marks'}
                    </button>
                </div>
            </div>
        </div>
    );

    // Master View for Admins/Teachers
    if ((user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'teacher') && !selectedStudent) {
        const classAvg = studentList.length
            ? (studentList.reduce((acc, s) => acc + parseFloat(calculateGPA(s.id) || '0'), 0) / studentList.length).toFixed(2)
            : '0.00';

        const isLoading = dataLoading && !dataError;

        return (
            <div className="grades-page animate-fade-in">
                <header className="page-header">
                    <div>
                        <h1>Master Grades Registry</h1>
                        <p className="subtitle">Consolidated academic performance matrix</p>
                    </div>
                    <div className="header-actions">
                        <div className="search-box glass-panel">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Filter Registry..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-secondary-glass" onClick={() => setShowImportModal(true)} disabled={isLoading}>
                            <Upload size={18} />
                            Import Excel Marks
                        </button>
                        <button className="btn btn-secondary-glass" onClick={() => setShowPreview(true)} disabled={isLoading}>
                            <Eye size={18} />
                            Preview Export
                        </button>
                        <button className="export-btn-premium" onClick={() => setShowPreview(true)} disabled={isLoading}>
                            <FileText size={18} />
                            Export to Word
                        </button>
                    </div>
                </header>

                <div className="year-filter-bar glass-panel">
                    {years.map(year => (
                        <button
                            key={year}
                            className={`year-tag ${selectedYear === year ? 'active' : ''}`}
                            onClick={() => setSelectedYear(year)}
                        >
                            {year}
                        </button>
                    ))}
                </div>

                {dataError && (
                    <div className="glass-panel empty-state">
                        <p>{dataError}</p>
                    </div>
                )}

                {isLoading ? (
                    <div className="glass-panel empty-state">
                        <p>Loading grade data...</p>
                    </div>
                ) : (
                    <div className="grades-main-layout">
                        <div className="grades-overview-grid">
                            <div className="glass-panel gpa-card-premium">
                                <div className="card-accent primary"></div>
                                <div className="card-content">
                                    <div className="icon-badge primary"><Users size={24} /></div>
                                    <div className="info">
                                        <span className="label">Registry Size</span>
                                        <div className="main-value">{studentList.length}</div>
                                        <span className="sub-text">Total Active Records</span>
                                    </div>
                                </div>
                            </div>
                            <div className="glass-panel gpa-card-premium">
                                <div className="card-accent secondary"></div>
                                <div className="card-content">
                                    <div className="icon-badge secondary"><TrendingUp size={24} /></div>
                                    <div className="info">
                                        <span className="label">Performance Average</span>
                                        <div className="main-value">{classAvg}</div>
                                        <span className="sub-text text-success">Aggregated Score</span>
                                    </div>
                                </div>
                            </div>
                            <div className="glass-panel gpa-card-premium">
                                <div className="card-accent info"></div>
                                <div className="card-content">
                                    <div className="icon-badge info"><BookOpen size={24} /></div>
                                    <div className="info">
                                        <span className="label">Subjects Tracked</span>
                                        <div className="main-value">{allSubjects.length}</div>
                                        <span className="sub-text">Academic Modules</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel matrix-registry-container">
                            <div className="panel-header">
                                <h2>Academic Performance Matrix</h2>
                                <div className="panel-tip">
                                    <HelpCircle size={14} />
                                    <span>Live sync with central database</span>
                                </div>
                            </div>
                            <div className="matrix-scroll-wrapper">
                                <table className="master-grades-table">
                                    <thead>
                                        <tr>
                                            <th className="sticky-col id-col">ID</th>
                                            <th className="sticky-col name-col">Name</th>
                                            {allSubjects.map(sub => (
                                                <th key={sub} className="text-center">{sub}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map(student => {
                                            const studentGrades = getGrades(student.id);

                                            return (
                                                <tr key={student.id} className="hover-row">
                                                    <td
                                                        className="sticky-col id-col font-mono"
                                                        onClick={() => handleSelectStudent(student)}
                                                    >
                                                        {student.displayId || student.id}
                                                    </td>
                                                    <td
                                                        className="sticky-col name-col font-semibold"
                                                        onClick={() => handleSelectStudent(student)}
                                                    >
                                                        {student.name}
                                                    </td>
                                                    
                                                    {allSubjects.map(sub => {
                                                        const gradeRecord = studentGrades.find(g => g.course === sub);
                                                        const isEditing = editingCell?.studentId === student.id && editingCell?.course === sub;
                                                        const letterGrade = gradeRecord ? calculateLetterGrade(gradeRecord.score) : null;

                                                        return (
                                                            <td
                                                                key={`${student.id}-${sub}`}
                                                                className={`grade-cell text-center ${!gradeRecord ? 'empty-editable' : ''}`}
                                                                onClick={() => setEditingCell({ studentId: student.id, course: sub })}
                                                            >
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        className="matrix-edit-input"
                                                                        defaultValue={gradeRecord ? gradeRecord.score : ''}
                                                                        placeholder="0-100"
                                                                        autoFocus
                                                                        onBlur={(e) => handleSaveScore(student.id, sub, e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                handleSaveScore(student.id, sub, e.target.value);
                                                                            }
                                                                        }}
                                                                    />
                                                                 ) : (
                                                                    gradeRecord ? (
                                                                        <div className="matrix-grade-container">
                                                                            <span className={`matrix-grade-pill grade-${letterGrade?.toLowerCase()}`}>
                                                                                {letterGrade}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="add-grade-placeholder">-</span>
                                                                    )
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {!isLoading && showPreview && <ExportPreviewPanel />}
                {showImportModal && <ImportMarksModal />}
            </div>
        );
    }

    // Student Detail View or Individual Student Login View
    const currentGrades = getGrades(selectedStudent?.id || user?._id);
    const displayUser = selectedStudent || {
        id: user?._id,
        name: user?.name,
        year: semesterToYearLabel(user?.semester),
    };

    return (
        <div className="grades-page animate-fade-in">
            <header className="page-header">
                <div className="header-left">
                    {selectedStudent && (
                        <button className="back-btn-minimal" onClick={() => setSelectedStudent(null)}>
                            <ChevronLeft size={20} />
                            Back to Matrix
                        </button>
                    )}
                    <div>
                        <h1>{displayUser?.name}'s Performance</h1>
                        <p className="subtitle">Official transcript for {displayUser?.id} | {displayUser?.year}</p>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary">
                        <Download size={18} />
                        Transcript
                    </button>
                    <button className="btn btn-primary">
                        <Printer size={18} />
                        Print
                    </button>
                </div>
            </header>

            <div className="grades-overview-grid">
                <div className="glass-panel gpa-card-premium">
                    <div className="card-accent primary"></div>
                    <div className="card-content">
                        <div className="icon-badge primary">
                            <Award size={24} />
                        </div>
                        <div className="info">
                            <span className="label">{isStudent ? 'Academic Standing' : 'Cumulative GPA'}</span>
                            <div className="main-value">{isStudent ? 'Good Standing' : calculateGPA(displayUser?.id)}</div>
                            <div className="sub-value">
                                <TrendingUp size={14} className="text-success" />
                                <span>{isStudent ? 'Verified Record' : 'Above average'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-panel gpa-card-premium">
                    <div className="card-accent secondary"></div>
                    <div className="card-content">
                        <div className="icon-badge secondary">
                            <BookOpen size={24} />
                        </div>
                        <div className="info">
                            <span className="label">Course Load</span>
                            <div className="main-value">{currentGrades.length} / 6</div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${(currentGrades.length / 6) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-panel gpa-card-premium">
                    <div className="card-accent info"></div>
                    <div className="card-content">
                        <div className="icon-badge info">
                            <User size={24} />
                        </div>
                        <div className="info">
                            <span className="label">Status</span>
                            <div className="main-value" style={{ fontSize: '1.5rem' }}>Full-Time</div>
                            <span className="sub-text">Degree Candidate</span>
                        </div>
                    </div>
                </div>
            </div>

            {dataError && (
                <div className="glass-panel empty-state">
                    <p>{dataError}</p>
                </div>
            )}
            {dataLoading ? (
                <div className="glass-panel empty-state">
                    <p>Loading transcript...</p>
                </div>
            ) : (
                <div className="glass-panel transcript-container">
                    <div className="panel-header">
                        <h2>Subject Grades Breakdown</h2>
                        <div className="panel-tip">
                            <HelpCircle size={14} />
                            <span>Viewing verified records only</span>
                        </div>
                    </div>
                    <div className="grades-table-wrapper">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Term</th>
                                    <th>Subject</th>
                                    <th>Credits</th>
                                    <th className="text-center">Grade</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentGrades.map((item, index) => {
                                    const letterGrade = calculateLetterGrade(item.score);
                                    return (
                                        <tr key={index}>
                                            <td className="term-cell">{item.term}</td>
                                            <td>
                                                <div className="subject-info">
                                                    <span className="course-code-tag">{item.course}</span>
                                                    <span className="course-title-inline">{item.title}</span>
                                                </div>
                                            </td>
                                            <td className="credits-cell">{item.credits} Units</td>
                                            <td>
                                                <div className="grade-cell-content">
                                                    <div className="grade-result-pill">
                                                        {letterGrade}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showImportModal && <ImportMarksModal />}
        </div>
    );
};

export default Grades;
