import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, CheckCircle, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import apiClient from '../api/apiClient';
import './VerifyEmail.css';

const VerifyEmail = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const emailParam = location.state?.email || '';

    const [email, setEmail] = useState(emailParam);
    const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [timer, setTimer] = useState(60);

    const inputRefs = useRef([]);

    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000);
            return () => clearInterval(interval);
        }
    }, [timer]);

    const handleDigitChange = (index, value) => {
        if (value.length > 1) {
            // Support paste of 6 digits
            const pasted = value.replace(/\D/g, '').slice(0, 6);
            if (pasted.length === 6) {
                const digits = pasted.split('');
                setCodeDigits(digits);
                inputRefs.current[5]?.focus();
                return;
            }
        }

        const digit = value.replace(/\D/g, '');
        const updated = [...codeDigits];
        updated[index] = digit;
        setCodeDigits(updated);
        setError('');

        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        const code = codeDigits.join('');
        if (code.length < 6) {
            setError('Please enter all 6 digits of the verification code.');
            return;
        }

        if (!email) {
            setError('Email address is missing.');
            return;
        }

        try {
            setLoading(true);
            setError('');
            const { data } = await apiClient.post('/auth/verify-email', { email, code });

            setSuccess(data.message || 'Email verified successfully!');
            setTimeout(() => {
                navigate('/login', {
                    state: {
                        message: 'Email verified! Your account is now pending Admin approval. Please wait for an administrator to approve your account.'
                    }
                });
            }, 2500);
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed. Please check the code and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (timer > 0 || resending) return;
        if (!email) {
            setError('Please enter your email address to resend code.');
            return;
        }

        try {
            setResending(true);
            setError('');
            const { data } = await apiClient.post('/auth/resend-code', { email });
            setSuccess(data.message || 'A new 6-digit code has been sent.');
            setTimer(60);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resend code.');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="verify-email-page">
            <div className="verify-card glass-panel animate-fade-in">
                <button className="back-link" onClick={() => navigate('/login')}>
                    <ArrowLeft size={16} />
                    <span>Back to Login</span>
                </button>

                <div className="verify-header">
                    <div className="mail-icon-circle">
                        <Mail size={32} />
                    </div>
                    <h2>Verify Your Gmail Address</h2>
                    <p>
                        We sent a 6-digit verification code to:
                    </p>
                    <div className="email-badge">{email || 'your email'}</div>
                </div>

                {error && (
                    <div className="alert-banner error-banner">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="alert-banner success-banner">
                        <CheckCircle size={18} />
                        <span>{success}</span>
                    </div>
                )}

                <form onSubmit={handleVerify} className="verify-form">
                    {!emailParam && (
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@tuhmawbi.edu.mm"
                                required
                                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', border: '1px solid var(--surface-border)', background: 'var(--control-bg)', color: 'var(--text-primary)' }}
                            />
                        </div>
                    )}

                    <div className="passcode-inputs">
                        {codeDigits.map((digit, idx) => (
                            <input
                                key={idx}
                                ref={(el) => (inputRefs.current[idx] = el)}
                                type="text"
                                maxLength={6}
                                value={digit}
                                onChange={(e) => handleDigitChange(idx, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(idx, e)}
                                className="passcode-box"
                                placeholder="•"
                                disabled={loading}
                            />
                        ))}
                    </div>

                    <button type="submit" className="btn btn-primary verify-submit-btn" disabled={loading}>
                        {loading ? 'Verifying...' : 'Verify Gmail Account'}
                    </button>
                </form>

                <div className="resend-row">
                    <span>Didn't receive the code?</span>
                    <button
                        type="button"
                        className="resend-btn"
                        onClick={handleResend}
                        disabled={timer > 0 || resending}
                    >
                        <RefreshCw size={14} className={resending ? 'spin' : ''} />
                        {timer > 0 ? `Resend Code in ${timer}s` : 'Resend Code'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
