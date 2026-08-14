import React, { useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
    Award, BookOpen, Download, Printer, TrendingUp, HelpCircle,
    ChevronLeft, User, Search, Users, FileText, Eye, X, Upload,
    FileSpreadsheet, Check, FileUp, Calendar, Hash, CheckCircle2,
    Clock, AlertCircle, Edit3, ShieldAlert
} from 'lucide-react';
import apiClient from '../api/apiClient';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, TableBorders, TextRun, VerticalAlign } from 'docx';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import './Grades.css';

const yearLookup = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'];

const Grades = () => {
    const { user } = useContext(AuthContext);
    const isStudent = user?.role === 'Student';
    const canManageGrades = user?.role === 'Admin' || user?.role === 'Teacher';

    const location = useLocation();
    const navigate = useNavigate();

    // Student multi-year history state
    const [studentHistoryData, setStudentHistoryData] = useState(null);
    const [selectedHistoryYear, setSelectedHistoryYear] = useState(null);

    // Admin / Teacher Matrix state
    const [studentList, setStudentList] = useState([]);
    const [courses, setCourses] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedYear, setSelectedYear] = useState('5th Year');
    const [selectedSemester, setSelectedSemester] = useState('Sem 2');
    const [searchTerm, setSearchTerm] = useState('');
    const [gradesData, setGradesData] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState('');

    // Grade Entry / Edit Modal State
    const [editGradeModal, setEditGradeModal] = useState(null); // { student, course, academicYear, semester, letterGrade, semester1Score, comments }
    const [submittingGrade, setSubmittingGrade] = useState(false);
    const [gradeModalError, setGradeModalError] = useState('');

    // Excel Bulk Import Modal State
    const [showImportModal, setShowImportModal] = useState(false);
    const [excelFile, setExcelFile] = useState(null);
    const [parsedMarks, setParsedMarks] = useState([]);
    const [importStatus, setImportStatus] = useState({ loading: false, error: '', success: '' });

    // ─────────────────────────────────────────────
    // Fetch Student Multi-Year Academic History
    // ─────────────────────────────────────────────
    const fetchStudentHistory = async (targetStudentId = null) => {
        try {
            setDataLoading(true);
            setDataError('');
            let endpoint = '/records/my-history';
            if (targetStudentId && targetStudentId !== user?._id) {
                endpoint = `/records/student/${targetStudentId}`;
            }

            const res = await apiClient.get(endpoint);
            setStudentHistoryData(res.data);

            const hist = res.data?.history || [];
            if (hist.length > 0) {
                // Select latest enrollment year by default
                setSelectedHistoryYear(hist[hist.length - 1].academicYear);
            }
        } catch (err) {
            console.error('Failed to load academic history:', err);
            setDataError(err.response?.data?.message || 'Failed to load academic record history');
        } finally {
            setDataLoading(false);
        }
    };

    // ─────────────────────────────────────────────
    // Fetch Teacher / Admin Master Grade Roster
    // ─────────────────────────────────────────────
    const fetchMasterGrades = async () => {
        try {
            setDataLoading(true);
            setDataError('');

            // Fetch students & courses
            const [studentsRes, coursesRes, gradesRes] = await Promise.all([
                apiClient.get('/students').catch(() => ({ data: [] })),
                apiClient.get('/courses').catch(() => ({ data: [] })),
                apiClient.get('/grades').catch(() => ({ data: [] })),
            ]);

            const sList = (studentsRes.data || []).map(s => ({
                id: s.user?._id || s._id,
                displayId: s.user?.currentRollNo || s.user?.rollNo || s.enrollmentNumber || 'Not yet assigned',
                permanentRegNo: s.user?.permanentRegNo || 'STU-' + (s.user?._id || s._id).toString().slice(-6).toUpperCase(),
                name: s.user?.name || 'Unknown Student',
                email: s.user?.email,
                year: s.year || s.user?.year || '5th Year',
                department: s.department || s.user?.department || 'Mechatronics Engineering',
            }));

            setStudentList(sList);
            setCourses(coursesRes.data || []);
            setGradesData(gradesRes.data || []);
        } catch (err) {
            console.error('Failed to load master grades:', err);
            setDataError(err.response?.data?.message || 'Failed to load grade roster');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        if (isStudent) {
            fetchStudentHistory();
        } else if (selectedStudent) {
            fetchStudentHistory(selectedStudent.id);
        } else {
            fetchMasterGrades();
        }
    }, [isStudent, selectedStudent]);

    useEffect(() => {
        if (location.state?.studentId && !isStudent) {
            setSelectedStudent({
                id: location.state.studentId,
                name: location.state.studentName || 'Student',
            });
        }
    }, [location.state, isStudent]);

    // Handle grade submission from edit modal
    const handleSaveGradeModal = async (e) => {
        e.preventDefault();
        if (!editGradeModal) return;

        try {
            setSubmittingGrade(true);
            setGradeModalError('');

            const { courseId, studentId, academicYear, yearLevel, semester, letterGrade, semester1Score, comments } = editGradeModal;

            await apiClient.post('/grades', {
                course: courseId,
                student: studentId,
                academicYear,
                yearLevel,
                semester: parseInt(semester, 10),
                letterGrade: parseInt(semester, 10) === 2 ? letterGrade : undefined,
                semester1Score: parseInt(semester, 10) === 1 ? semester1Score : undefined,
                comments,
            });

            setEditGradeModal(null);
            if (isStudent || selectedStudent) {
                fetchStudentHistory(selectedStudent?.id);
            } else {
                fetchMasterGrades();
            }
        } catch (err) {
            setGradeModalError(err.response?.data?.message || 'Failed to save grade');
        } finally {
            setSubmittingGrade(false);
        }
    };

    // Export Official Transcript to Word (.docx)
    const handleExportWordTranscript = async () => {
        if (!studentHistoryData) return;
        const s = studentHistoryData.student;
        const currentHist = (studentHistoryData.history || []).find(h => h.academicYear === selectedHistoryYear) || studentHistoryData.history?.[0];
        if (!currentHist) return;

        const tableRows = [
            new TableRow({
                tableHeader: true,
                children: [
                    new TableCell({ children: [new Paragraph({ text: 'Course Code', alignment: AlignmentType.CENTER })], width: { size: 25, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ text: 'Course Title', alignment: AlignmentType.LEFT })], width: { size: 45, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ text: 'Credits', alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ text: 'Final Letter Grade', alignment: AlignmentType.CENTER })], width: { size: 15, type: WidthType.PERCENTAGE } }),
                ],
            }),
        ];

        (currentHist.courses || []).forEach(c => {
            tableRows.push(
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph({ text: c.code || 'N/A', alignment: AlignmentType.CENTER })] }),
                        new TableCell({ children: [new Paragraph({ text: c.name || 'Course Title', alignment: AlignmentType.LEFT })] }),
                        new TableCell({ children: [new Paragraph({ text: String(c.credits || 3), alignment: AlignmentType.CENTER })] }),
                        new TableCell({ children: [new Paragraph({ text: c.letterGrade || 'In Progress', alignment: AlignmentType.CENTER })] }),
                    ],
                })
            );
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        text: 'TECHNOLOGICAL UNIVERSITY (HMAWBI)',
                        alignment: AlignmentType.CENTER,
                        heading: 'Heading1',
                    }),
                    new Paragraph({
                        text: 'DEPARTMENT OF MECHATRONICS ENGINEERING',
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        text: 'OFFICIAL ACADEMIC RECORD & GRADE TRANSCRIPT',
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({ text: '' }),
                    new Paragraph({ text: `Student Name: ${s?.name}   |   Permanent Reg No: ${s?.permanentRegNo}` }),
                    new Paragraph({ text: `Academic Year: ${currentHist.academicYear}   |   Year Level: ${currentHist.yearLevel}` }),
                    new Paragraph({ text: `Assigned Roll No: ${currentHist.rollNo || 'Not yet assigned'}   |   Attendance Rate: ${currentHist.attendanceRate || 0}%` }),
                    new Paragraph({ text: '' }),
                    new Table({
                        rows: tableRows,
                        width: { size: 100, type: WidthType.PERCENTAGE },
                    }),
                    new Paragraph({ text: '' }),
                    new Paragraph({ text: `Date Issued: ${new Date().toLocaleDateString()}` }),
                    new Paragraph({ text: 'Notice: Official letter grades are released at the end of Semester 2 upon completion of final examinations.' }),
                ],
            }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `Academic_Transcript_${s?.name?.replace(/\s+/g, '_')}_${currentHist.academicYear}.docx`);
    };

    // ─────────────────────────────────────────────
    // STUDENT VIEW (Multi-Year Letter Grades & Roll Banner)
    // ─────────────────────────────────────────────
    if (isStudent || selectedStudent) {
        const studentInfo = studentHistoryData?.student;
        const historyList = studentHistoryData?.history || [];
        const activeEnrollment = historyList.find(h => h.academicYear === selectedHistoryYear) || historyList[0];

        return (
            <div className="grades-page animate-fade-in">
                {/* Header */}
                <header className="page-header">
                    <div className="header-left">
                        {selectedStudent && !isStudent && (
                            <button className="btn btn-secondary" onClick={() => setSelectedStudent(null)} style={{ marginRight: '1rem' }}>
                                <ChevronLeft size={16} /> Back to Master Roster
                            </button>
                        )}
                        <div>
                            <h1>{studentInfo?.name || 'Student'}'s Academic Records</h1>
                            <p className="subtitle">
                                Multi-Year Academic History, Official Letter Grades & Attendance Registry
                            </p>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleExportWordTranscript}
                            disabled={!activeEnrollment}
                        >
                            <Download size={16} /> Export Transcript (.docx)
                        </button>
                    </div>
                </header>

                {/* Student Identity Banner */}
                <div className="glass-panel student-identity-banner">
                    <div className="identity-grid">
                        <div className="identity-col">
                            <span className="text-muted text-xs uppercase font-bold">Student Name</span>
                            <h3>{studentInfo?.name}</h3>
                            <span className="text-muted text-xs">{studentInfo?.email}</span>
                        </div>

                        <div className="identity-col">
                            <span className="text-muted text-xs uppercase font-bold">Permanent Registration No</span>
                            <div className="permanent-reg-pill">
                                <Hash size={14} />
                                <strong>{studentInfo?.permanentRegNo || 'N/A'}</strong>
                            </div>
                        </div>

                        <div className="identity-col">
                            <span className="text-muted text-xs uppercase font-bold">Current Roll No ({activeEnrollment?.academicYear || 'Session'})</span>
                            {activeEnrollment?.rollNo ? (
                                <span className="roll-assigned-badge">{activeEnrollment.rollNo}</span>
                            ) : (
                                <span className="roll-unassigned-badge">Not yet assigned</span>
                            )}
                        </div>

                        <div className="identity-col">
                            <span className="text-muted text-xs uppercase font-bold">Annual Attendance Rate</span>
                            <div className="attendance-indicator">
                                <span className={`att-badge ${activeEnrollment?.attendanceRate >= 75 ? 'good' : 'warning'}`}>
                                    {activeEnrollment?.attendanceRate || 0}%
                                </span>
                                <span className="text-muted text-xs">
                                    {activeEnrollment?.attendanceRate >= 75 ? 'Qualified (≥75%)' : 'Below 75% Requirement'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Multi-Year Academic Tabs */}
                <div className="year-tabs-container">
                    {historyList.map(h => (
                        <button
                            key={h.academicYear}
                            type="button"
                            className={`year-tab-btn ${selectedHistoryYear === h.academicYear ? 'active' : ''}`}
                            onClick={() => setSelectedHistoryYear(h.academicYear)}
                        >
                            <Calendar size={15} />
                            <span>{h.yearLevel} ({h.academicYear})</span>
                            {h.status === 'Active' && <span className="active-dot" />}
                        </button>
                    ))}
                </div>

                {/* Grades & Subjects Table */}
                <div className="glass-panel transcript-container">
                    <div className="panel-header">
                        <h2>Curriculum Subjects & Official Letter Grades</h2>
                        <div className="panel-tip">
                            <HelpCircle size={14} />
                            <span>Letter grades are finalized at end of Semester 2</span>
                        </div>
                    </div>

                    {dataLoading ? (
                        <div className="p-8 text-center"><Clock size={24} className="spin" /> Loading courses & grades...</div>
                    ) : !activeEnrollment || !activeEnrollment.courses || activeEnrollment.courses.length === 0 ? (
                        <div className="p-8 text-center text-muted">No course records found for this academic session.</div>
                    ) : (
                        <div className="table-responsive">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Course Code</th>
                                        <th>Course Title</th>
                                        <th>Credits</th>
                                        <th>Semester</th>
                                        <th className="text-center">Official Letter Grade</th>
                                        <th className="text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeEnrollment.courses.map((course, idx) => (
                                        <tr key={idx}>
                                            <td><span className="course-code-tag">{course.code}</span></td>
                                            <td><strong>{course.name}</strong></td>
                                            <td>{course.credits} Credits</td>
                                            <td>Semester {course.semester}</td>
                                            <td className="text-center">
                                                {course.letterGrade ? (
                                                    <span className="letter-grade-pill">{course.letterGrade}</span>
                                                ) : (
                                                    <span className="in-progress-pill">In Progress</span>
                                                )}
                                            </td>
                                            <td className="text-center">
                                                <span className={`status-badge-mini ${course.status === 'Finalized' ? 'good' : 'pending'}`}>
                                                    {course.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────
    // ADMIN / TEACHER MASTER ROSTER VIEW
    // ─────────────────────────────────────────────
    const filteredStudents = studentList.filter(s => {
        const matchesSearch = !searchTerm || (
            s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.permanentRegNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.displayId?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesYear = selectedYear === 'All' || s.year === selectedYear;
        return matchesSearch && matchesYear;
    });

    const activeYearCourses = courses.filter(c => {
        const yNum = parseInt(String(selectedYear).replace(/\D/g, ''), 10) || 5;
        const semNum = selectedSemester === 'Sem 1' ? 1 : 2;
        return c.year === yNum && (c.semester === semNum || !c.semester);
    });

    return (
        <div className="grades-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1>Official Grades & Evaluation Registry</h1>
                    <p className="subtitle">Teacher entry for Semester 1 tracking & Semester 2 official letter grades</p>
                </div>
                <div className="header-actions">
                    <div className="search-box glass-panel">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search by student, reg no, or roll no..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            {/* Year & Semester Filter Bar */}
            <div className="year-filter-bar glass-panel">
                {yearLookup.map(year => (
                    <button
                        key={year}
                        className={`year-tag ${selectedYear === year ? 'active' : ''}`}
                        onClick={() => setSelectedYear(year)}
                    >
                        {year}
                    </button>
                ))}
            </div>

            <div className="year-filter-bar glass-panel" style={{ marginTop: '0.5rem' }}>
                <button
                    className={`year-tag ${selectedSemester === 'Sem 1' ? 'active' : ''}`}
                    onClick={() => setSelectedSemester('Sem 1')}
                >
                    Semester 1 (Internal Score)
                </button>
                <button
                    className={`year-tag ${selectedSemester === 'Sem 2' ? 'active' : ''}`}
                    onClick={() => setSelectedSemester('Sem 2')}
                >
                    Semester 2 (Official Letter Grade A–E)
                </button>
            </div>

            {/* Matrix Table */}
            <div className="glass-panel matrix-registry-container" style={{ marginTop: '1.25rem' }}>
                <div className="panel-header">
                    <h2>Grade Evaluation Matrix ({selectedYear} - {selectedSemester === 'Sem 1' ? 'Semester 1' : 'Semester 2'})</h2>
                    <span className="text-muted text-xs">Click any cell to edit or submit student grade</span>
                </div>

                <div className="matrix-scroll-wrapper">
                    <table className="master-grades-table">
                        <thead>
                            <tr>
                                <th className="sticky-col id-col">Permanent Reg No</th>
                                <th className="sticky-col name-col">Student Name</th>
                                <th className="text-center">Roll No</th>
                                {activeYearCourses.map(c => (
                                    <th key={c._id} className="text-center">{c.code}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.map(student => (
                                <tr key={student.id} className="hover-row">
                                    <td
                                        className="sticky-col id-col font-mono"
                                        onClick={() => setSelectedStudent(student)}
                                        style={{ cursor: 'pointer', color: '#818cf8' }}
                                    >
                                        {student.permanentRegNo}
                                    </td>
                                    <td
                                        className="sticky-col name-col font-semibold"
                                        onClick={() => setSelectedStudent(student)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {student.name}
                                    </td>
                                    <td className="text-center font-mono text-sm">
                                        {student.displayId}
                                    </td>

                                    {activeYearCourses.map(c => {
                                        const semNum = selectedSemester === 'Sem 1' ? 1 : 2;
                                        const gradeRecord = gradesData.find(g =>
                                            g.student?._id === student.id &&
                                            (g.course?._id === c._id || g.course === c._id) &&
                                            g.semester === semNum
                                        );

                                        return (
                                            <td
                                                key={`${student.id}-${c._id}`}
                                                className="grade-cell text-center"
                                                onClick={() => {
                                                    setEditGradeModal({
                                                        courseId: c._id,
                                                        courseCode: c.code,
                                                        courseName: c.name,
                                                        studentId: student.id,
                                                        studentName: student.name,
                                                        permanentRegNo: student.permanentRegNo,
                                                        academicYear: '2025-2026',
                                                        yearLevel: selectedYear,
                                                        semester: semNum,
                                                        letterGrade: gradeRecord?.letterGrade || 'A',
                                                        semester1Score: gradeRecord?.semester1Score ?? '',
                                                        comments: gradeRecord?.comments || '',
                                                    });
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {semNum === 2 ? (
                                                    gradeRecord?.letterGrade ? (
                                                        <span className="letter-grade-pill">{gradeRecord.letterGrade}</span>
                                                    ) : (
                                                        <span className="text-muted text-xs">--</span>
                                                    )
                                                ) : (
                                                    gradeRecord?.semester1Score !== null && gradeRecord?.semester1Score !== undefined ? (
                                                        <span className="score-pill">{gradeRecord.semester1Score}</span>
                                                    ) : (
                                                        <span className="text-muted text-xs">--</span>
                                                    )
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Grade Entry / Edit Modal */}
            {editGradeModal && (
                <div className="modal-backdrop" onClick={() => setEditGradeModal(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Edit3 size={18} /> Grade Entry: {editGradeModal.courseCode}</h3>
                            <button type="button" className="btn-close" onClick={() => setEditGradeModal(null)}>×</button>
                        </div>
                        <form onSubmit={handleSaveGradeModal}>
                            <div className="modal-body">
                                <p className="text-sm text-muted">
                                    Entering grade for <strong>{editGradeModal.studentName}</strong> ({editGradeModal.permanentRegNo}).
                                </p>

                                {gradeModalError && (
                                    <div className="alert-banner error-banner">
                                        <AlertCircle size={16} />
                                        <span>{gradeModalError}</span>
                                    </div>
                                )}

                                <div className="form-field">
                                    <label>Academic Session & Term</label>
                                    <input
                                        type="text"
                                        value={`${editGradeModal.academicYear} • Semester ${editGradeModal.semester}`}
                                        disabled
                                    />
                                </div>

                                {editGradeModal.semester === 2 ? (
                                    <div className="form-field">
                                        <label>Official Letter Grade (Semester 2 Final) *</label>
                                        <select
                                            className="form-select"
                                            value={editGradeModal.letterGrade || 'A'}
                                            onChange={e => setEditGradeModal(prev => ({ ...prev, letterGrade: e.target.value }))}
                                            required
                                        >
                                            <option value="A">Grade A (Excellent / 81–100%)</option>
                                            <option value="B">Grade B (Good / 61–80%)</option>
                                            <option value="C">Grade C (Satisfactory / 41–60%)</option>
                                            <option value="D">Grade D (Pass / 21–40%)</option>
                                            <option value="E">Grade E (Fail / 0–20%)</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="form-field">
                                        <label>Semester 1 Internal Tracking Score (0–100)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            placeholder="e.g. 85"
                                            value={editGradeModal.semester1Score}
                                            onChange={e => setEditGradeModal(prev => ({ ...prev, semester1Score: e.target.value }))}
                                        />
                                        <span className="text-muted text-xs">Note: Internal score for teacher tracking. Official letter grades are entered in Semester 2.</span>
                                    </div>
                                )}

                                <div className="form-field">
                                    <label>Evaluation Comments</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Optional academic remarks..."
                                        value={editGradeModal.comments}
                                        onChange={e => setEditGradeModal(prev => ({ ...prev, comments: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setEditGradeModal(null)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={submittingGrade}>
                                    {submittingGrade ? 'Saving...' : 'Save & Log Audit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Grades;
