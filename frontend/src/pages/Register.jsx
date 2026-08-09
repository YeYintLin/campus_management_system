import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import './Auth.css';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'Student',
        year: 'Final Year (VI)',
        department: 'Mechatronics Engineering',
        rollNo: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const { register, loading } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        const result = await register(
            formData.name,
            formData.email,
            formData.password,
            formData.role,
            formData.department,
            formData.year,
            formData.rollNo
        );
        if (result.success) {
            if (result.requiresVerification) {
                navigate('/verify-email', { state: { email: result.email || formData.email } });
            } else {
                navigate('/dashboard');
            }
        } else {
            setErrorMsg(result.message);
        }
    };

    return (
        <div className="auth-container animate-fade-in">
            <div className="auth-card glass-panel" style={{ maxWidth: '520px' }}>
                <div className="auth-header">
                    <h2>Create Account</h2>
                    <p>Join the Campus Management System</p>
                </div>

                {errorMsg && <div className="auth-error">{errorMsg}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input
                            type="text"
                            name="name"
                            className="form-input"
                            placeholder="e.g. Mg Mg"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            name="email"
                            className="form-input"
                            placeholder="example@gmail.com"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                className="password-toggle-btn"
                                onClick={() => setShowPassword(prev => !prev)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label className="form-label">System Role</label>
                        <select name="role" className="form-input" value={formData.role} onChange={handleChange}>
                            <option value="Student">Student</option>
                            <option value="Teacher">Teacher / Faculty</option>
                        </select>
                    </div>

                    {formData.role === 'Student' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Academic Year</label>
                                <select name="year" className="form-input" value={formData.year} onChange={handleChange}>
                                    <option value="Final Year (VI)">Final Year (VI)</option>
                                    <option value="Fifth Year (V)">Fifth Year (V)</option>
                                    <option value="Fourth Year (IV)">Fourth Year (IV)</option>
                                    <option value="Third Year (III)">Third Year (III)</option>
                                    <option value="Second Year (II)">Second Year (II)</option>
                                    <option value="First Year (I)">First Year (I)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Department / Major</label>
                                <select name="department" className="form-input" value={formData.department} onChange={handleChange}>
                                    <option value="Mechatronics Engineering">Mechatronics Engineering (McE)</option>
                                    <option value="Computer Engineering">Computer Engineering (CE)</option>
                                    <option value="Information Technology">Information Technology (IT)</option>
                                    <option value="Electrical Engineering">Electrical Engineering (EP)</option>
                                    <option value="Mechanical Engineering">Mechanical Engineering (Mech)</option>
                                    <option value="Civil Engineering">Civil Engineering (Civil)</option>
                                    <option value="Electronic Engineering">Electronic Engineering (EC)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Roll Number</label>
                                <input
                                    type="text"
                                    name="rollNo"
                                    className="form-input"
                                    placeholder="e.g. 1, 2, 6, 49"
                                    value={formData.rollNo}
                                    onChange={handleChange}
                                    required
                                />
                                <small style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                                    Just enter your number (e.g. <strong>6</strong>). Upon Admin approval, system formats as <strong>I-MC 6</strong> or <strong>VI-MC 6</strong> based on your Year & Department.
                                </small>
                            </div>
                        </>
                    )}

                    <button type="submit" className="btn btn-primary auth-submit" disabled={loading} style={{ marginTop: '1rem' }}>
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login">Sign in here</Link></p>
                </div>
            </div>
        </div>
    );
};

export default Register;
