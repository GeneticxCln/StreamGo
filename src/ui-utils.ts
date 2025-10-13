// Toast and Modal Utilities for StreamGo
import { escapeHtml } from './utils';

type ToastType = 'info' | 'success' | 'error' | 'warning';

interface ModalOptions {
    title?: string;
    message?: string;
    input?: boolean;
    placeholder?: string;
    defaultValue?: string;
    showCancel?: boolean;
    confirmText?: string;
}

// Toast notification system
const Toast = {
    container: null as HTMLElement | null,
    
    init(): void {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },
    
    show(message: string, type: ToastType = 'info', duration = 4000): HTMLElement {
        this.init();
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <div class="toast-content">
                <div class="toast-message">${escapeHtml(message)}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        if (this.container) {
            this.container.appendChild(toast);
        }
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
        
        return toast;
    },
    
    success(message: string, duration?: number): HTMLElement {
        return this.show(message, 'success', duration);
    },
    
    error(message: string, duration?: number): HTMLElement {
        return this.show(message, 'error', duration);
    },
    
    warning(message: string, duration?: number): HTMLElement {
        return this.show(message, 'warning', duration);
    },
    
    info(message: string, duration?: number): HTMLElement {
        return this.show(message, 'info', duration);
    }
};

// Modal dialog system
const Modal = {
    show(options: ModalOptions): Promise<string | boolean | null> {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            
            const modal = document.createElement('div');
            modal.className = 'modal';
            
            let html = '<div class="modal-header">';
            html += `<h3 class="modal-title">${escapeHtml(options.title || 'Confirm')}</h3>`;
            html += '</div>';
            
            html += '<div class="modal-body">';
            html += `<p>${escapeHtml(options.message || '')}</p>`;
            
            if (options.input) {
                html += `<input type="text" class="modal-input" placeholder="${escapeHtml(options.placeholder || '')}" value="${escapeHtml(options.defaultValue || '')}">`;
            }
            
            html += '</div>';
            
            html += '<div class="modal-footer">';
            if (options.showCancel !== false) {
                html += '<button class="btn btn-secondary modal-cancel">Cancel</button>';
            }
            html += `<button class="btn btn-primary modal-confirm">${escapeHtml(options.confirmText || 'OK')}</button>`;
            html += '</div>';
            
            modal.innerHTML = html;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            
            const input = modal.querySelector<HTMLInputElement>('.modal-input');
            const confirmBtn = modal.querySelector<HTMLButtonElement>('.modal-confirm');
            const cancelBtn = modal.querySelector<HTMLButtonElement>('.modal-cancel');
            
            const close = (result: string | boolean | null) => {
                overlay.style.animation = 'fadeOut 0.2s ease-in';
                setTimeout(() => {
                    overlay.remove();
                }, 200);
                resolve(result);
            };
            
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    if (input) {
                        close(input.value);
                    } else {
                        close(true);
                    }
                });
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => close(null));
            }
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay && options.showCancel !== false) {
                    close(null);
                }
            });
            
            // Focus input if present
            if (input) {
                setTimeout(() => input.focus(), 100);
                input.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter' && confirmBtn) {
                        confirmBtn.click();
                    } else if (e.key === 'Escape' && options.showCancel !== false) {
                        close(null);
                    }
                });
            }
        });
    },
    
    confirm(message: string, title = 'Confirm'): Promise<boolean | null> {
        return this.show({
            title,
            message,
            showCancel: true
        }) as Promise<boolean | null>;
    },
    
    alert(message: string, title = 'Notice'): Promise<boolean | null> {
        return this.show({
            title,
            message,
            showCancel: false
        }) as Promise<boolean | null>;
    },
    
    prompt(message: string, title = 'Input', placeholder = '', defaultValue = ''): Promise<string | null> {
        return this.show({
            title,
            message,
            input: true,
            placeholder,
            defaultValue,
            showCancel: true
        }) as Promise<string | null>;
    }
};

// Export for use throughout the app
export { Toast, Modal };

// Make available globally for onclick handlers
if (typeof window !== 'undefined') {
    (window as any).Toast = Toast;
    (window as any).Modal = Modal;
}
