import { useState, useEffect } from 'react';
import { Download, RefreshCw, X, Share } from 'lucide-react';
import './PWAInstallPrompt.css';

const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [showUpdateToast, setShowUpdateToast] = useState(false);

    useEffect(() => {
        // 1. Check if app is already running in standalone PWA mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        // 2. Listen for Chrome/Android beforeinstallprompt event
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            if (!isStandalone) {
                setShowInstallBanner(true);
            }
        };

        // 3. Detect iOS Safari
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS && !isStandalone) {
            const hasSeenGuide = sessionStorage.getItem('ios_pwa_guide_dismissed');
            if (!hasSeenGuide) {
                setShowIOSGuide(true);
            }
        }

        // 4. Listen for Service Worker update available event
        const handleUpdateAvailable = () => {
            setShowUpdateToast(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('pwaUpdateAvailable', handleUpdateAvailable);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('pwaUpdateAvailable', handleUpdateAvailable);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowInstallBanner(false);
        }
        setDeferredPrompt(null);
    };

    const handleRefresh = () => {
        window.location.reload();
    };

    const dismissIOSGuide = () => {
        sessionStorage.setItem('ios_pwa_guide_dismissed', 'true');
        setShowIOSGuide(false);
    };

    return (
        <div className="pwa-prompt-container">
            {/* ── System Update Notification Toast ── */}
            {showUpdateToast && (
                <div className="pwa-toast pwa-update-toast glass-panel animate-slide-down">
                    <div className="toast-content">
                        <RefreshCw size={18} className="spin" />
                        <div>
                            <h4>System Update Available</h4>
                            <p>A new version of Smart Department Platform has been deployed.</p>
                        </div>
                    </div>
                    <button type="button" className="toast-action-btn" onClick={handleRefresh}>
                        Refresh
                    </button>
                </div>
            )}

            {/* ── Android/Desktop Chrome Install Banner ── */}
            {showInstallBanner && deferredPrompt && (
                <div className="pwa-toast pwa-install-banner glass-panel animate-slide-up">
                    <div className="toast-content">
                        <Download size={20} className="text-primary" />
                        <div>
                            <h4>Install Smart Department App</h4>
                            <p>Add to home screen for fast offline access</p>
                        </div>
                    </div>
                    <div className="toast-actions">
                        <button type="button" className="toast-action-btn" onClick={handleInstallClick}>
                            Install
                        </button>
                        <button type="button" className="toast-close-btn" onClick={() => setShowInstallBanner(false)}>
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── iOS Safari Install Instructions ── */}
            {showIOSGuide && (
                <div className="pwa-toast pwa-ios-guide glass-panel animate-slide-up">
                    <div className="toast-content">
                        <Share size={20} className="text-primary" />
                        <div>
                            <h4>Install on iPhone</h4>
                            <p>Tap Share <span className="ios-share-icon">⎋</span> at bottom of Safari, then select <strong>Add to Home Screen</strong>.</p>
                        </div>
                    </div>
                    <button type="button" className="toast-close-btn" onClick={dismissIOSGuide}>
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default PWAInstallPrompt;
