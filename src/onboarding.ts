import { invoke } from './utils';
import { Toast } from './ui-utils';

export class OnboardingManager {
    private currentStep = 1;
    private selectedGenres: string[] = [];
    private modal: HTMLElement | null = null;

    constructor() {
        this.modal = document.getElementById('onboarding-modal');
    }

    /**
     * Check if onboarding should be shown (first launch)
     */
    shouldShowOnboarding(): boolean {
        const completed = localStorage.getItem('onboarding_complete');
        return completed !== 'true';
    }

    /**
     * Show onboarding flow
     */
    show() {
        if (!this.modal) return;
        
        this.modal.style.display = 'flex';
        this.currentStep = 1;
        this.setupEventListeners();
        this.updateStepDisplay();
    }

    /**
     * Hide onboarding and mark as complete
     */
    hide() {
        if (!this.modal) return;
        
        this.modal.style.display = 'none';
        localStorage.setItem('onboarding_complete', 'true');
        
        // Save selected genres to localStorage
        if (this.selectedGenres.length > 0) {
            localStorage.setItem('favorite_genres', JSON.stringify(this.selectedGenres));
        }
    }

    private setupEventListeners() {
        // Next buttons
        document.querySelectorAll('.onboarding-next').forEach(btn => {
            btn.addEventListener('click', () => this.nextStep());
        });

        // Back buttons
        document.querySelectorAll('.onboarding-back').forEach(btn => {
            btn.addEventListener('click', () => this.previousStep());
        });

        // Install addon button
        const installBtn = document.querySelector('.onboarding-install-addon');
        installBtn?.addEventListener('click', () => this.installDefaultAddon());

        // Finish button
        const finishBtn = document.querySelector('.onboarding-finish');
        finishBtn?.addEventListener('click', () => this.finish());

        // Skip button
        const skipBtn = document.querySelector('.onboarding-skip');
        skipBtn?.addEventListener('click', () => this.skip());

        // Genre pills
        document.querySelectorAll('.genre-pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const genre = target.dataset.genre;
                if (genre) {
                    this.toggleGenre(genre);
                    target.classList.toggle('selected');
                }
            });
        });
    }

    private nextStep() {
        if (this.currentStep < 4) {
            this.currentStep++;
            this.updateStepDisplay();
        }
    }

    private previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepDisplay();
        }
    }

    private updateStepDisplay() {
        // Hide all steps
        document.querySelectorAll('.onboarding-step').forEach(step => {
            (step as HTMLElement).style.display = 'none';
        });

        // Show current step
        const currentStepEl = document.querySelector(`.onboarding-step[data-step="${this.currentStep}"]`) as HTMLElement;
        if (currentStepEl) {
            currentStepEl.style.display = 'block';
        }

        // Update progress dots
        document.querySelectorAll('.progress-dot').forEach(dot => {
            const dotNum = parseInt((dot as HTMLElement).dataset.dot || '0');
            if (dotNum <= this.currentStep) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    private async installDefaultAddon() {
        try {
            const installBtn = document.querySelector('.onboarding-install-addon') as HTMLButtonElement;
            if (installBtn) {
                installBtn.disabled = true;
                installBtn.textContent = 'Installing...';
            }

            const cinemataUrl = 'https://v3-cinemeta.strem.io/manifest.json';
            await invoke('install_addon', { manifest_url: cinemataUrl });

            Toast.success('Cinemeta addon installed successfully!');
            
            // Wait a bit for addon to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.nextStep();
        } catch (err) {
            console.error('Error installing addon:', err);
            Toast.error(`Failed to install addon: ${err}`);
            
            // Reset button
            const installBtn = document.querySelector('.onboarding-install-addon') as HTMLButtonElement;
            if (installBtn) {
                installBtn.disabled = false;
                installBtn.textContent = 'Install & Continue';
            }
        }
    }

    private toggleGenre(genre: string) {
        const index = this.selectedGenres.indexOf(genre);
        if (index > -1) {
            this.selectedGenres.splice(index, 1);
        } else {
            this.selectedGenres.push(genre);
        }
    }

    private finish() {
        this.hide();
        Toast.success('Welcome to StreamGo! 🎉');
        
        // Trigger discover section to show content
        if ((window as any).app) {
            (window as any).app.showSection('discover');
        }
    }

    private skip() {
        this.hide();
        Toast.info('You can always revisit setup from settings');
    }
}

// Initialize onboarding manager
export function initOnboarding() {
    const manager = new OnboardingManager();
    
    // Show onboarding on first launch
    if (manager.shouldShowOnboarding()) {
        // Wait a bit for the app to initialize
        setTimeout(() => {
            manager.show();
        }, 1000);
    }
    
    return manager;
}
