import { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AuthLoader from '../components/AuthLoader';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import './Auth.css';

const Login = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [infoMsg, setInfoMsg] = useState(location.state?.message || '');

    const { login, loading } = useContext(AuthContext);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setInfoMsg('');

        const result = await login(email, password);
        if (result.success) {
            const pendingQR = sessionStorage.getItem('pendingQRScan');
            if (pendingQR) {
                sessionStorage.removeItem('pendingQRScan');
                navigate(`/attendance${pendingQR}`);
            } else {
                navigate('/dashboard');
            }
        } else {
            if (result.requiresVerification) {
                navigate('/verify-email', { state: { email } });
            } else {
                setErrorMsg(result.message);
            }
        }
    };

    return (
        <div className="auth-shell">
            <div className="auth-background" aria-hidden="true">
                <div className="bg-orb orb-one" />
                <div className="bg-orb orb-two" />
                <div className="bg-orb orb-three" />
                <div className="bg-particles">
                    <span className="particle p1" />
                    <span className="particle p2" />
                    <span className="particle p3" />
                    <span className="particle p4" />
                    <span className="particle p5" />
                    <span className="particle p6" />
                    <span className="particle p7" />
                    <span className="particle p8" />
                </div>
                <div className="bg-noise" />
            </div>

            <div className="auth-container animate-fade-in">
                <div className="auth-card">
                    <div className="auth-header">
                        <h2>Welcome Back</h2>
                    </div>

                    {errorMsg && <div className="auth-error">{errorMsg}</div>}
                    {infoMsg && (
                        <div className="auth-error" style={{ background: 'rgba(8, 145, 178, 0.15)', borderColor: 'rgba(8, 145, 178, 0.3)', color: 'var(--primary-color)' }}>
                            {infoMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="example@gmail.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder=""
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
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

                        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>

                        {loading && (
                            <div className="auth-inline-loader" aria-live="polite">
                                <AuthLoader />
                            </div>
                        )}
                    </form>

                    <div className="auth-footer">
                        <p>New here? <Link to="/register">Create Account</Link></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
