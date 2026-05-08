import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AuthLoader from '../components/AuthLoader';
import './Auth.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const { login, loading } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        const result = await login(email, password);
        if (result.success) {
            navigate('/dashboard');
        } else {
            setErrorMsg(result.message);
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

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Email or Username</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="you@school.edu or your username"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
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
